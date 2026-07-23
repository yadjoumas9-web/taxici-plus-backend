const router = require('express').Router();
const { exportMyData, deleteMyAccount } = require('../controllers/privacyController');
const { requireAuth } = require('../middleware/auth');

router.get('/data', requireAuth, exportMyData);
router.delete('/', requireAuth, deleteMyAccount);

module.exports = router;
