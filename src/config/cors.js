// Configuration CORS centralisée.
//
// CORS_ORIGIN doit contenir, en production, la liste des domaines autorisés à
// appeler l'API, séparés par des virgules — ex. :
// CORS_ORIGIN=https://taxici-plus.netlify.app,https://taxici-plus-admin.netlify.app
//
// En développement, si CORS_ORIGIN n'est pas défini, l'API reste ouverte à
// tous les domaines (pratique pour tester le MVP en local) — mais un
// avertissement est affiché pour ne pas l'oublier avant la mise en production.

function getAllowedOrigins() {
  const raw = process.env.CORS_ORIGIN;
  if (!raw) return null; // null = pas de restriction (dev uniquement)
  return raw
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
}

function buildCorsOptions() {
  const isProduction = process.env.NODE_ENV === "production";
  const allowedOrigins = getAllowedOrigins();

  if (isProduction && !allowedOrigins) {
    console.error(
      "[SÉCURITÉ] Démarrage bloqué : CORS_ORIGIN doit être défini en production " +
        "(liste de domaines autorisés séparés par des virgules). " +
        "Sans cela, l'API accepterait des requêtes depuis n'importe quel site."
    );
    process.exit(1);
  }

  if (!allowedOrigins) {
    console.warn(
      "[SÉCURITÉ] Avertissement (mode développement) : CORS_ORIGIN non défini — " +
        "l'API accepte les requêtes de n'importe quel domaine. À restreindre avant la mise en production."
    );
    return { origin: true }; // reflète l'origine de la requête (pratique en dev, jamais en prod)
  }

  return {
    origin(origin, callback) {
      // Requêtes sans en-tête Origin (ex. appels serveur à serveur, webhooks, curl) : autorisées.
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      callback(new Error(`Origine non autorisée par la politique CORS : ${origin}`));
    },
  };
}

module.exports = { buildCorsOptions, getAllowedOrigins };
