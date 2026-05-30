const express = require('express');
const router = express.Router();

const requireAuth = require('../middleware/auth');
const ftpController = require('../controllers/ftpController');

// Mounted at /ftp (see index.js).
router.get('/latest', requireAuth, ftpController.latest);
router.get('/history', requireAuth, ftpController.history);
router.post('/calculate', requireAuth, ftpController.calculate);

module.exports = router;
