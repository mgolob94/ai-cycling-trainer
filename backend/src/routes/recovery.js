const express = require('express');
const router = express.Router();

const requireAuth = require('../middleware/auth');
const recoveryController = require('../controllers/recoveryController');

// Mounted at /recovery (see index.js).
router.post('/calculate', requireAuth, recoveryController.calculate);
router.post('/check-in', requireAuth, recoveryController.checkIn);
router.get('/hrv/trend', requireAuth, recoveryController.hrvTrend);
// Batch (daily cron) — guarded by X-Cron-Secret, not user auth.
router.post('/calculate-all', recoveryController.calculateAll);

module.exports = router;
