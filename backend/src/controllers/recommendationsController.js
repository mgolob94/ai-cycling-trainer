const recommendations = require('../services/recommendations');

/** GET /recommendations — current rule-based recommendations for the user. */
async function get(req, res, next) {
  try {
    const data = await recommendations.generateRecommendations(req.user.id);
    res.json({ success: true, data, error: null });
  } catch (err) {
    next(err);
  }
}

module.exports = { get };
