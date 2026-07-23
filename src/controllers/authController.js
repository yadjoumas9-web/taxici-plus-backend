const pool = require('../db/pool');
const { requestOtp, verifyOtp } = require('../services/otpService');
const { createSession, refreshSession, revokeSession, revokeAllSessions } = require('../services/sessionService');

async function requestOtpCode(req, res, next) {
  try {
    const { phone } = req.body;
    if (!phone || !/^\+225\d{8,10}$/.test(phone)) {
      return res.status(400).json({ error: 'Numéro invalide. Format attendu : +225XXXXXXXXXX' });
    }
    const result = await requestOtp(phone);
    res.json({ message: 'Code envoyé.', ...result });
  } catch (err) {
    next(err);
  }
}

async function verifyOtpCode(req, res, next) {
  try {
    const { phone, code, role = 'passenger', fullName } = req.body;
    if (!phone || !code) {
      return res.status(400).json({ error: 'Téléphone et code requis.' });
    }

    const valid = await verifyOtp(phone, code);
    if (!valid) {
      return res.status(400).json({ error: 'Code invalide ou expiré.' });
    }

    let { rows } = await pool.query('SELECT * FROM users WHERE phone = $1', [phone]);
    let user = rows[0];

    if (!user) {
      const inserted = await pool.query(
        `INSERT INTO users (phone, full_name, role) VALUES ($1, $2, $3) RETURNING *`,
        [phone, fullName || null, role]
      );
      user = inserted.rows[0];

      if (role === 'driver') {
        await pool.query(
          `INSERT INTO drivers (user_id, license_number, vehicle_plate)
           VALUES ($1, $2, $3)`,
          [user.id, 'À_COMPLETER', 'À_COMPLETER']
        );
      }
    }

    const session = await createSession(user, { userAgent: req.headers['user-agent'], ip: req.ip });
    res.json({ ...session, user: sanitizeUser(user) });
  } catch (err) {
    next(err);
  }
}

async function refresh(req, res, next) {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(400).json({ error: 'refreshToken requis.' });

    const session = await refreshSession(refreshToken, { userAgent: req.headers['user-agent'], ip: req.ip });
    res.json(session);
  } catch (err) {
    next(err);
  }
}

async function logout(req, res, next) {
  try {
    const { refreshToken } = req.body;
    if (refreshToken) await revokeSession(refreshToken);
    res.json({ message: 'Déconnecté.' });
  } catch (err) {
    next(err);
  }
}

async function logoutAll(req, res, next) {
  try {
    await revokeAllSessions(req.user.id);
    res.json({ message: 'Toutes les sessions ont été déconnectées.' });
  } catch (err) {
    next(err);
  }
}

async function me(req, res, next) {
  try {
    const { rows } = await pool.query('SELECT * FROM users WHERE id = $1', [req.user.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Utilisateur introuvable.' });
    res.json({ user: sanitizeUser(rows[0]) });
  } catch (err) {
    next(err);
  }
}

function sanitizeUser(user) {
  const { password_hash, ...safe } = user;
  return safe;
}

module.exports = { requestOtpCode, verifyOtpCode, refresh, logout, logoutAll, me };
