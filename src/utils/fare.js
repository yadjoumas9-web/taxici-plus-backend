function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
function toRad(deg) {
  return (deg * Math.PI) / 180;
}

const ROAD_FACTOR = 1.35;
const AVG_SPEED_KMH = 25;
const MIN_TRIP_KM = 2.5;
const MIN_FARE = 500;

function computeFare(fromLat, fromLng, toLat, toLng, zone) {
  const straightKm = haversineKm(fromLat, fromLng, toLat, toLng);
  let distanceKm = Math.round(straightKm * ROAD_FACTOR * 100) / 100;
  distanceKm = Math.max(distanceKm, MIN_TRIP_KM);
  const durationMin = Math.max(3, Math.round((distanceKm / AVG_SPEED_KMH) * 60));

  const base = zone?.base_fare ?? 400;
  const perKm = zone?.per_km ?? 250;
  const perMin = zone?.per_minute ?? 50;

  let fare = base + distanceKm * perKm + durationMin * perMin;
  fare = Math.round(fare / 50) * 50;
  fare = Math.max(fare, MIN_FARE);

  return { distanceKm, durationMin, fare };
}

function computeCommission(fareFinal, commissionRate) {
  const commission = Math.round((fareFinal * commissionRate) / 10) * 10;
  const driverNet = fareFinal - commission;
  return { commission, driverNet };
}

module.exports = { haversineKm, computeFare, computeCommission };
