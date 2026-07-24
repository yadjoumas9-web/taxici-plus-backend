const pool = require('../db/pool');

async function submitRating(req, res, next) {
  try {
    const { rideId, targetId, score, comment } = req.body;
    if (!rideId || !targetId || !score || score < 1 || score > 5) {
      return res.status(400).json({ error: 'rideId, targetId et score (1-5) requis.' });
    }

    const { rows } = await pool.query(
      `INSERT INTO ratings (ride_id, author_id, target_id, score, comment)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [rideId, req.user.id, targetId, score, comment || null]
    );

    const { rows: driverRows } = await pool.query('SELECT * FROM drivers WHERE user_id = $1', [targetId]);
    if (driverRows.length > 0) {
      const driver = driverRows[0];
      const newCount = driver.rating_count + 1;
      const newAvg = ((driver.rating_avg * driver.rating_count) + score) / newCount;
      await pool.query(
        `UPDATE drivers SET rating_avg = $1, rating_count = $2 WHERE id = $3`,
        [newAvg.toFixed(2), newCount, driver.id]
      );
    }

    res.status(201).json({ rating: rows[0] });
  } catch (err) {
    next(err);
  }
}

module.exports = { submitRating };
