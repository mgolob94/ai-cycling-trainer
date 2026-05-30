const express = require('express');
const router = express.Router();

const requireAuth = require('../middleware/auth');
const garminController = require('../controllers/garminController');
const whoopController = require('../controllers/whoopController');

// Mounted at /integrations (see index.js).
// OAuth auth/callback are browser redirects (token via query param / provider
// redirect), so they are not behind requireAuth; sync is.
router.get('/garmin/auth', garminController.auth);
router.get('/garmin/callback', garminController.callback);
router.post('/garmin/sync', requireAuth, garminController.sync);

router.get('/whoop/auth', whoopController.auth);
router.get('/whoop/callback', whoopController.callback);
router.post('/whoop/sync', requireAuth, whoopController.sync);

module.exports = router;
