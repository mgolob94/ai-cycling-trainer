const express = require('express');
const router = express.Router();

const requireAuth = require('../middleware/auth');
const aiController = require('../controllers/aiController');

// Mounted at /ai (see index.js).
router.post('/weekly-summary', requireAuth, aiController.weeklySummary);
router.get('/week-analysis', requireAuth, aiController.weekAnalysis);
router.get('/trend', requireAuth, aiController.trend);

module.exports = router;
