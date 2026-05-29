# AI Cycling Trainer

A B2C mobile app that gives cyclists an affordable AI personal trainer. It
generates personalized weekly training plans from a rider's real Strava data,
age, and fitness level.

See [CLAUDE.md](./CLAUDE.md) for the full project spec, schema, and conventions.

## Repository layout

```
backend/    Node.js + Express API (Strava OAuth, sync, AI plan generation)
mobile/     React Native (Expo) app
```

## Getting started

1. Copy environment variables and fill them in:
   ```bash
   cp .env.example .env
   ```

2. Backend:
   ```bash
   cd backend
   npm install
   npm run dev          # starts on http://localhost:3000
   ```

3. Mobile app:
   ```bash
   cd mobile
   npm install
   npx expo start
   ```

4. Or run the backend with Docker:
   ```bash
   docker-compose up --build
   ```

## API overview

All responses follow the `{ success, data, error }` shape.

| Method | Route | Description |
|---|---|---|
| GET | `/health` | Liveness check |
| GET/PATCH | `/api/users/me` | Read / update the signed-in user's profile |
| GET | `/api/strava/authorize` | Get the Strava OAuth consent URL |
| GET | `/api/strava/callback` | OAuth callback — stores tokens |
| POST | `/api/strava/sync` | Pull recent rides from Strava |
| GET/POST | `/api/strava/webhook` | Strava push subscription |
| GET | `/api/plans/current` | Current week's plan |
| POST | `/api/plans/generate` | Generate a new AI plan |
