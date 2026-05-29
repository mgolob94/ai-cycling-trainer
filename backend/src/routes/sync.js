const express = require('express');
const router = express.Router();

const requireAuth = require('../middleware/auth');
const stravaController = require('../controllers/stravaController');

// Mounted at /sync (see index.js).
// Alias for POST /auth/strava/sync, matching the mobile client's expected path.
router.post('/strava', requireAuth, stravaController.syncRides);

module.exports = router;
