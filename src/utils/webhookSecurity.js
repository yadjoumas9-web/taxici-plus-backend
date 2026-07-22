const crypto = require('crypto');

const IS_PRODUCTION = process.env.NODE_ENV === 'production';

function verifyHmacSignature(rawBody, signatureHeader, secret) {
  if (!signatureHeader || !rawBody) return false;

  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  const provided = signatureHeader.replace(/^sha256=/, '').trim();

  if (expected.length !== provided.length) return false;

  try {
    return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(provided, 'hex'));
  } catch {
    return false;
  }
}

function allowUnconfiguredWebhook(providerName) {
  if (IS_PRODUCTION) {
    console.error(`[SÉCURITÉ] Webhook ${providerName} refusé : aucun secret de vérification configuré en production.`);
    return false;
  }
  console.warn(`[SÉCURITÉ] Webhook ${providerName} accepté sans vérification de signature (mode développement — secret non configuré).`);
  return true;
}

module.exports = { verifyHmacSignature, allowUnconfiguredWebhook, IS_PRODUCTION };
