const express = require('express');
const router = express.Router();

const requireAuth = require('../middleware/auth');
const metricsController = require('../controllers/metricsController');

// Mounted at /metrics (see index.js).
router.get('/weekly', requireAuth, metricsController.weekly);

module.exports = router;
