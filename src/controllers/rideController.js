const pool = require('../db/pool');
const { computeFare, computeCommission } = require('../utils/fare');
const { findNearestAvailableDriver } = require('../services/matchingService');
const paymentService = require('../services/paymentService');

async function estimateFare(req, res, next) {
  try {
    const { fromLat, fromLng, toLat, toLng } = req.body;
    if ([fromLat, fromLng, toLat, toLng].some((v) => typeof v !== 'number')) {
      return res.status(400).json({ error: 'Coordonnées manquantes ou invalides.' });
    }
    const { rows } = await pool.query(`SELECT * FROM fare_zones WHERE is_active = true LIMIT 1`);
    const zone = rows[0];
    const estimate = computeFare(fromLat, fromLng, toLat, toLng, zone);
    res.json(estimate);
  } catch (err) {
    next(err);
  }
}

async function requestRide(req, res, next) {
  try {
    const { fromAddress, fromLat, fromLng, toAddress, toLat, toLng } = req.body;
    if (!fromAddress || !toAddress || [fromLat, fromLng, toLat, toLng].some((v) => typeof v !== 'number')) {
      return res.status(400).json({ error: 'Champs de course manquants ou invalides.' });
    }

    const { rows: zoneRows } = await pool.query(`SELECT * FROM fare_zones WHERE is_active = true LIMIT 1`);
    const { distanceKm, durationMin, fare } = computeFare(fromLat, fromLng, toLat, toLng, zoneRows[0]);

    const { rows: rideRows } = await pool.query(
      `INSERT INTO rides
        (passenger_id, from_address, from_lat, from_lng, to_address, to_lat, to_lng,
         distance_km, duration_min, fare_estimated, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'requested') RETURNING *`,
      [req.user.id, fromAddress, fromLat, fromLng, toAddress, toLat, toLng, distanceKm, durationMin, fare]
    );
    const ride = rideRows[0];

    const match = await findNearestAvailableDriver(fromLat, fromLng);
    const io = req.app.get('io');

    if (!match) {
      await pool.query(`UPDATE rides SET status = 'no_driver_found' WHERE id = $1`, [ride.id]);
      return res.status(200).json({ ride: { ...ride, status: 'no_driver_found' }, message: 'Aucun chauffeur disponible à proximité pour le moment.' });
    }

    io.to(`driver:${match.driver.user_id}`).emit('ride:incoming_request', {
      rideId: ride.id,
      fromAddress, toAddress, fare, distanceKm, durationMin,
      passengerId: req.user.id,
    });

    res.status(201).json({ ride, proposedDriver: { id: match.driver.id, name: match.driver.full_name, distanceKm: match.distanceKm } });
  } catch (err) {
    next(err);
  }
}

async function acceptRide(req, res, next) {
  try {
    const { rows: driverRows } = await pool.query('SELECT * FROM drivers WHERE user_id = $1', [req.user.id]);
    if (driverRows.length === 0) return res.status(403).json({ error: 'Profil chauffeur requis.' });
    const driver = driverRows[0];

    const { rows } = await pool.query(
      `UPDATE rides SET driver_id = $1, status = 'accepted', accepted_at = now()
       WHERE id = $2 AND status = 'requested' RETURNING *`,
      [driver.id, req.params.id]
    );
    if (rows.length === 0) {
      return res.status(409).json({ error: 'Cette course n\'est plus disponible.' });
    }
    const ride = rows[0];

    req.app.get('io').to(`passenger:${ride.passenger_id}`).emit('ride:accepted', {
      rideId: ride.id, driverName: req.user.phone, driverPlate: driver.vehicle_plate,
    });

    res.json({ ride });
  } catch (err) {
    next(err);
  }
}

