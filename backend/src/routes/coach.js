const express = require('express');
const router = express.Router();

const requireAuth = require('../middleware/auth');
const coachController = require('../controllers/coachController');

// Mounted at /coach (see index.js).
router.post('/weekly-plan', requireAuth, coachController.weeklyPlan);
router.post('/checkin', requireAuth, coachController.checkin);
router.post('/message', requireAuth, coachController.message);

module.exports = router;
