const router = require('express').Router();
const { submitRating } = require('../controllers/ratingController');
const { requireAuth } = require('../middleware/auth');

router.post('/', requireAuth, submitRating);

module.exports = router;
