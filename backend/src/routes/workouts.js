const express = require('express');
const router = express.Router();

const requireAuth = require('../middleware/auth');
const workoutController = require('../controllers/workoutController');

// Mounted at /workouts (see index.js).
router.post('/feedback', requireAuth, workoutController.feedback);

module.exports = router;
