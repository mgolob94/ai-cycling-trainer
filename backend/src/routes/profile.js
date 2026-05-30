const express = require('express');
const router = express.Router();

const requireAuth = require('../middleware/auth');
const profileController = require('../controllers/profileController');

// Mounted at /profile (see index.js).
router.get('/rider-type', requireAuth, profileController.riderType);

module.exports = router;
