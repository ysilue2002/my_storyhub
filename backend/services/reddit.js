const axios = require('axios');
const { REDDIT_CLIENT_ID, REDDIT_CLIENT_SECRET, REDDIT_USER_AGENT } = process.env;

async function getRedditPosts(username) {
  const auth = Buffer.from(`${REDDIT_CLIENT_ID}:${REDDIT_CLIENT_SECRET}`).toString('base64');

  const tokenRes = await axios.post(
    'https://www.reddit.com/api/v1/access_token', 
    'grant_type=password&username=' + username + '&password=not_used',
    {
      headers: {
        Authorization: `Basic ${auth}`,
        'User-Agent': REDDIT_USER_AGENT,
      },
    }
  );

  const accessToken = tokenRes.data.access_token;

  const postsRes = await axios.get(`https://oauth.reddit.com/u/${username}/about`,  {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  return postsRes.data.data.children || [];
}

module.exports = { getRedditPosts };