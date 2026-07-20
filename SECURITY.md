# TaxiCI+ — Journal des mesures de sécurité

Suivi des points identifiés lors de la revue de sécurité initiale du backend, et de
leur correction.

## ✅ 1. Vérification de signature des webhooks paiement

**Problème** : les callbacks Wave/Orange Money/MTN MoMo acceptaient n'importe quelle
requête sans vérifier qu'elle provenait réellement du fournisseur — un tiers aurait
pu simuler un faux paiement réussi.

**Correction** : `src/utils/webhookSecurity.js` calcule une signature HMAC-SHA256 sur
le corps brut de la requête (`req.rawBody`, capturé dans `server.js`) et la compare
à celle envoyée par le fournisseur. **Comportement fail-closed** : en production, un
webhook reçu sans secret configuré (`WAVE_WEBHOOK_SECRET`, `ORANGE_WEBHOOK_SECRET`,
`MTN_MOMO_WEBHOOK_SECRET`) est automatiquement refusé plutôt que silencieusement
accepté.

⚠️ À adapter précisément au format réel de signature de chaque fournisseur au
moment de configurer les vraies clés API (consulter leur documentation officielle —
l'algorithme exact peut varier légèrement selon le fournisseur).

## ✅ 2. `JWT_SECRET` par défaut faible

**Problème** : si l'administrateur oubliait de changer la valeur d'exemple, les
jetons d'authentification devenaient falsifiables par quiconque connaît cette
valeur par défaut (publique, puisque dans ce dépôt).

**Correction** : `src/utils/jwt.js` vérifie la robustesse du secret au démarrage.
- En développement : avertissement dans les logs si la valeur par défaut est
  utilisée.
- En production (`NODE_ENV=production`) : **le serveur refuse de démarrer**
  (`process.exit(1)`) si `JWT_SECRET` est absent, trop court, ou égal à la valeur
  d'exemple. Testé et confirmé.

Génération recommandée : `openssl rand -hex 32`.

## ✅ 3. Absence de limite anti-abus sur l'envoi d'OTP

**Problème** : rien n'empêchait d'envoyer un nombre illimité de codes SMS vers un
même numéro (coût si fournisseur SMS payant, nuisance pour la victime), ni de
tenter de deviner un code par force brute.

**Correction** :
- `src/services/otpService.js` : cooldown de 60 secondes entre deux demandes pour un
  même numéro, plafond de 5 codes par heure et par numéro (vérifié en base via
  `otp_codes`).
- `src/routes/auth.routes.js` : limite globale par adresse IP (20 demandes/heure sur
  `/otp/request`, limite dédiée également sur `/otp/verify` pour freiner la force
  brute sur le code à 6 chiffres).

## ✅ 4. CORS ouvert à tous les domaines (`*`)

**Problème** : `cors({ origin: '*' })` acceptait des requêtes API depuis n'importe
quel site web, facilitant un usage détourné de l'API par un tiers non autorisé.

**Correction** : `src/config/cors.js` introduit une liste blanche de domaines
(`CORS_ORIGIN`, séparés par des virgules). **Fail-closed en production** : le
serveur refuse de démarrer si `CORS_ORIGIN` n'est pas défini. En développement,
reste ouvert par défaut (avec avertissement) pour ne pas gêner les tests locaux du
MVP. S'applique à la fois aux routes REST et aux connexions WebSocket (Socket.IO).

## ✅ 5. Révocation de token

**Problème** : un JWT classique reste valide jusqu'à expiration quel que soit ce qui
arrive ensuite (vol, déconnexion demandée, compte compromis) — jusqu'à 30 jours dans
la version précédente, sans aucun moyen de l'invalider en cours de route.

**Correction** : passage à un système à deux jetons (`src/services/sessionService.js`) :
- **Jeton d'accès** (JWT) réduit à **15 minutes** — fenêtre d'exposition minimale en
  cas de vol.
- **Refresh token** opaque (30 jours), dont seul le **hash SHA-256** est stocké en
  base (table `refresh_tokens`) — jamais le token en clair, à l'image d'un mot de
  passe. Révocable individuellement (`POST /api/auth/logout`) ou pour tous les
  appareils d'un coup (`POST /api/auth/logout-all`), et automatiquement **tourné**
  (ancien révoqué, nouveau émis) à chaque rafraîchissement pour limiter la
  réutilisation silencieuse d'un token intercepté.

Mêmes mécanismes appliqués à la connexion administrateur.

## ✅ 6. Traçabilité des actions admin

**Problème** : aucune trace de qui avait validé/rejeté un chauffeur, changé une
commission, ou désactivé un compte — problématique en cas d'erreur ou de litige
("qui a fait ça et pourquoi ?").

**Correction** : `src/services/auditLogService.js` + table `audit_logs`. Chaque
action de modification du back-office (validation KYC, changement de commission,
désactivation/réactivation de compte) enregistre automatiquement : l'administrateur
concerné, l'action, la cible, les valeurs avant/après, l'adresse IP, et l'horodatage.
Consultable via `GET /api/admin/audit-logs`. La journalisation ne bloque jamais
l'action elle-même en cas d'échec technique du log (erreur journalisée côté serveur
sans interrompre la requête).

## ✅ 7. Droits liés aux données personnelles (accès et effacement)

Voir `PRIVACY.md` pour la politique complète. Sur le plan technique :
- `GET /api/me/data` — export de toutes les données détenues sur l'utilisateur
  connecté (droit d'accès).
- `DELETE /api/me` — anonymisation des données identifiantes ; l'historique de
  courses est conservé sous forme anonymisée à des fins comptables plutôt que
  supprimé purement, conformément à une conservation à finalité légitime limitée
  (durée exacte à formaliser juridiquement).

## Récapitulatif

Tous les points identifiés lors de la revue de sécurité initiale sont désormais
traités (1 à 7). Prochaine revue recommandée avant tout lancement public à grande
échelle, notamment sur : la purge automatique des codes OTP expirés et des refresh
tokens révoqués/expirés (tâche planifiée), et un test d'intrusion externe une fois
les vraies clés de paiement activées.
