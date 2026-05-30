const express = require('express');
const router = express.Router();

const requireAuth = require('../middleware/auth');
const cacheController = require('../controllers/cacheController');

// Mounted at root (see index.js) so paths are exact.
router.get('/cache/stats', requireAuth, cacheController.userStats);
router.get('/cache/entries', requireAuth, cacheController.entries);
router.delete('/cache/invalidate', requireAuth, cacheController.invalidate);

// Admin only (role checked in the controller).
router.get('/admin/cache/stats', requireAuth, cacheController.adminStats);

module.exports = router;
