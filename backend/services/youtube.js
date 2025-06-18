const axios = require('axios');

async function searchUserVideos(username) {
  const API_KEY = process.env.YOUTUBE_API_KEY;
  const response = await axios.get(
    `https://www.googleapis.com/youtube/v3/channels?forUsername=${username}&key=${API_KEY}`
  );
  return response.data.items || [];
}

module.exports = { searchUserVideos };