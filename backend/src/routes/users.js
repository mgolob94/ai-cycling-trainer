const express = require('express');
const router = express.Router();

const requireAuth = require('../middleware/auth');
const usersController = require('../controllers/usersController');

router.get('/me', requireAuth, usersController.getProfile);
router.patch('/me', requireAuth, usersController.updateProfile);
router.post('/push-token', requireAuth, usersController.registerPushToken);

module.exports = router;
