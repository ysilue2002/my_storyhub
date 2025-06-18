const axios = require('axios');

async function getTikTokVideos(creatorId) {
  const ACCESS_TOKEN = process.env.TIKTOK_ACCESS_TOKEN;
  const response = await axios.get(
    `https://open-api.tiktok.com/business-api/creative/get/?access_token=${ACCESS_TOKEN}&advertiser_id=${creatorId}`
  );
  return response.data.list || [];
}

module.exports = { getTikTokVideos };