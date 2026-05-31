const express = require('express');
const router = express.Router();

const requireAuth = require('../middleware/auth');
const goalsController = require('../controllers/goalsController');

// Mounted at /goals (see index.js).
router.get('/', requireAuth, goalsController.list);
router.post('/', requireAuth, goalsController.create);
router.post('/check-milestones', requireAuth, goalsController.checkMilestones);
router.post('/:id/insight', requireAuth, goalsController.insight);
router.patch('/:id', requireAuth, goalsController.update);

module.exports = router;
