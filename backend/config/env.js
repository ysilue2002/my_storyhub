// backend/config/env.js
require('dotenv').config();

module.exports = {
  PORT: process.env.PORT || 3001,
  YOUTUBE_API_KEY: process.env.YOUTUBE_API_KEY,
  INSTAGRAM_TOKEN: process.env.INSTAGRAM_ACCESS_TOKEN,
  TWITTER_BEARER_TOKEN: process.env.TWITTER_BEARER_TOKEN,
  // Ajoute les autres ici
};