const express = require('express');
const router = express.Router();

const requireAuth = require('../middleware/auth');
const plansController = require('../controllers/plansController');

router.get('/', requireAuth, plansController.listPlans);
router.get('/current', requireAuth, plansController.getCurrentPlan);
router.get('/phase', requireAuth, plansController.getPhase);
router.post('/generate', requireAuth, plansController.generatePlan);
router.post('/event', requireAuth, plansController.setEvent);

module.exports = router;
