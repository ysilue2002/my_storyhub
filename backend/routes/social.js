// backend/routes/social.js
const express = require('express');
const axios = require('axios');
const router = express.Router();

router.get('/instagram/:username', async (req, res) => {
  try {
    const response = await axios.get(`https://api.instagram.com/v1/users/${req.params.username}`); 
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: 'Erreur lors de la récupération des données' });
  }
});

module.exports = router;