const {
  searchUserVideos: getYoutubeVideos,
} = require('../services/youtube');

const {
  getInstagramPosts,
} = require('../services/instagram');

const {
  getTwitterPosts,
} = require('../services/twitter');

// Ajoute les autres imports ici

exports.getSocialData = async (req, res) => {
  const { username } = req.query;

  try {
    const [youtube, instagram, twitter] = await Promise.all([
      getYoutubeVideos(username),
      getInstagramPosts(username),
      getTwitterPosts(username),
      // Tu peux ajouter les autres ici
    ]);

    res.json({
      youtube,
      instagram,
      twitter,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erreur lors de la récupération des données' });
  }
};