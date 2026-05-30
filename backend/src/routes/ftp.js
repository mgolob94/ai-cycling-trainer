const express = require('express');
const router = express.Router();

const requireAuth = require('../middleware/auth');
const ftpController = require('../controllers/ftpController');

// Mounted at /ftp (see index.js).
router.post('/calculate', requireAuth, ftpController.calculate);

module.exports = router;
