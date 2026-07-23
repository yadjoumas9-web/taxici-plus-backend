const router = require('express').Router();
const {
  getMyProfile, updateMyProfile, setAvailability, updateLocation, getEarnings, getHistory,
} = require('../controllers/driverController');
const { requireAuth, requireRole } = require('../middleware/auth');

router.use(requireAuth, requireRole('driver'));

router.get('/me', getMyProfile);
router.put('/me', updateMyProfile);
router.post('/me/availability', setAvailability);
router.post('/me/location', updateLocation);
router.get('/me/earnings', getEarnings);
router.get('/me/history', getHistory);

module.exports = router;
