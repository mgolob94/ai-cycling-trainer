const express = require('express');
const router = express.Router();

const requireAuth = require('../middleware/auth');
const pdcController = require('../controllers/pdcController');

// Mounted at /pdc (see index.js).
router.get('/alltime', requireAuth, pdcController.alltime);
router.get('/seasonal', requireAuth, pdcController.seasonal);
router.get('/compare', requireAuth, pdcController.compare);
router.post('/recalculate', requireAuth, pdcController.recalculate);

module.exports = router;
