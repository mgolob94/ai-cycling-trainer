# AI Cycling Trainer

A B2C mobile app that gives cyclists an affordable AI personal trainer. It
generates personalized weekly training plans from a rider's real Strava data,
age, and fitness level.

See [CLAUDE.md](./CLAUDE.md) for the full project spec, schema, and conventions.

## Repository layout

```
backend/    Node.js + Express API (Strava OAuth, sync, AI plan generation)
mobile/     React Native (Expo) app
supabase/   SQL migrations (schema, RLS, triggers)
```

## Local development

1. Copy environment variables and fill them in (see
   [Configuration](#configuration-environment-variables) below):
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

## API overview

All responses follow the `{ success, data, error }` shape.

| Method | Route | Description |
|---|---|---|
| GET | `/health` | Liveness check (used by the Docker health check) |
| GET / PATCH | `/api/users/me` | Read / update the signed-in user's profile |
| POST | `/api/users/push-token` | Register a device push token |
| GET | `/api/rides` | Recent rides |
| GET | `/api/rides/latest` | Most recent ride |
| GET | `/api/plans/current` | Current week's plan |
| POST | `/api/plans/generate` | Generate a new AI plan |
| GET | `/auth/strava` | Begin Strava OAuth (redirect) |
| GET | `/auth/strava/callback` | Strava OAuth callback (browser) |
| POST | `/auth/strava/callback` | App-driven OAuth: exchange code |
| GET | `/auth/strava/athlete` | Connection status + Strava profile |
| POST | `/sync/strava` | Pull recent rides from Strava |
| GET / POST | `/auth/strava/webhook` | Strava push subscription |

---

# Production deployment (self-hosted, Docker Compose)

This deploys the **backend API** to any server with Docker installed
(a $5–10/month VPS is plenty). Supabase (database + auth) and the AI provider
are managed services you point the backend at; you do not host them yourself.

## Prerequisites

- A Linux server with a public IP and SSH access.
- [Docker Engine](https://docs.docker.com/engine/install/) and the Docker
  Compose plugin installed.
- A domain name pointed at the server (recommended, required for Strava OAuth
  over HTTPS).

## 1. Set up Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. Apply the database schema. Either:
   - **Dashboard:** open **SQL Editor → New query**, then paste and run each
     file in [`supabase/migrations/`](./supabase/migrations) in filename order
     (they are timestamp-prefixed), **or**
   - **CLI:**
     ```bash
     npm i -g supabase
     supabase login
     supabase link --project-ref <your-project-ref>
     supabase db push
     ```
3. Grab your keys from **Project Settings → API**:
   - **Project URL** → `SUPABASE_URL`
   - **`anon` public** key → `SUPABASE_ANON_KEY`
   - **`service_role`** key → `SUPABASE_SERVICE_ROLE_KEY` (secret — backend only)
   - **JWT Settings → JWT Secret** → `SUPABASE_JWT_SECRET`

The migrations enable Row Level Security and add a trigger that auto-creates a
`public.users` profile row on sign-up.

## 2. Get Strava API credentials

1. Go to [strava.com/settings/api](https://www.strava.com/settings/api) and
   create an application.
2. Note the **Client ID** (`STRAVA_CLIENT_ID`) and **Client Secret**
   (`STRAVA_CLIENT_SECRET`).
3. Set the **Authorization Callback Domain** to your server's domain
   (e.g. `api.yourdomain.com`) — without scheme or path.
4. Set `STRAVA_REDIRECT_URI` to your public callback URL, e.g.
   `https://api.yourdomain.com/auth/strava/callback`.

## 3. Get an AI provider key

Create an API key at [platform.openai.com](https://platform.openai.com/api-keys)
and set it as `OPENAI_API_KEY`.

## 4. Configure environment variables

On the server, clone the repo and create the `.env` file from the template:

```bash
git clone https://github.com/mgolob94/ai-cycling-trainer.git
cd ai-cycling-trainer
cp .env.example .env
```

Then edit `.env`:

| Variable | Required | Notes |
|---|---|---|
| `SUPABASE_URL` | ✅ | Project URL |
| `SUPABASE_ANON_KEY` | ✅ | Public anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Secret — never expose to clients |
| `SUPABASE_JWT_SECRET` | ✅ | Verifies auth tokens locally |
| `STRAVA_CLIENT_ID` | ✅ | From the Strava app |
| `STRAVA_CLIENT_SECRET` | ✅ | From the Strava app |
| `STRAVA_REDIRECT_URI` | ✅ | Public HTTPS callback URL |
| `TOKEN_ENCRYPTION_KEY` | ✅ | AES-256 key — `openssl rand -hex 32` |
| `OPENAI_API_KEY` | ✅ | AI plan generation |
| `PORT` | ➖ | Host port to publish (default `3000`) |
| `NODE_ENV` | ➖ | Set to `production` |
| `APP_OAUTH_SUCCESS_REDIRECT` | ➖ | Deep link back into the app after connect |

Generate the token encryption key:

```bash
openssl rand -hex 32
```

> Keep `.env` out of version control (it already is via `.gitignore`).

## 5. Build and run

```bash
docker compose up -d --build
```

This builds the multi-stage backend image and starts the service with a restart
policy of `unless-stopped`, so it survives crashes and server reboots.

Check status and health:

```bash
docker compose ps          # STATUS should show "healthy" after ~10s
curl http://localhost:3000/health
# {"success":true,"data":{"status":"ok"},"error":null}
```

View logs:

```bash
docker compose logs -f backend
```

## 6. Put it behind HTTPS (recommended)

The container serves plain HTTP on the published port. For a public deployment,
run a reverse proxy (Caddy, Nginx, or Traefik) in front to terminate TLS and
forward to the backend. Example with Caddy:

```
api.yourdomain.com {
    reverse_proxy localhost:3000
}
```

Caddy provisions and renews Let's Encrypt certificates automatically. Strava
OAuth requires HTTPS, so this step is effectively mandatory for production.

## Updating a deployment

```bash
git pull
docker compose up -d --build
```

## Operations cheatsheet

| Task | Command |
|---|---|
| Start | `docker compose up -d` |
| Stop | `docker compose down` |
| Rebuild + restart | `docker compose up -d --build` |
| Logs | `docker compose logs -f backend` |
| Health/status | `docker compose ps` |
| Shell into container | `docker compose exec backend sh` |
