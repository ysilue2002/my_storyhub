const axios = require('axios');

async function getInstagramPosts(username) {
  const ACCESS_TOKEN = process.env.INSTAGRAM_ACCESS_TOKEN;
  const response = await axios.get(
    `https://graph.instagram.com/v20.0/me/media?fields=id,media_type,media_url,caption&access_token=${ACCESS_TOKEN}`
  );
  return response.data.items || [];
}

module.exports = { getInstagramPosts };