const pool = require('../db/pool');
const mtnMomo = require('../services/paymentProviders/mtnMomo');
const wave = require('../services/paymentProviders/wave');
const orangeMoney = require('../services/paymentProviders/orangeMoney');

async function waveWebhook(req, res, next) {
  try {
    const signature = req.headers['wave-signature'];
    if (!wave.verifyWebhookSignature(req.rawBody, signature)) {
      return res.status(401).json({ error: 'Signature invalide.' });
    }
    const { providerRef, status } = mapWaveEvent(req.body);
    await updateTransactionByRef(providerRef, status);
    res.json({ received: true });
  } catch (err) {
    next(err);
  }
}

async function orangeWebhook(req, res, next) {
  try {
    const signature = req.headers['x-orange-signature'];
    if (!orangeMoney.verifyWebhookSignature(req.rawBody, signature)) {
      return res.status(401).json({ error: 'Signature invalide.' });
    }
    const { providerRef, status } = mapOrangeEvent(req.body);
    await updateTransactionByRef(providerRef, status);
    res.json({ received: true });
  } catch (err) {
    next(err);
  }
}

async function momoWebhook(req, res, next) {
  try {
    const signature = req.headers['x-momo-signature'];
    if (!mtnMomo.verifyWebhookSignature(req.rawBody, signature)) {
      return res.status(401).json({ error: 'Signature invalide.' });
    }
    const { providerRef, status } = mapMomoEvent(req.body);
    await updateTransactionByRef(providerRef, status);
    res.json({ received: true });
  } catch (err) {
    next(err);
  }
}

async function updateTransactionByRef(providerRef, status) {
  if (!providerRef) return;
  await pool.query(
    `UPDATE transactions SET status = $1, updated_at = now() WHERE provider_ref = $2`,
    [status, providerRef]
  );
}

function mapWaveEvent(body) {
  return { providerRef: body?.id, status: body?.checkout_status === 'complete' ? 'success' : 'failed' };
}
function mapOrangeEvent(body) {
  return { providerRef: body?.pay_token, status: body?.status === 'SUCCESS' ? 'success' : 'failed' };
}
function mapMomoEvent(body) {
  return { providerRef: body?.referenceId, status: body?.status === 'SUCCESSFUL' ? 'success' : 'failed' };
}

async function requestPayout(req, res, next) {
  try {
    const { amount } = req.body;
    const { rows: driverRows } = await pool.query('SELECT * FROM drivers WHERE user_id = $1', [req.user.id]);
    if (driverRows.length === 0) return res.status(403).json({ error: 'Profil chauffeur requis.' });
    const driver = driverRows[0];

    const { rows: userRows } = await pool.query('SELECT phone FROM users WHERE id = $1', [req.user.id]);

    const { rows: earningsRows } = await pool.query(
      `SELECT COALESCE(SUM(driver_net_amount),0)::int AS total_net FROM rides
       WHERE driver_id = $1 AND status = 'completed'`,
      [driver.id]
    );
    const { rows: payoutRows } = await pool.query(
      `SELECT COALESCE(SUM(amount),0)::int AS total_paid FROM payouts
       WHERE driver_id = $1 AND status = 'success'`,
      [driver.id]
    );
    const available = earningsRows[0].total_net - payoutRows[0].total_paid;

    if (amount > available) {
      return res.status(400).json({ error: `Solde insuffisant. Disponible : ${available} FCFA.` });
    }

    const result = await mtnMomo.transfer({ amount, driverId: driver.id, phone: userRows[0].phone });

    const { rows } = await pool.query(
      `INSERT INTO payouts (driver_id, amount, method, status, provider_ref)
       VALUES ($1,$2,'mtn_momo',$3,$4) RETURNING *`,
      [driver.id, amount, result.status, result.providerRef]
    );

    res.status(201).json({ payout: rows[0] });
  } catch (err) {
    next(err);
  }
}

module.exports = { waveWebhook, orangeWebhook, momoWebhook, requestPayout };
