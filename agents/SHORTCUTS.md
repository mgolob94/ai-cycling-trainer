# SHORTCUTS.md — Kōda Claude Code Shortcuts

Copy-paste these into Claude Code terminal.
Always run from project root: `cd koda/ && claude`

---

## 🚀 SESSION START

### New session — full context load
```
Read CLAUDE.md and docs/MASTER-PROMPT.md. Give me a summary of what's built, what's missing, and suggest the next 3 tasks.
```

### Check project status
```
Read CLAUDE.md and scan the entire project structure. Tell me which features from mvp-scope-v2.md are completed and which are still missing.
```

---

## 🏗️ DEV AGENT

### Start dev session
```
Read CLAUDE.md and docs/agents/AGENT-DEV.md. You are the Dev agent for this session.
```

### Build next feature (week 1)
```
Read CLAUDE.md and docs/agents/AGENT-DEV.md, then implement: project setup, Supabase client, auth middleware, and .env.example from docs/prompts-strava-sync.md prompt 1.
```

### Build Strava sync
```
Read CLAUDE.md and docs/agents/AGENT-DEV.md, then implement the full Strava sync engine from docs/prompts-strava-sync.md prompts 2 through 5.
```

### Build phase engine + AI plan
```
Read CLAUDE.md and docs/agents/AGENT-DEV.md, then implement the phase engine and weekly plan generator from docs/prompts-unified-plan.md prompts 1 through 3.
```

### Build nutrition + strength plan
```
Read CLAUDE.md and docs/agents/AGENT-DEV.md, then implement nutrition and strength plan generators from docs/prompts-nutrition-strength.md prompts 1 through 4.
```

### Build AI cache system
```
Read CLAUDE.md and docs/agents/AGENT-DEV.md, then implement the full AI cache system from docs/prompts-ai-cache.md prompts 1 through 4.
```

### Build Dashboard screen
```
Read CLAUDE.md and docs/agents/AGENT-DEV.md and docs/ui-copy.md and docs/prompts-design-athletic.md. Build DashboardScreen.tsx following the design spec in prompt 3.
```

### Build Plan screen
```
Read CLAUDE.md and docs/agents/AGENT-DEV.md and docs/ui-copy.md, then build PlanScreen.tsx from docs/prompts-unified-plan.md prompt 4.
```

### Build Ride Detail screen
```
Read CLAUDE.md and docs/agents/AGENT-DEV.md and docs/ui-copy.md and docs/prompts-design-athletic.md. Build RideDetailScreen.tsx following the design spec in prompt 2.
```

### Build Progress screen
```
Read CLAUDE.md and docs/agents/AGENT-DEV.md and docs/ui-copy.md and docs/prompts-design-athletic.md. Build ProgressScreen.tsx following the design spec in prompt 4.
```

### Build Nutrition screen
```
Read CLAUDE.md and docs/agents/AGENT-DEV.md and docs/ui-copy.md, then build NutritionScreen.tsx from docs/prompts-nutrition-strength.md prompt 6.
```

### Build design system (fonts + tokens)
```
Read CLAUDE.md and docs/agents/AGENT-DEV.md and docs/prompts-design-athletic.md. Implement prompts 0 through 5: design tokens, typography, theme provider, and core UI components.
```

### Build progressive disclosure
```
Read CLAUDE.md and docs/agents/AGENT-DEV.md, then implement the progressive disclosure system from docs/prompts-progresivno-razkrivanje.md prompts 1 through 4.
```

### Build notifications
```
Read CLAUDE.md and docs/agents/AGENT-DEV.md, then implement the notification engine from docs/prompts-ai-coach-core.md prompts 6 and 9.
```

### Build mock data system
```
Read CLAUDE.md and docs/agents/AGENT-DEV.md, then implement the full mock data system from docs/prompts-mock-data.md prompts 1 through 4.
```

### Build recovery (background only)
```
Read CLAUDE.md and docs/agents/AGENT-DEV.md, then implement recovery background services from docs/prompts-recovery-hidden.md prompts 1 through 5. UI stays hidden — feature flag recovery_screen=false.
```

### Add feature flag system
```
Read CLAUDE.md and docs/agents/AGENT-DEV.md, then implement the feature flag system from docs/prompts-recovery-hidden.md prompt 7.
```

---

## 🗄️ DB AGENT

### Start DB session
```
Read CLAUDE.md and docs/agents/AGENT-DB.md. You are the DB agent for this session.
```

### Create all migrations
```
Read CLAUDE.md and docs/agents/AGENT-DB.md. Create all missing Supabase migrations for every table in the CLAUDE.md Database Schema section. Check which tables already exist first.
```

### Create single migration
```
Read CLAUDE.md and docs/agents/AGENT-DB.md. Create a new migration for the [TABLE NAME] table as defined in CLAUDE.md.
```

### Seed feature flags
```
Read CLAUDE.md and docs/agents/AGENT-DB.md. Insert all feature flags from CLAUDE.md into the feature_flags table with correct default values.
```

### Validate schema
```
Read CLAUDE.md and docs/agents/AGENT-DB.md. Compare the CLAUDE.md Database Schema section against the actual Supabase tables and report any discrepancies.
```

### Add RLS to all tables
```
Read CLAUDE.md and docs/agents/AGENT-DB.md. Verify RLS is enabled on every table and add any missing policies.
```

---

## 🧪 TEST AGENT

