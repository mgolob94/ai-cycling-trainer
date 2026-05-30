const express = require('express');
const router = express.Router();

const requireAuth = require('../middleware/auth');
const recordsController = require('../controllers/recordsController');

// Mounted at /records (see index.js).
router.get('/', requireAuth, recordsController.getAll);
router.post('/scan', requireAuth, recordsController.scan);

module.exports = router;
