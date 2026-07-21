// Intégration Wave — structure prête à brancher sur la vraie API Wave (Checkout API).
// Tant que WAVE_API_KEY n'est pas définie, ce module fonctionne en mode simulation.

const MOCK_MODE = !process.env.WAVE_API_KEY;

async function initiatePayment({ amount, rideId, phone }) {
  if (MOCK_MODE) {
    console.log(`[WAVE-SIMULATION] Initiation paiement ${amount} FCFA pour la course ${rideId}`);
    return {
      success: true,
      providerRef: `WAVE-SIM-${Date.now()}`,
      checkoutUrl: null,
      status: 'pending',
    };
  }

  throw new Error('Intégration Wave réelle non configurée.');
}

function verifyWebhookSignature(rawBody, signatureHeader) {
  if (MOCK_MODE) return true;

  const crypto = require('crypto');
  const secret = process.env.WAVE_WEBHOOK_SECRET;
  if (!secret) return false;

  const expected = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex');

  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected),
      Buffer.from(signatureHeader || '')
    );
  } catch {
    return false;
  }
}

module.exports = { initiatePayment, verifyWebhookSignature, MOCK_MODE };
