const express = require('express');
const path = require('path');

const router = express.Router();

// Serve static files from the "../yogo" directory
router.use('/', (req, res, next) => {
    const currentDate = new Date();
    const targetDate = new Date('December 28, 2023');
    
    if (currentDate >= targetDate) {
        res.status(410);
        res.send('Expired link');
    } else {
        express.static(path.join(__dirname, '..', 'yogo'))(req, res, next);
    }
});

module.exports = router;
