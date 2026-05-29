const express = require('express');
const router = express.Router();

const requireAuth = require('../middleware/auth');
const stravaController = require('../controllers/stravaController');

// OAuth flow
router.get('/authorize', requireAuth, stravaController.authorize);
router.get('/callback', stravaController.callback);

// Ride sync
router.post('/sync', requireAuth, stravaController.syncRides);

// Webhook subscription (Strava push events)
router.get('/webhook', stravaController.verifyWebhook);
router.post('/webhook', stravaController.handleWebhook);

module.exports = router;
