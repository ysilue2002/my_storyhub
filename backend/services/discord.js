const axios = require('axios');

async function getDiscordUser(userId) {
  const TOKEN = process.env.DISCORD_BOT_TOKEN;
  const response = await axios.get(
    `https://discord.com/api/users/${userId}`, 
    {
      headers: {
        Authorization: `Bot ${TOKEN}`,
      },
    }
  );
  return response.data;
}

module.exports = { getDiscordUser };