const express = require('express');
const router = express.Router();

const requireAuth = require('../middleware/auth');
const coachController = require('../controllers/coachController');

// Mounted at /coach (see index.js).
router.post('/weekly-plan', requireAuth, coachController.weeklyPlan);
// POST /coach/message (conversational chat) is added in the chat prompt.

module.exports = router;
