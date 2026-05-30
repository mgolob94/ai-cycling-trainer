const express = require('express');
const router = express.Router();

const requireAuth = require('../middleware/auth');
const periodizationController = require('../controllers/periodizationController');

// Mounted at /periodization (see index.js).
router.get('/plan', requireAuth, periodizationController.plan);

module.exports = router;
