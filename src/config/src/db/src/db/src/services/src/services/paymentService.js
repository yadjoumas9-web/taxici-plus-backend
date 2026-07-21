const pool = require('../db/pool');
const wave = require('./paymentProviders/wave');
const orangeMoney = require('./paymentProviders/orangeMoney');
const mtnMomo = require('./paymentProviders/mtnMomo');

async function initiateRidePayment({ rideId, amount, method, phone }) {
  let result;

  switch (method) {
    case 'wave':
      result = await wave.initiatePayment({ amount, rideId, phone });
      break;
    case 'orange_money':
      result = await orangeMoney.initiatePayment({ amount, rideId, phone });
      break;
    case 'mtn_momo':
      result = await mtnMomo.requestToPay({ amount, rideId, phone });
      break;
    case 'cash':
      result = { success: true, providerRef: null, status: 'success' };
      break;
    default:
      throw new Error(`Moyen de paiement inconnu : ${method}`);
  }

  const { rows } = await pool.query(
    `INSERT INTO transactions (ride_id, amount, method, status, provider_ref)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [rideId, amount, method, result.status, result.providerRef]
  );

  return { transaction: rows[0], providerResult: result };
}

async function confirmTransaction(transactionId, status) {
  const { rows } = await pool.query(
    `UPDATE transactions SET status = $1, updated_at = now() WHERE id = $2 RETURNING *`,
    [status, transactionId]
  );
  return rows[0];
}

module.exports = { initiateRidePayment, confirmTransaction };
