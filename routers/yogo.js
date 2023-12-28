const express = require('express');
const path = require('path');

const router = express.Router();

// Serve static files from the "../yogo" directory
router.use('/', express.static(path.join(__dirname, '..', 'yogo')));


module.exports = router;
