const router = require('express').Router();
const rateLimit = require('express-rate-limit');
const { login, logout } = require('../controllers/adminAuthController');
const {
  getStats, listDrivers, updateKycStatus, updateCommissionRate,
  deactivateUser, reactivateUser, listRides, getRideDetail, getAuditLogs,
} = require('../controllers/adminController');
const { requireAuth, requireRole } = require('../middleware/auth');

const adminLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de tentatives de connexion. Réessayez dans quelques minutes.' },
});

router.post('/login', adminLoginLimiter, login);
router.post('/logout', logout);

router.use(requireAuth, requireRole('admin'));

router.get('/stats', getStats);

router.get('/drivers', listDrivers);
router.post('/drivers/:id/kyc', updateKycStatus);
router.post('/drivers/:id/commission', updateCommissionRate);

router.get('/rides', listRides);
router.get('/rides/:id', getRideDetail);

router.post('/users/:id/deactivate', deactivateUser);
router.post('/users/:id/reactivate', reactivateUser);

router.get('/audit-logs', getAuditLogs);

module.exports = router;
