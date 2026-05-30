// Load the repo-root .env regardless of the working directory, so both
// `npm run dev` (from backend/) and `node backend/index.js` (from root) work.
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const express = require('express');
const cors = require('cors');

const stravaRoutes = require('./src/routes/strava');
const syncRoutes = require('./src/routes/sync');
const plansRoutes = require('./src/routes/plans');
const ridesRoutes = require('./src/routes/rides');
const ftpRoutes = require('./src/routes/ftp');
const metricsRoutes = require('./src/routes/metrics');
const recordsRoutes = require('./src/routes/records');
const aiRoutes = require('./src/routes/ai');
const pdcRoutes = require('./src/routes/pdc');
const recommendationsRoutes = require('./src/routes/recommendations');
const periodizationRoutes = require('./src/routes/periodization');
const profileRoutes = require('./src/routes/profile');
const cacheRoutes = require('./src/routes/cache');
const webhookRoutes = require('./src/routes/webhooks');
const usersRoutes = require('./src/routes/users');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ success: true, data: { status: 'ok' }, error: null });
});

app.use('/api/users', usersRoutes);
app.use('/auth/strava', stravaRoutes);
app.use('/sync', syncRoutes);
app.use('/api/plans', plansRoutes);
app.use('/api/rides', ridesRoutes);
app.use('/ftp', ftpRoutes);
app.use('/metrics', metricsRoutes);
app.use('/records', recordsRoutes);
app.use('/ai', aiRoutes);
app.use('/pdc', pdcRoutes);
app.use('/recommendations', recommendationsRoutes);
app.use('/periodization', periodizationRoutes);
app.use('/profile', profileRoutes);
app.use(cacheRoutes);
app.use('/webhooks', webhookRoutes);

// Fallback 404 handler — keeps the standard response shape
app.use((req, res) => {
  res.status(404).json({ success: false, data: null, error: 'Not found' });
});

// Centralized error handler. Use only a status we set intentionally
// (err.statusCode) — never err.status, which axios copies from upstream
// responses and would leak a third party's status as if it were ours.
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.statusCode || 500).json({
    success: false,
    data: null,
    error: err.message || 'Internal server error',
  });
});

// Only start listening when run directly (e.g. `node index.js`), not when the
// app is imported by tests via supertest.
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Backend listening on port ${PORT} (${process.env.NODE_ENV || 'development'})`);
  });
}

module.exports = app;
