const express = require('express');
const router = express.Router();

const requireAuth = require('../middleware/auth');
const trainingController = require('../controllers/trainingController');

// Mounted at /training (see index.js).
router.post('/adapt-for-recovery', requireAuth, trainingController.adaptForRecovery);
// Batch (daily 07:00 cron) — guarded by X-Cron-Secret, not user auth.
router.post('/adapt-for-recovery-all', trainingController.adaptForRecoveryAll);

module.exports = router;
