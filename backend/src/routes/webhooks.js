const express = require('express');
const router = express.Router();

const stravaController = require('../controllers/stravaController');

// Mounted at /webhooks (see index.js). Public — no auth (Strava calls these).
router.get('/strava', stravaController.verifyWebhook);
router.post('/strava', stravaController.handleWebhook);

module.exports = router;
