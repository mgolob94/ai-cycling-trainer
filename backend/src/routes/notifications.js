const express = require('express');
const router = express.Router();

const requireAuth = require('../middleware/auth');
const notificationsController = require('../controllers/notificationsController');

// Mounted at /notifications (see index.js).
router.post('/register', requireAuth, notificationsController.register);
// Batch send (15-min cron) — guarded by X-Cron-Secret, not user auth.
router.post('/run', notificationsController.run);

module.exports = router;
