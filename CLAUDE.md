# CLAUDE.md — AI Cycling Trainer App

This file provides context for Claude Code to understand the project structure, stack, and conventions.

---

## Project Overview

**App Name:** AI Cycling Trainer (working title)
**Type:** B2C Mobile App
**Platform:** iOS & Android (React Native)
**Goal:** Give cyclists an affordable AI personal trainer that generates personalized training plans based on their real Strava ride data, age, and fitness level.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Mobile Frontend | React Native |
| Backend API | Node.js (Express) or Python (FastAPI) |
| Database & Auth | Supabase (PostgreSQL + Auth) |
| AI / LLM | OpenAI API or open source model |
| Deployment | Docker (self-hosted) |
| External API | Strava API (OAuth 2.0) |

---

## Project Structure

```
/
├── mobile/                  # React Native app
│   ├── src/
│   │   ├── screens/         # App screens (Onboarding, Dashboard, Plan, Profile)
│   │   ├── components/      # Reusable UI components
│   │   ├── hooks/           # Custom React hooks
│   │   ├── services/        # API calls to backend
│   │   ├── navigation/      # React Navigation setup
│   │   └── store/           # State management (Zustand or Context)
│   └── App.tsx
│
├── backend/                 # API server
│   ├── src/
│   │   ├── routes/          # API routes
│   │   ├── controllers/     # Route handlers
│   │   ├── services/        # Business logic
│   │   │   ├── strava.js    # Strava API integration
│   │   │   ├── ai.js        # AI plan generation
│   │   │   └── plans.js     # Training plan logic
│   │   ├── middleware/      # Auth middleware
│   │   └── db/              # Supabase client
│   └── index.js
│
├── docker-compose.yml       # Docker setup
├── .env.example             # Environment variables template
└── CLAUDE.md                # This file
```

---

## Environment Variables

```env
# Supabase
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Strava
STRAVA_CLIENT_ID=
STRAVA_CLIENT_SECRET=
STRAVA_REDIRECT_URI=

# AI
OPENAI_API_KEY=

# App
PORT=3000
NODE_ENV=development
```

---

## Database Schema (Supabase)

### users
| Column | Type | Notes |
|---|---|---|
| id | uuid | Primary key |
| email | text | Unique |
| age | integer | |
| weight_kg | float | |
| fitness_level | text | beginner / intermediate / advanced |
| goal | text | endurance / speed / weight loss |
| created_at | timestamp | |

### strava_connections
| Column | Type | Notes |
|---|---|---|
| id | uuid | Primary key |
| user_id | uuid | FK → users |
| access_token | text | Encrypted |
| refresh_token | text | Encrypted |
| expires_at | timestamp | |

### rides
| Column | Type | Notes |
|---|---|---|
| id | uuid | Primary key |
| user_id | uuid | FK → users |
| strava_id | text | Strava activity ID |
| distance_km | float | |
| duration_sec | integer | |
| avg_power_w | float | |
| avg_heart_rate | float | |
| elevation_m | float | |
| ride_date | date | |

### training_plans
| Column | Type | Notes |
|---|---|---|
| id | uuid | Primary key |
| user_id | uuid | FK → users |
| week_start | date | |
| plan_json | jsonb | Full plan with workouts |
| generated_at | timestamp | |

---

## Key Features (MVP)

1. **User Onboarding** — Sign up, enter age/weight/fitness level/goal
2. **Strava OAuth** — Connect Strava account, pull ride history
3. **Strava Sync** — Auto-sync new rides via webhook or polling
4. **AI Training Plan** — Generate weekly plan using LLM based on ride data + profile
5. **Notifications** — Workout reminders, new plan alerts, ride synced alerts

---

## Strava API Integration

- Auth flow: OAuth 2.0 with PKCE
- Endpoints used:
  - `GET /athlete` — basic athlete info
  - `GET /athlete/activities` — ride history
  - `POST /push_subscriptions` — webhooks for new rides
- Tokens stored encrypted in `strava_connections` table
- Refresh tokens automatically before expiry

---

## AI Plan Generation

- Input to AI model:
  - User profile (age, weight, fitness level, goal)
  - Last 4 weeks of ride data (avg power, duration, distance, frequency)
- Output: structured weekly training plan in JSON
- Model: OpenAI GPT-4o or open source alternative (e.g. Mistral, LLaMA)
- Prompt lives in `backend/src/services/ai.js`

---

## Coding Conventions

- Use async/await throughout, no raw Promise chains
- All API responses follow `{ success, data, error }` format
- Environment variables never hardcoded
- Supabase RLS (Row Level Security) enabled on all tables
- React Native components in TypeScript
- Use Zustand for mobile state management

---

## Docker Setup

```yaml
# docker-compose.yml
services:
  backend:
    build: ./backend
    ports:
      - "3000:3000"
    env_file: .env
    restart: unless-stopped
```

---

## Useful Commands

```bash
# Start backend locally
cd backend && npm run dev

# Start mobile app
cd mobile && npx expo start

# Run with Docker
docker-compose up --build
```

---

## Future Roadmap (Post-MVP)
- Meal and nutrition plans
- Human coach marketplace
- Apple Health / Garmin Connect integration
- Group training and challenges
- Subscription billing (Stripe)
