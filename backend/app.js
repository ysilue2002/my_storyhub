const express = require('express');
const app = express();
const socialRoutes = require('./routes/socialRoutes');

app.use(express.json());
app.use('/api', socialRoutes);

module.exports = app;