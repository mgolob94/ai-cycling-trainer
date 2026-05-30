const pdc = require('../services/pdc');
const metrics = require('../services/metrics');

/** GET /pdc/alltime — the user's all-time power-duration curve. */
async function alltime(req, res, next) {
  try {
    const data = await pdc.getAllTime(req.user.id);
    res.json({ success: true, data, error: null });
  } catch (err) {
    next(err);
  }
}

/** GET /pdc/seasonal — PDC for the current season (Jan 1 → today). */
async function seasonal(req, res, next) {
  try {
    const seasonStart = `${new Date().getUTCFullYear()}-01-01`;
    const data = await pdc.computeFromRides(req.user.id, seasonStart);
    res.json({ success: true, data, error: null });
  } catch (err) {
    next(err);
  }
}

/** GET /pdc/compare?weeks=12 — recent (last N weeks) vs all-time. */
async function compare(req, res, next) {
  try {
    const weeks = Math.min(Math.max(parseInt(req.query.weeks, 10) || 12, 1), 52);
    const since = new Date();
    since.setUTCDate(since.getUTCDate() - weeks * 7);
    const sinceDate = since.toISOString().slice(0, 10);

    const [allTime, recent] = await Promise.all([
      pdc.getAllTime(req.user.id),
      pdc.computeFromRides(req.user.id, sinceDate),
    ]);

    res.json({ success: true, data: { alltime: allTime, recent }, error: null });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /pdc/recalculate — kick off a full PDC recompute from all rides in the
 * background and return 202 immediately.
 */
function recalculate(req, res) {
  const userId = req.user.id;

  // Simple background job: recompute every ride's power metrics (re-fetching
  // streams) and rebuild power_duration_bests. Runs after the response.
  setImmediate(() => {
    metrics
      .recalcAllRidesPower(userId, { onlyMissing: false, limit: 500 })
      .then((r) => console.log(`[pdc] recalculation done for ${userId}:`, r))
      .catch((e) => console.warn('[pdc] recalculation failed:', e.message));
  });

  res.status(202).json({ success: true, data: { started: true }, error: null });
}

module.exports = { alltime, seasonal, compare, recalculate };
