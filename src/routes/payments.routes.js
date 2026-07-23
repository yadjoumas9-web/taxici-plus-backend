const router = require('express').Router();
const { waveWebhook, orangeWebhook, momoWebhook, requestPayout } = require('../controllers/paymentController');
const { requireAuth, requireRole } = require('../middleware/auth');

router.post('/webhook/wave', waveWebhook);
router.post('/webhook/orange', orangeWebhook);
router.post('/webhook/momo', momoWebhook);

router.post('/payout', requireAuth, requireRole('driver'), requestPayout);

module.exports = router;
