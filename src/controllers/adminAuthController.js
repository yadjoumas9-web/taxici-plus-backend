const bcrypt = require('bcryptjs');
const pool = require('../db/pool');
const { createSession, revokeSession } = require('../services/sessionService');

async function login(req, res, next) {
  try {
    const { phone, password } = req.body;
    if (!phone || !password) {
      return res.status(400).json({ error: 'Téléphone et mot de passe requis.' });
    }

    const { rows } = await pool.query(
      `SELECT * FROM users WHERE phone = $1 AND role = 'admin'`,
      [phone]
    );
    if (rows.length === 0) {
      return res.status(401).json({ error: 'Identifiants invalides.' });
    }
    const admin = rows[0];

    const valid = admin.password_hash && await bcrypt.compare(password, admin.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Identifiants invalides.' });
    }

    const session = await createSession(admin, { userAgent: req.headers['user-agent'], ip: req.ip });
    res.json({ ...session, admin: { id: admin.id, phone: admin.phone, fullName: admin.full_name } });
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

module.exports = { login, logout };
