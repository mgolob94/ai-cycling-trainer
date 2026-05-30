const records = require('../services/records');

/** GET /records — the user's current personal records. */
async function getAll(req, res, next) {
  try {
    const data = await records.getRecords(req.user.id);
    res.json({ success: true, data, error: null });
  } catch (err) {
    next(err);
  }
}

/** POST /records/scan — rescan all rides and update records, then return them. */
async function scan(req, res, next) {
  try {
    const data = await records.scanAndUpsert(req.user.id);
    res.json({ success: true, data, error: null });
  } catch (err) {
    next(err);
  }
}

module.exports = { getAll, scan };
