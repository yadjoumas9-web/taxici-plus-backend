const pool = require('../db/pool');

async function getMyProfile(req, res, next) {
  try {
    const { rows } = await pool.query(
      `SELECT d.*, u.full_name, u.phone FROM drivers d
       JOIN users u ON u.id = d.user_id WHERE d.user_id = $1`,
      [req.user.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Profil chauffeur introuvable.' });
    res.json({ driver: rows[0] });
  } catch (err) {
    next(err);
  }
}

async function updateMyProfile(req, res, next) {
  try {
    const { licenseNumber, vehiclePlate, vehicleModel } = req.body;
    const { rows } = await pool.query(
      `UPDATE drivers SET
         license_number = COALESCE($1, license_number),
         vehicle_plate  = COALESCE($2, vehicle_plate),
         vehicle_model  = COALESCE($3, vehicle_model),
         updated_at = now()
       WHERE user_id = $4 RETURNING *`,
      [licenseNumber, vehiclePlate, vehicleModel, req.user.id]
    );
    res.json({ driver: rows[0] });
  } catch (err) {
    next(err);
  }
}

async function setAvailability(req, res, next) {
  try {
    const { online } = req.body;
    const { rows } = await pool.query(
      `UPDATE drivers SET is_online = $1, updated_at = now() WHERE user_id = $2 RETURNING *`,
      [!!online, req.user.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Profil chauffeur introuvable.' });

    if (online && rows[0].kyc_status !== 'approved') {
      await pool.query(`UPDATE drivers SET is_online = false WHERE user_id = $1`, [req.user.id]);
      return res.status(403).json({ error: 'Dossier KYC non encore approuvé. Impossible de passer en ligne.' });
    }

    res.json({ driver: rows[0] });
  } catch (err) {
    next(err);
  }
}

async function updateLocation(req, res, next) {
  try {
    const { lat, lng } = req.body;
    if (typeof lat !== 'number' || typeof lng !== 'number') {
      return res.status(400).json({ error: 'lat et lng requis (nombres).' });
    }
    await pool.query(
      `UPDATE drivers SET current_lat = $1, current_lng = $2, updated_at = now() WHERE user_id = $3`,
      [lat, lng, req.user.id]
    );
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

async function getEarnings(req, res, next) {
  try {
    const period = req.query.period === 'week' ? '7 days' : '1 day';
    const { rows: driverRows } = await pool.query('SELECT id FROM drivers WHERE user_id = $1', [req.user.id]);
    if (driverRows.length === 0) return res.status(404).json({ error: 'Profil chauffeur introuvable.' });

    const { rows } = await pool.query(
      `SELECT COUNT(*)::int AS courses, COALESCE(SUM(driver_net_amount),0)::int AS net_total,
              COALESCE(SUM(commission_amount),0)::int AS commission_total
       FROM rides
       WHERE driver_id = $1 AND status = 'completed'
         AND completed_at > now() - $2::interval`,
      [driverRows[0].id, period]
    );
    res.json({ period: req.query.period === 'week' ? 'week' : 'today', ...rows[0] });
  } catch (err) {
    next(err);
  }
}

async function getHistory(req, res, next) {
  try {
    const { rows: driverRows } = await pool.query('SELECT id FROM drivers WHERE user_id = $1', [req.user.id]);
    if (driverRows.length === 0) return res.status(404).json({ error: 'Profil chauffeur introuvable.' });

    const { rows } = await pool.query(
      `SELECT r.*, u.full_name AS passenger_name FROM rides r
       JOIN users u ON u.id = r.passenger_id
       WHERE r.driver_id = $1 ORDER BY r.requested_at DESC LIMIT 50`,
      [driverRows[0].id]
    );
    res.json({ rides: rows });
  } catch (err) {
    next(err);
  }
}

module.exports = { getMyProfile, updateMyProfile, setAvailability, updateLocation, getEarnings, getHistory };
