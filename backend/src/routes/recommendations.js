const express = require('express');
const router = express.Router();

const requireAuth = require('../middleware/auth');
const recommendationsController = require('../controllers/recommendationsController');

// Mounted at /recommendations (see index.js).
router.get('/', requireAuth, recommendationsController.get);

module.exports = router;
