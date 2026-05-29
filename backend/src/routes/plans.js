const express = require('express');
const router = express.Router();

const requireAuth = require('../middleware/auth');
const plansController = require('../controllers/plansController');

router.get('/', requireAuth, plansController.listPlans);
router.get('/current', requireAuth, plansController.getCurrentPlan);
router.post('/generate', requireAuth, plansController.generatePlan);

module.exports = router;
