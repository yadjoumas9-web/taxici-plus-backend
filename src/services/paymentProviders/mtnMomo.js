// Intégration MTN Mobile Money — API Collections (paiement passager) et
// Disbursements (retrait chauffeur). Tant que MTN_MOMO_API_KEY n'est pas définie,
// fonctionne en mode simulation.

const { verifyHmacSignature, allowUnconfiguredWebhook } = require('../../utils/webhookSecurity');

const MOCK_MODE = !process.env.MTN_MOMO_API_KEY;

async function requestToPay({ amount, rideId, phone }) {
  if (MOCK_MODE) {
    console.log(`[MTN-MOMO-SIMULATION] Collection ${amount} FCFA (course ${rideId}) depuis ${phone}`);
    return { success: true, providerRef: `MOMO-COL-SIM-${Date.now()}`, status: 'pending' };
  }

  throw new Error('Intégration MTN MoMo réelle non configurée.');
}

async function transfer({ amount, driverId, phone }) {
  if (MOCK_MODE) {
    console.log(`[MTN-MOMO-SIMULATION] Disbursement ${amount} FCFA vers chauffeur ${driverId} (${phone})`);
    return { success: true, providerRef: `MOMO-DIS-SIM-${Date.now()}`, status: 'pending' };
  }

  throw new Error('Intégration MTN MoMo réelle non configurée.');
}

function verifyWebhookSignature(rawBody, signatureHeader) {
  const secret = process.env.MTN_MOMO_WEBHOOK_SECRET;
  if (!secret) return allowUnconfiguredWebhook('MTN MoMo');
  return verifyHmacSignature(rawBody, signatureHeader, secret);
}

module.exports = { requestToPay, transfer, verifyWebhookSignature, MOCK_MODE };
