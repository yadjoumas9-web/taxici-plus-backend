# TaxiCI+ — Backend API

Backend Node.js/Express + PostgreSQL + WebSocket pour la plateforme TaxiCI+.
Basé sur le cahier des charges TaxiCI+ v1 (architecture, modèle chauffeurs indépendant, intégrations paiement).

## Stack

- **Node.js + Express** — API REST
- **PostgreSQL** — base de données (via `pg`)
- **Socket.IO** — temps réel (position chauffeur, statut de course)
- **JWT** — authentification par OTP (code SMS)
- **Wave / Orange Money / MTN MoMo** — paiement (en mode simulation tant que les clés API réelles ne sont pas configurées)

## Démarrer en local

```bash
npm install
cp .env.example .env
# éditer .env si besoin (DATABASE_URL vers une Postgres locale ou distante)

npm run migrate   # crée les tables
npm run dev        # démarre le serveur en mode watch
```

L'API répond sur `http://localhost:3000`. Vérifier avec `GET /health`.

## Back-office administrateur

Un panneau d'administration séparé (`TaxiCI_Plus_Admin.html`) permet de :
- Valider ou rejeter le dossier KYC d'un chauffeur
- Ajuster le taux de commission par chauffeur
- Désactiver/réactiver un compte
- Consulter les statistiques (courses, revenus, commissions du jour et depuis le début)
- Superviser les courses (filtrage par statut) — utile pour la gestion des litiges

### Créer le compte administrateur

Après la migration (`npm run migrate`), définir `ADMIN_PHONE` et `ADMIN_PASSWORD` dans les variables d'environnement, puis :

```bash
npm run create-admin
```

Ce script crée (ou met à jour) le compte administrateur. Se reconnecter ensuite depuis `TaxiCI_Plus_Admin.html` avec ce numéro et ce mot de passe, en renseignant l'URL du backend déployé (ex. `https://votre-projet.up.railway.app`) dans la « Configuration avancée » de l'écran de connexion.

## Sécurité — correctifs appliqués

Trois failles ont été corrigées avant tout traitement de vrais paiements :

1. **Vérification des signatures de webhook paiement** (`src/utils/webhookSecurity.js`) — chaque webhook (Wave/Orange/MTN) vérifie désormais une signature HMAC-SHA256 réelle plutôt qu'un `return true` non sécurisé.
   - Configurer `WAVE_WEBHOOK_SECRET`, `ORANGE_WEBHOOK_SECRET`, `MTN_MOMO_WEBHOOK_SECRET` avec le secret fourni par chaque fournisseur.
   - **`NODE_ENV=production`** sans ces secrets → webhook refusé (401), pour ne jamais accepter une fausse confirmation de paiement.
   - Hors production (secret non configuré) → accepté avec avertissement dans les logs, pour ne pas bloquer la démo en mode simulation.
2. **`JWT_SECRET` robuste obligatoire** (`src/utils/jwt.js`) — le serveur refuse de démarrer en `NODE_ENV=production` si `JWT_SECRET` est absent, trop court (<32 caractères), ou égal à une valeur par défaut connue. Générer une vraie valeur avec `openssl rand -hex 32`.
3. **Anti-abus sur l'envoi d'OTP** (`src/services/otpService.js` + `src/routes/auth.routes.js`) — cooldown de 60s entre deux demandes pour un même numéro, plafond de 5 codes/heure par numéro, et limite de 20 requêtes/heure par IP sur la route.

**Avant un vrai lancement avec paiements réels**, définir dans les variables Railway :
```
NODE_ENV=production
JWT_SECRET=<généré avec openssl rand -hex 32>
WAVE_WEBHOOK_SECRET=<fourni par Wave>
ORANGE_WEBHOOK_SECRET=<fourni par Orange>
MTN_MOMO_WEBHOOK_SECRET=<fourni par MTN>
```

D'autres points restent à traiter avant une mise en production à grande échelle : restreindre `CORS_ORIGIN` aux vrais domaines de l'app, envisager une révocation de token (liste noire ou durée de vie plus courte), journaliser les actions admin (qui a validé/rejeté quel chauffeur), et vérifier les obligations de l'ARTCI en matière de protection des données personnelles avant collecte à grande échelle.

## Déploiement sur Railway

