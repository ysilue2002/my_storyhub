const axios = require('axios');

async function getFacebookPosts(pageId) {
  const ACCESS_TOKEN = process.env.FACEBOOK_ACCESS_TOKEN;
  const response = await axios.get(
    `https://graph.facebook.com/${pageId}/posts?access_token=${ACCESS_TOKEN}`
  );
  return response.data.data || [];
}

module.exports = { getFacebookPosts };