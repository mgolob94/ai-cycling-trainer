const express = require('express');
const router = express.Router();

const requireAuth = require('../middleware/auth');
const stravaController = require('../controllers/stravaController');

// Mounted at /auth/strava (see index.js).

// OAuth flow — browser navigations, so auth is resolved inside the handlers.
router.get('/', stravaController.authorize); // GET /auth/strava
router.get('/callback', stravaController.callback); // GET /auth/strava/callback

// Ride sync — protected API call from the app.
router.post('/sync', requireAuth, stravaController.syncRides);

// Strava push subscription (webhooks for new rides).
router.get('/webhook', stravaController.verifyWebhook);
router.post('/webhook', stravaController.handleWebhook);

module.exports = router;
