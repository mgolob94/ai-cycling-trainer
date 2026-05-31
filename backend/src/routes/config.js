const express = require('express');
const router = express.Router();

const featureFlags = require('../config/featureFlags');

// GET /config/flags — public; the mobile app fetches this on startup to decide
// which screens/features are visible. No auth (flags aren't user-specific).
router.get('/flags', async (req, res, next) => {
  try {
    const flags = await featureFlags.getAllFlags();
    res.json({ success: true, data: flags, error: null });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
