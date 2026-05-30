const ftp = require('../services/ftp');

/**
 * POST /ftp/calculate — estimate FTP from the user's last 90 days of rides,
 * persist it to ftp_tests, and return the result.
 */
async function calculate(req, res, next) {
  try {
    // Estimated from existing rides, so re-running with unchanged data yields
    // the same value — only record a new test row when it actually changes.
    const result = await ftp.recalculateForUser(req.user.id, { recordOnlyIfChanged: true });

    if (!result) {
      return res.status(422).json({
        success: false,
        data: null,
        error:
          'Not enough power data to estimate FTP — need at least one ride of 20+ minutes with power in the last 90 days.',
      });
    }

    res.status(201).json({ success: true, data: result, error: null });
  } catch (err) {
    next(err);
  }
}

/** GET /ftp/latest — the user's most recent FTP test. */
async function latest(req, res, next) {
  try {
    const data = await ftp.getLatest(req.user.id);
    res.json({ success: true, data, error: null });
  } catch (err) {
    next(err);
  }
}

/** GET /ftp/history — all of the user's FTP tests, oldest first. */
async function history(req, res, next) {
  try {
    const data = await ftp.getHistory(req.user.id);
    res.json({ success: true, data, error: null });
  } catch (err) {
    next(err);
  }
}

module.exports = { calculate, latest, history };
