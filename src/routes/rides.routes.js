const router = require('express').Router();
const {
  estimateFare, requestRide, acceptRide, refuseRide,
  markArrived, startRide, completeRide, cancelRide, getRide, getMyHistory,
} = require('../controllers/rideController');
const { requireAuth, requireRole } = require('../middleware/auth');

router.post('/estimate', requireAuth, estimateFare);
router.post('/', requireAuth, requireRole('passenger'), requestRide);
router.get('/history', requireAuth, requireRole('passenger'), getMyHistory);
router.get('/:id', requireAuth, getRide);

router.post('/:id/accept', requireAuth, requireRole('driver'), acceptRide);
router.post('/:id/refuse', requireAuth, requireRole('driver'), refuseRide);
router.post('/:id/arrived', requireAuth, requireRole('driver'), markArrived);
router.post('/:id/start', requireAuth, requireRole('driver'), startRide);
router.post('/:id/complete', requireAuth, requireRole('driver'), completeRide);
router.post('/:id/cancel', requireAuth, cancelRide);

module.exports = router;