1. Créer un nouveau projet Railway → **Deploy from GitHub repo** (pousser ce dossier sur un repo GitHub d'abord), ou **Empty Project** puis lier le repo ensuite.
2. Ajouter un plugin **PostgreSQL** au projet (Railway génère automatiquement `DATABASE_URL`).
3. Dans l'onglet **Variables** du service, ajouter les variables de `.env.example` (au minimum `JWT_SECRET`).
4. Une fois déployé, exécuter la migration une première fois :
   - Ouvrir un terminal Railway (`railway run npm run migrate`), ou
   - Ajouter temporairement `npm run migrate &&` avant `npm start` dans le script `start` de `package.json` pour le tout premier déploiement.
5. Railway détecte automatiquement `npm start` comme commande de démarrage.

## Mode simulation (sans les vraies clés API)

Tant que `WAVE_API_KEY`, `ORANGE_MONEY_API_KEY`, `MTN_MOMO_API_KEY` et `SMS_PROVIDER` ne sont pas renseignées, le backend fonctionne en **mode simulation** :
- Les codes OTP sont journalisés dans les logs serveur au lieu d'être envoyés par SMS.
- Les paiements Wave/Orange Money/MTN MoMo sont automatiquement marqués comme réussis.

Cela permet de tester tout le parcours (inscription, course, paiement) de bout en bout avant même d'avoir les comptes marchands. Voir les fichiers dans `src/services/paymentProviders/` pour brancher les vraies API le moment venu — chaque fichier contient le code réel en commentaire, prêt à activer.

## Structure du projet

```
src/
  server.js              Point d'entrée (Express + Socket.IO)
  db/
    schema.sql            Schéma PostgreSQL complet
    migrate.js             Script d'application du schéma
    pool.js                 Connexion PostgreSQL
  middleware/
    auth.js                 Vérification JWT + rôles
    errorHandler.js          Gestion centralisée des erreurs
  controllers/
    authController.js        Inscription/connexion par OTP
    driverController.js       Profil, disponibilité, position, gains
    rideController.js          Cycle de vie complet d'une course
    paymentController.js       Webhooks paiement + retraits chauffeur
    ratingController.js        Évaluations
  services/
    otpService.js             Génération/vérification OTP
    matchingService.js         Recherche du chauffeur le plus proche
    paymentService.js          Routage vers le bon fournisseur de paiement
    paymentProviders/
      wave.js, orangeMoney.js, mtnMomo.js
  routes/                   Définition des routes Express par domaine
  sockets/
    index.js                 Temps réel (rooms par utilisateur/course)
  utils/
    fare.js                   Calcul distance (Haversine) + tarif + commission
    jwt.js                     Signature/vérification des tokens
```

## Principaux endpoints

| Méthode | Route | Description |
|---|---|---|
| POST | `/api/auth/otp/request` | Demande un code OTP par SMS |
| POST | `/api/auth/otp/verify` | Vérifie le code, crée le compte si besoin, retourne une session (jeton d'accès 15 min + refresh token) |
| POST | `/api/auth/refresh` | Échange un refresh token valide contre un nouveau jeton d'accès (rotation) |
| POST | `/api/auth/logout` | Révoque la session courante (déconnexion de cet appareil) |
| POST | `/api/auth/logout-all` | Révoque toutes les sessions de l'utilisateur (tous appareils) |
| POST | `/api/rides/estimate` | Estime le tarif d'un trajet |
| POST | `/api/rides` | Passager : demande une course (déclenche le matching) |
| POST | `/api/rides/:id/accept` | Chauffeur : accepte une course |
| POST | `/api/rides/:id/arrived` | Chauffeur : signale son arrivée |
| POST | `/api/rides/:id/start` | Chauffeur : démarre la course |
| POST | `/api/rides/:id/complete` | Chauffeur : clôture la course + déclenche le paiement |
| POST | `/api/drivers/me/availability` | Chauffeur : passe en ligne/hors ligne |
| POST | `/api/payments/payout` | Chauffeur : demande un retrait de ses gains |
| POST | `/api/ratings` | Note un chauffeur/passager après une course |
| GET | `/api/me/data` | Export de toutes les données personnelles détenues (droit d'accès) |
| DELETE | `/api/me` | Anonymisation du compte (droit à l'effacement) |
| POST | `/api/admin/login` | Connexion administrateur (téléphone + mot de passe) |
| GET | `/api/admin/stats` | Statistiques (courses, revenus, commissions) |
| GET | `/api/admin/drivers` | Liste des chauffeurs (filtrable par statut KYC) |
| POST | `/api/admin/drivers/:id/kyc` | Valide/rejette un dossier chauffeur |
| GET | `/api/admin/rides` | Supervision des courses (filtrable par statut) |
| GET | `/api/admin/audit-logs` | Journal des actions administrateur (qui a fait quoi, quand) |

## Sessions et déconnexion (révocation)

Depuis la dernière itération sécurité, l'authentification repose sur deux jetons :

- **Jeton d'accès** (JWT, 15 minutes) — envoyé dans l'en-tête `Authorization: Bearer <token>` de chaque requête protégée. Volontairement de courte durée : un jeton volé n'est exploitable que brièvement.
- **Refresh token** (opaque, 30 jours) — stocké côté client, échangé via `POST /api/auth/refresh` pour obtenir un nouveau jeton d'accès. Stocké en base sous forme de hash (`refresh_tokens`), donc **révocable individuellement** (`/api/auth/logout`) ou **globalement** (`/api/auth/logout-all`), contrairement à un JWT classique.

Chaque client (MVP passager/chauffeur, back-office) doit donc : stocker les deux jetons reçus à la connexion, rafraîchir l'accessToken via `/api/auth/refresh` quand une requête échoue en 401, et appeler `/api/auth/logout` à la déconnexion.

## Alignement avec le cahier des charges

- **Modèle chauffeur indépendant** (section 3) : chaque chauffeur a un `user_id` unique, aucune notion de flotte tierce dans le schéma. Commission unique et modifiable par chauffeur (`commission_rate`), calculée et affichée à chaque course.
- **Paiement post-paiement** : la commission est prélevée automatiquement à la clôture de chaque course (`completeRide`), pas de prépaiement requis pour recevoir des courses.
- **KYC obligatoire avant mise en ligne** : un chauffeur avec `kyc_status != 'approved'` ne peut pas passer en ligne (vérifié côté serveur, pas seulement côté client).

## Prochaines étapes suggérées

1. Tester le parcours complet en mode simulation (Postman/Insomnia ou en connectant le prototype MVP HTML).
2. Créer les comptes marchands Wave / Orange Money / MTN MoMo, puis activer les vraies clés API.
3. Ajouter un panel admin (validation KYC, supervision des courses) — non inclus dans cette V1 backend.
4. Envisager PostGIS si le nombre de chauffeurs actifs dépasse quelques centaines (le matching actuel calcule les distances en mémoire).
