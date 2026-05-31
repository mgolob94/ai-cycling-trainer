const express = require('express');
const router = express.Router();

const requireAuth = require('../middleware/auth');
const progressMonitor = require('../services/progressMonitor');

// Mounted at /progress (see index.js).
router.post('/monthly-review', requireAuth, async (req, res, next) => {
  try {
    const month = req.body?.month; // optional 'YYYY-MM'
    const review = await progressMonitor.generateMonthlyReview(req.user.id, month || undefined);
    res.json({ success: true, data: review, error: null });
  } catch (err) {
    next(err);
  }
});

// Batch (1st-of-month cron) — guarded by X-Cron-Secret.
router.post('/monthly-review-all', async (req, res, next) => {
  try {
    const secret = process.env.CRON_SECRET;
    if (!secret || req.get('x-cron-secret') !== secret) {
      return res.status(401).json({ success: false, data: null, error: 'Unauthorized' });
    }
    const result = await progressMonitor.generateForAllUsers(req.body?.month || undefined);
    res.json({ success: true, data: result, error: null });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
