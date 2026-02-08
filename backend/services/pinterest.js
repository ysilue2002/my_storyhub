const axios = require('axios');

async function getPinterestPins(username) {
  const ACCESS_TOKEN = process.env.PINTEREST_ACCESS_TOKEN;
  const response = await axios.get(
    `https://api.pinterest.com/v5/pins?owner=${username}`,
    {
      headers: { Authorization: `Bearer ${ACCESS_TOKEN}` },
    }
  );
  return response.data.items || [];
}

module.exports = { getPinterestPins };