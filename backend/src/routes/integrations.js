const express = require('express');
const router = express.Router();

const requireAuth = require('../middleware/auth');
const garminController = require('../controllers/garminController');

// Mounted at /integrations (see index.js).
// Garmin OAuth 1.0a — auth/callback are browser redirects (token via query param
// / Garmin redirect), so they are not behind requireAuth.
router.get('/garmin/auth', garminController.auth);
router.get('/garmin/callback', garminController.callback);
router.post('/garmin/sync', requireAuth, garminController.sync);

module.exports = router;