async function refuseRide(req, res, next) {
  try {
    const { rows } = await pool.query(`SELECT * FROM rides WHERE id = $1`, [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Course introuvable.' });
    const ride = rows[0];

    const match = await findNearestAvailableDriver(ride.from_lat, ride.from_lng);
    if (match) {
      req.app.get('io').to(`driver:${match.driver.user_id}`).emit('ride:incoming_request', {
        rideId: ride.id, fromAddress: ride.from_address, toAddress: ride.to_address,
        fare: ride.fare_estimated, distanceKm: ride.distance_km, durationMin: ride.duration_min,
        passengerId: ride.passenger_id,
      });
      return res.json({ message: 'Course relancée vers un autre chauffeur.' });
    }

    await pool.query(`UPDATE rides SET status = 'no_driver_found' WHERE id = $1`, [ride.id]);
    res.json({ message: 'Aucun autre chauffeur disponible.' });
  } catch (err) {
    next(err);
  }
}

async function markArrived(req, res, next) {
  try {
    const { rows } = await pool.query(
      `UPDATE rides SET status = 'arrived', arrived_at = now() WHERE id = $1 RETURNING *`,
      [req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Course introuvable.' });
    const ride = rows[0];
    req.app.get('io').to(`passenger:${ride.passenger_id}`).emit('ride:driver_arrived', { rideId: ride.id });
    res.json({ ride });
  } catch (err) {
    next(err);
  }
}

async function startRide(req, res, next) {
  try {
    const { rows } = await pool.query(
      `UPDATE rides SET status = 'in_progress', started_at = now() WHERE id = $1 RETURNING *`,
      [req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Course introuvable.' });
    const ride = rows[0];
    req.app.get('io').to(`passenger:${ride.passenger_id}`).emit('ride:started', { rideId: ride.id });
    res.json({ ride });
  } catch (err) {
    next(err);
  }
}

async function completeRide(req, res, next) {
  try {
    const { paymentMethod } = req.body;
    if (!['cash', 'wave', 'orange_money', 'mtn_momo'].includes(paymentMethod)) {
      return res.status(400).json({ error: 'Moyen de paiement invalide.' });
    }

    const { rows: rideRows } = await pool.query(`SELECT * FROM rides WHERE id = $1`, [req.params.id]);
    if (rideRows.length === 0) return res.status(404).json({ error: 'Course introuvable.' });
    const ride = rideRows[0];

    const { rows: driverRows } = await pool.query(`SELECT * FROM drivers WHERE id = $1`, [ride.driver_id]);
    const driver = driverRows[0];
    const fareFinal = ride.fare_estimated;
    const { commission, driverNet } = computeCommission(fareFinal, driver.commission_rate);

    const { rows: updated } = await pool.query(
      `UPDATE rides SET status = 'completed', completed_at = now(),
         fare_final = $1, payment_method = $2, commission_amount = $3, driver_net_amount = $4
       WHERE id = $5 RETURNING *`,
      [fareFinal, paymentMethod, commission, driverNet, ride.id]
    );

    const { rows: passengerRows } = await pool.query('SELECT phone FROM users WHERE id = $1', [ride.passenger_id]);
    const { transaction } = await paymentService.initiateRidePayment({
      rideId: ride.id, amount: fareFinal, method: paymentMethod, phone: passengerRows[0].phone,
    });

    req.app.get('io').to(`driver:${driver.user_id}`).emit('ride:completed', {
      rideId: ride.id, grossAmount: fareFinal, commission, netAmount: driverNet,
    });

    res.json({ ride: updated[0], transaction });
  } catch (err) {
    next(err);
  }
}

async function cancelRide(req, res, next) {
  try {
    const { by, reason } = req.body;
    const status = by === 'driver' ? 'cancelled_by_driver' : 'cancelled_by_passenger';
    const { rows } = await pool.query(
      `UPDATE rides SET status = $1, cancelled_reason = $2 WHERE id = $3 RETURNING *`,
      [status, reason || null, req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Course introuvable.' });
    const ride = rows[0];

    const io = req.app.get('io');
    const room = by === 'driver' ? `passenger:${ride.passenger_id}` : `driver:${ride.driver_id}`;
    io.to(room).emit('ride:cancelled', { rideId: ride.id, by, reason });

    res.json({ ride });
  } catch (err) {
    next(err);
  }
}

async function getRide(req, res, next) {
  try {
    const { rows } = await pool.query(`SELECT * FROM rides WHERE id = $1`, [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Course introuvable.' });
    res.json({ ride: rows[0] });
  } catch (err) {
    next(err);
  }
}

async function getMyHistory(req, res, next) {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM rides WHERE passenger_id = $1 ORDER BY requested_at DESC LIMIT 50`,
      [req.user.id]
    );
    res.json({ rides: rows });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  estimateFare, requestRide, acceptRide, refuseRide,
  markArrived, startRide, completeRide, cancelRide, getRide, getMyHistory,
};
