const crypto = require('crypto');
const pool = require('../db/pool');
const { signAccessToken } = require('../utils/jwt');

const REFRESH_TOKEN_TTL_DAYS = 30;

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

async function createSession(user, meta = {}) {
  const accessToken = signAccessToken({ id: user.id, role: user.role, phone: user.phone });

  const refreshToken = crypto.randomBytes(48).toString('hex');
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);

  await pool.query(
    `INSERT INTO refresh_tokens (user_id, token_hash, user_agent, ip_address, expires_at)
     VALUES ($1, $2, $3, $4, $5)`,
    [user.id, hashToken(refreshToken), meta.userAgent || null, meta.ip || null, expiresAt]
  );

  return { accessToken, refreshToken };
}

async function refreshSession(refreshToken, meta = {}) {
  const tokenHash = hashToken(refreshToken);
  const { rows } = await pool.query(
    `SELECT rt.*, u.id AS user_id, u.role, u.phone, u.is_active
     FROM refresh_tokens rt
     JOIN users u ON u.id = rt.user_id
     WHERE rt.token_hash = $1 AND rt.revoked_at IS NULL AND rt.expires_at > now()`,
    [tokenHash]
  );

  if (rows.length === 0) {
    const err = new Error('Session invalide ou expirée. Veuillez vous reconnecter.');
    err.status = 401;
    throw err;
  }
  const session = rows[0];

  if (!session.is_active) {
    const err = new Error('Compte désactivé.');
    err.status = 403;
    throw err;
  }

  await pool.query(`UPDATE refresh_tokens SET revoked_at = now() WHERE id = $1`, [session.id]);

  return createSession(
    { id: session.user_id, role: session.role, phone: session.phone },
    meta
  );
}

async function revokeSession(refreshToken) {
  await pool.query(
    `UPDATE refresh_tokens SET revoked_at = now() WHERE token_hash = $1 AND revoked_at IS NULL`,
    [hashToken(refreshToken)]
  );
}

async function revokeAllSessions(userId) {
  await pool.query(
    `UPDATE refresh_tokens SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL`,
    [userId]
  );
}

module.exports = { createSession, refreshSession, revokeSession, revokeAllSessions };
