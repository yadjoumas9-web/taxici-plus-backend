const pool = require('../db/pool');

const OTP_TTL_MINUTES = 5;
const OTP_COOLDOWN_SECONDS = 60;
const OTP_MAX_PER_HOUR = 5;

function generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

async function requestOtp(phone) {
  const { rows: recent } = await pool.query(
    `SELECT created_at FROM otp_codes WHERE phone = $1 ORDER BY created_at DESC LIMIT 1`,
    [phone]
  );
  if (recent.length > 0) {
    const secondsSinceLast = (Date.now() - new Date(recent[0].created_at).getTime()) / 1000;
    if (secondsSinceLast < OTP_COOLDOWN_SECONDS) {
      const err = new Error(`Veuillez patienter ${Math.ceil(OTP_COOLDOWN_SECONDS - secondsSinceLast)} secondes avant de redemander un code.`);
      err.status = 429;
      throw err;
    }
  }

  const { rows: countRows } = await pool.query(
    `SELECT COUNT(*)::int AS count FROM otp_codes WHERE phone = $1 AND created_at > now() - interval '1 hour'`,
    [phone]
  );
  if (countRows[0].count >= OTP_MAX_PER_HOUR) {
    const err = new Error('Trop de demandes de code pour ce numéro. Réessayez plus tard.');
    err.status = 429;
    throw err;
  }

  const code = generateCode();
  const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);

  await pool.query(
    `INSERT INTO otp_codes (phone, code, expires_at) VALUES ($1, $2, $3)`,
    [phone, code, expiresAt]
  );

  await sendSms(phone, code);
  return { expiresInMinutes: OTP_TTL_MINUTES };
}

async function verifyOtp(phone, code) {
  const { rows } = await pool.query(
    `SELECT * FROM otp_codes
     WHERE phone = $1 AND code = $2 AND verified = false AND expires_at > now()
     ORDER BY created_at DESC LIMIT 1`,
    [phone, code]
  );
  if (rows.length === 0) return false;

  await pool.query(`UPDATE otp_codes SET verified = true WHERE id = $1`, [rows[0].id]);
  return true;
}

async function sendSms(phone, code) {
  if (process.env.SMS_PROVIDER === 'none' || !process.env.SMS_PROVIDER) {
    console.log(`[OTP-SIMULATION] Code envoyé à ${phone} : ${code}`);
    return;
  }
}

module.exports = { requestOtp, verifyOtp };
