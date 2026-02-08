const axios = require('axios');

async function getTumblrPosts(blogName) {
  const CONSUMER_KEY = process.env.TUMBLR_CONSUMER_KEY;
  const response = await axios.get(
    `https://${blogName}.tumblr.com/api/read/json?consumer_key=${CONSUMER_KEY}`
  );
  return response.data.posts || [];
}

module.exports = { getTumblrPosts };