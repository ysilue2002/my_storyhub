const axios = require('axios');

async function getTwitchStream(username) {
  const CLIENT_ID = process.env.TWITCH_CLIENT_ID;
  const ACCESS_TOKEN = process.env.TWITCH_ACCESS_TOKEN;

  const userRes = await axios.get(
    `https://api.twitch.tv/helix/users?login=${username}`,
    {
      headers: {
        'Client-ID': CLIENT_ID,
        'Authorization': `Bearer ${ACCESS_TOKEN}`,
      },
    }
  );

  const user = userRes.data.data[0];
  if (!user) return [];

  const streamRes = await axios.get(
    `https://api.twitch.tv/helix/streams?user_id=${user.id}`,
    {
      headers: {
        'Client-ID': CLIENT_ID,
        'Authorization': `Bearer ${ACCESS_TOKEN}`,
      },
    }
  );

  return streamRes.data.data || [];
}

module.exports = { getTwitchStream };