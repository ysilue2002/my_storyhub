const axios = require('axios');

async function getLinkedInProfile(username) {
  const ACCESS_TOKEN = process.env.LINKEDIN_ACCESS_TOKEN;
  const response = await axios.get(
    `https://api.linkedin.com/v2/people/(id:${username})`, 
    {
      headers: { Authorization: `Bearer ${ACCESS_TOKEN}` },
    }
  );
  return response.data;
}

module.exports = { getLinkedInProfile };