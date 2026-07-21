const pool = require('../db/pool');
const { haversineKm } = require('../utils/fare');

const SEARCH_RADIUS_KM = 6;

async function findNearestAvailableDriver(fromLat, fromLng) {
  const { rows: drivers } = await pool.query(
    `SELECT d.*, u.full_name, u.phone
     FROM drivers d
     JOIN users u ON u.id = d.user_id
     WHERE d.is_online = true
       AND d.kyc_status = 'approved'
       AND d.current_lat IS NOT NULL
       AND d.current_lng IS NOT NULL
       AND d.id NOT IN (
         SELECT driver_id FROM rides
         WHERE driver_id IS NOT NULL
           AND status IN ('accepted','arrived','in_progress')
       )`
  );

  let closest = null;
  let closestDist = Infinity;

  for (const drv of drivers) {
    const dist = haversineKm(fromLat, fromLng, drv.current_lat, drv.current_lng);
    if (dist < closestDist && dist <= SEARCH_RADIUS_KM) {
      closest = drv;
      closestDist = dist;
    }
  }

  return closest ? { driver: closest, distanceKm: Math.round(closestDist * 10) / 10 } : null;
}

module.exports = { findNearestAvailableDriver, SEARCH_RADIUS_KM };