### Start test session
```
Read CLAUDE.md and docs/agents/AGENT-TEST.md. You are the Test agent for this session.
```

### Write all critical tests
```
Read CLAUDE.md and docs/agents/AGENT-TEST.md. Write unit tests for all critical services: phaseEngine, recoveryScore, metrics, ftp, aiCache, stravaSync.
```

### Test a specific service
```
Read CLAUDE.md and docs/agents/AGENT-TEST.md. Write comprehensive unit tests for backend/src/services/[SERVICE NAME].js.
```

### Run all tests + report
```
Read CLAUDE.md and docs/agents/AGENT-TEST.md. Run all tests and give me a full report: passed, failed, coverage, and what to fix first.
```

### Write E2E test
```
Read CLAUDE.md and docs/agents/AGENT-TEST.md. Write an E2E test for the core loop: Strava connect → plan generation → post-workout feedback.
```

---

## 🚢 DEPLOY AGENT

### Start deploy session
```
Read CLAUDE.md and docs/agents/AGENT-DEPLOY.md. You are the Deploy agent for this session.
```

### First-time server setup
```
Read CLAUDE.md and docs/agents/AGENT-DEPLOY.md. Walk me through the complete first-time server setup checklist step by step.
```

### Verify deployment
```
Read CLAUDE.md and docs/agents/AGENT-DEPLOY.md. Run the full deployment verification checklist and tell me what's missing or broken.
```

### Deploy Edge Functions
```
Read CLAUDE.md and docs/agents/AGENT-DEPLOY.md. Deploy and schedule the daily-recovery and notification-scheduler Supabase Edge Functions.
```

### Register Strava webhook
```
Read CLAUDE.md and docs/agents/AGENT-DEPLOY.md. Register the Strava webhook for the production URL [YOUR URL].
```

### Check env variables
```
Read CLAUDE.md and docs/agents/AGENT-DEPLOY.md. Check that all required environment variables from .env.example are set and not empty.
```

---

## 🔍 REVIEW AGENT

### Review a file
```
Read CLAUDE.md and docs/agents/AGENT-REVIEW-DEBUG-DOCS.md acting as Review Agent. Review [FILE PATH] and give me the full review report.
```

### Review everything built today
```
Read CLAUDE.md and docs/agents/AGENT-REVIEW-DEBUG-DOCS.md acting as Review Agent. Review all files modified today and give me a priority list of what to fix.
```

### Security check
```
Read CLAUDE.md and docs/agents/AGENT-REVIEW-DEBUG-DOCS.md acting as Review Agent. Run a security check on the entire backend — focus on auth, RLS, and exposed secrets.
```

---

## 🐛 DEBUG AGENT

### Debug a bug
```
Read CLAUDE.md and docs/agents/AGENT-REVIEW-DEBUG-DOCS.md acting as Debug Agent. Bug: [DESCRIBE WHAT'S WRONG]. Find the root cause and fix it.
```

### Common bugs — quick shortcuts

**Plan not generating:**
```
Read CLAUDE.md and docs/agents/AGENT-REVIEW-DEBUG-DOCS.md acting as Debug Agent. The weekly plan is not generating. Check phaseEngine, aiCache, and OpenAI connection. Find and fix the issue.
```

**Strava sync failing:**
```
Read CLAUDE.md and docs/agents/AGENT-REVIEW-DEBUG-DOCS.md acting as Debug Agent. Strava sync is failing. Check token expiry, rate limits, and sync_status in the DB. Find and fix the issue.
```

**Recovery score always 50:**
```
Read CLAUDE.md and docs/agents/AGENT-REVIEW-DEBUG-DOCS.md acting as Debug Agent. Recovery score always returns 50. Check hrv_readings data, baseline calculation, and subjective_feeling save logic.
```

**Mobile crash on startup:**
```
Read CLAUDE.md and docs/agents/AGENT-REVIEW-DEBUG-DOCS.md acting as Debug Agent. App crashes on startup. Check ThemeProvider setup, feature flag loading, and DataSource initialization.
```

---

## 📄 DOCS AGENT

### Docs health check
```
Read CLAUDE.md and docs/agents/AGENT-REVIEW-DEBUG-DOCS.md acting as Docs Agent. Run a full docs health check — compare CLAUDE.md against actual project files and report what's outdated.
```

### Update CLAUDE.md after big change
```
Read CLAUDE.md and docs/agents/AGENT-REVIEW-DEBUG-DOCS.md acting as Docs Agent. Update CLAUDE.md to reflect these changes: [LIST WHAT CHANGED].
```

### Update ui-copy.md
```
Read CLAUDE.md and docs/agents/AGENT-REVIEW-DEBUG-DOCS.md acting as Docs Agent. Add the following new copy to docs/ui-copy.md under the correct screen section: [DESCRIBE WHAT TO ADD].
```

---

## ⚡ QUICK TASKS (no agent needed)

### Seed mock data
```
Run: npm run seed
```

### Clear mock data
```
Run: npm run seed:clear
```

### Validate mock data
```
Run: npm run validate:mock
```

### Check which feature flags are active
```
Read CLAUDE.md. Show me the current state of all feature flags and which features are visible vs hidden.
```

### Enable recovery screen
```
Read CLAUDE.md and docs/agents/AGENT-DB.md. Set feature_flags.recovery_screen = true in Supabase. Then read docs/agents/AGENT-DEV.md and make RecoveryScreen visible in navigation.
```
