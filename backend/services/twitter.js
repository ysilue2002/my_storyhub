const axios = require('axios');

async function getTwitterPosts(username) {
  const BEARER_TOKEN = process.env.TWITTER_BEARER_TOKEN;
  const response = await axios.get(
    `https://api.twitter.com/2/users/by/username/${username}`, 
    {
      headers: { Authorization: `Bearer ${BEARER_TOKEN}` },
    }
  );

  const userId = response.data.data.id;

  const tweetsResponse = await axios.get(
    `https://api.twitter.com/2/users/${userId}/tweets`, 
    {
      headers: { Authorization: `Bearer ${BEARER_TOKEN}` },
    }
  );

  return tweetsResponse.data.data || [];
}

module.exports = { getTwitterPosts };