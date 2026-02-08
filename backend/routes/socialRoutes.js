const express = require('express');
const router = express.Router();
const socialController = require('../controllers/socialController');

router.get('/search', socialController.getSocialData);

module.exports = router;