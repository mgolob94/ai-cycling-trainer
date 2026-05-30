const express = require('express');
const router = express.Router();

const requireAuth = require('../middleware/auth');
const stravaController = require('../controllers/stravaController');
const syncController = require('../controllers/syncController');

// Mounted at /sync (see index.js).
// Alias for POST /auth/strava/sync, matching the mobile client's expected path.
router.post('/strava', requireAuth, stravaController.syncRides);

// Full + incremental sync engine endpoints.
router.post('/initial', requireAuth, syncController.initial);
router.post('/manual', requireAuth, syncController.manual);
router.get('/status', requireAuth, syncController.status);
router.get('/history', requireAuth, syncController.history);

module.exports = router;
