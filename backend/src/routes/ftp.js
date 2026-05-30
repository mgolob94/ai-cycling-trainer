const express = require('express');
const router = express.Router();

const requireAuth = require('../middleware/auth');
const ftpController = require('../controllers/ftpController');

// Mounted at /ftp (see index.js).
router.get('/latest', requireAuth, ftpController.latest);
router.get('/history', requireAuth, ftpController.history);
router.get('/test/protocols', requireAuth, ftpController.testProtocols);
router.post('/test/analyze', requireAuth, ftpController.testAnalyze);
router.post('/calculate', requireAuth, ftpController.calculate);

module.exports = router;
