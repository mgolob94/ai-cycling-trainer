const express = require('express');
const router = express.Router();

const requireAuth = require('../middleware/auth');
const ridesController = require('../controllers/ridesController');

router.get('/', requireAuth, ridesController.listRides);
router.get('/latest', requireAuth, ridesController.getLatestRide);
router.post('/:strava_id/analyze', requireAuth, ridesController.analyze);
router.post('/:strava_id/feedback', requireAuth, ridesController.feedback);
router.get('/:strava_id/feedback', requireAuth, ridesController.getFeedback);

module.exports = router;
