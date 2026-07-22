const jwt = require('jsonwebtoken');

const DEFAULT_SECRETS = [
  'dev-secret-change-me',
  'change-moi-en-production-avec-une-longue-chaine-aleatoire',
];
const SECRET = process.env.JWT_SECRET;
const ACCESS_TOKEN_EXPIRES_IN = '15m';
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

function validateSecret() {
  const missing = !SECRET;
  const isDefault = SECRET && DEFAULT_SECRETS.includes(SECRET);
  const tooShort = SECRET && SECRET.length < 32;

  if (missing || isDefault || tooShort) {
    const reason = missing
      ? 'JWT_SECRET est manquant.'
      : isDefault
      ? 'JWT_SECRET utilise encore la valeur par défaut de .env.example.'
      : 'JWT_SECRET est trop court (minimum 32 caractères recommandé).';

    if (IS_PRODUCTION) {
      console.error(`[SÉCURITÉ] Démarrage bloqué : ${reason} Générez une longue chaîne aléatoire (ex. openssl rand -hex 32) et définissez-la dans les variables d'environnement.`);
      process.exit(1);
    } else {
      console.warn(`[SÉCURITÉ] Avertissement (mode développement) : ${reason} À corriger avant tout déploiement en production.`);
    }
  }
}
validateSecret();

const EFFECTIVE_SECRET = SECRET || 'dev-secret-change-me';

function signAccessToken(payload) {
  return jwt.sign(payload, EFFECTIVE_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRES_IN });
}

function verifyToken(token) {
  return jwt.verify(token, EFFECTIVE_SECRET);
}

module.exports = { signAccessToken, verifyToken, ACCESS_TOKEN_EXPIRES_IN };
