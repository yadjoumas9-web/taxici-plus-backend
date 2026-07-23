const router = require('express').Router();
const rateLimit = require('express-rate-limit');
const { requestOtpCode, verifyOtpCode, refresh, logout, logoutAll, me } = require('../controllers/authController');
const { requireAuth } = require('../middleware/auth');

const otpRequestLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de demandes de code depuis cette connexion. Réessayez plus tard.' },
});

const otpVerifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de tentatives. Réessayez dans quelques minutes.' },
});

router.post('/otp/request', otpRequestLimiter, requestOtpCode);
router.post('/otp/verify', otpVerifyLimiter, verifyOtpCode);
router.post('/refresh', refresh);
router.post('/logout', logout);
router.post('/logout-all', requireAuth, logoutAll);
router.get('/me', requireAuth, me);

module.exports = router;
