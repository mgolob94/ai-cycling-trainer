const ftp = require('../services/ftp');

/**
 * POST /ftp/calculate — estimate FTP from the user's last 90 days of rides,
 * persist it to ftp_tests, and return the result.
 */
async function calculate(req, res, next) {
  try {
    const result = await ftp.recalculateForUser(req.user.id);

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

module.exports = { calculate };
