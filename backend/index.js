require('dotenv').config();

const express = require('express');
const cors = require('cors');

const stravaRoutes = require('./src/routes/strava');
const syncRoutes = require('./src/routes/sync');
const plansRoutes = require('./src/routes/plans');
const ridesRoutes = require('./src/routes/rides');
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

// Fallback 404 handler — keeps the standard response shape
app.use((req, res) => {
  res.status(404).json({ success: false, data: null, error: 'Not found' });
});

// Centralized error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({
    success: false,
    data: null,
    error: err.message || 'Internal server error',
  });
});

app.listen(PORT, () => {
  console.log(`Backend listening on port ${PORT} (${process.env.NODE_ENV || 'development'})`);
});

module.exports = app;
