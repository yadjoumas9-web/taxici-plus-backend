require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { Server } = require('socket.io');

const errorHandler = require('./middleware/errorHandler');
const { initSockets } = require('./sockets');
const { buildCorsOptions } = require('./config/cors');

const authRoutes = require('./routes/auth.routes');
const driverRoutes = require('./routes/drivers.routes');
const rideRoutes = require('./routes/rides.routes');
const paymentRoutes = require('./routes/payments.routes');
const ratingRoutes = require('./routes/ratings.routes');
const adminRoutes = require('./routes/admin.routes');
const privacyRoutes = require('./routes/privacy.routes');

const app = express();
const server = http.createServer(app);

// Railway (et la plupart des hébergeurs) place l'app derrière un proxy inverse :
// sans ce réglage, req.ip renverrait l'IP du proxy pour toutes les requêtes,
// ce qui invaliderait les limites de débit par IP (OTP, login admin, etc.).
app.set('trust proxy', 1);

const corsOptions = buildCorsOptions();

const io = new Server(server, { cors: corsOptions });
app.set('io', io); // accessible dans les contrôleurs via req.app.get('io')

// ---------- Middleware globaux ----------
app.use(helmet());
app.use(cors(corsOptions));
// On conserve le corps brut de la requête (avant parsing JSON) pour permettre
// la vérification cryptographique des signatures de webhooks paiement.
app.use(express.json({
  verify: (req, res, buf) => { req.rawBody = buf; },
}));

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api', apiLimiter);

// ---------- Routes ----------
app.get('/', (req, res) => {
  res.json({ service: 'TaxiCI+ API', status: 'ok', version: '1.0.0' });
});
app.get('/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

app.use('/api/auth', authRoutes);
app.use('/api/drivers', driverRoutes);
app.use('/api/rides', rideRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/ratings', ratingRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/me', privacyRoutes);

app.use((req, res) => res.status(404).json({ error: 'Route introuvable.' }));

// Erreurs CORS (origine refusée) : réponse claire plutôt qu'un plantage générique.
app.use((err, req, res, next) => {
  if (err && err.message && err.message.startsWith('Origine non autorisée')) {
    return res.status(403).json({ error: err.message });
  }
  next(err);
});
app.use(errorHandler);

// ---------- WebSocket ----------
initSockets(io);

// ---------- Démarrage ----------
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`[TaxiCI+] API démarrée sur le port ${PORT}`);
});
