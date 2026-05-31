# Claude Code Prompts — Progressive Disclosure of Metrics

The app meets each rider at their level and grows with them. Three knowledge
levels control UI density; the level is self-reported at onboarding and only
ever auto-upgrades from behaviour (never silently downgrades).

Knowledge levels:
- **beginner** — plain language only, no raw numbers
- **intermediate** — plain language + expandable numbers on tap
- **advanced** — numbers by default, plain language as subtitle

Stored in `users.knowledge_level` (+ AsyncStorage for instant/offline reads).

---

## 1. USER LEVEL SERVICE

```
Read CLAUDE.md and docs/agents/AGENT-DEV.md.

Create mobile/src/services/userLevel.ts.

API:
  getKnowledgeLevel(userId?): Promise<KnowledgeLevel>
  setKnowledgeLevel(userId, level): Promise<void>
  trackInteraction(userId, interaction): Promise<KnowledgeLevel>  // may auto-upgrade
  getLevelConfig(level): LevelConfig

LevelConfig:
  showRawNumbers: boolean
  showTooltipHints: boolean
  defaultExpanded: boolean
  showPowerCurve: boolean
  showWPrime: boolean

Persistence:
  - AsyncStorage (fast, offline) is the local source of truth
  - mirror to Supabase users.knowledge_level (cross-device, best-effort)
  - level only ever rises, never silently downgrades

Also export a KnowledgeLevelContext (provider + useKnowledgeLevel hook) so any
screen can read { level, config, setLevel, track } without prop-drilling.
Everything else in this doc depends on this prompt — build it first.
```

---

## 2. PROGRESSIVE STAT CARD

```
Read CLAUDE.md and docs/agents/AGENT-DEV.md.

Create mobile/src/components/metrics/ProgressiveStatCard.tsx.

Props: { metric, value, unit, interpretation, context, tooltipContent }

Behaviour by level:
  Level 1 (beginner):     plain-language `interpretation` only + a "Show more" tap
  Level 2 (intermediate): expands to show the number + unit, with an ⓘ button
  Level 3 (advanced):     ⓘ opens the MetricTooltip bottom sheet

Transitions: ~300ms spring on expand/collapse.
Call trackInteraction on expand ('show_more') and on opening the tooltip
('tooltip') so the level can auto-upgrade from real use.
```

---

## 3. DASHBOARD HERO CARD

```
Read CLAUDE.md and docs/ui-copy.md.

Update DashboardScreen hero (form-today) card for progressive disclosure.

  Beginner:     "Optimal." + advice line + scale bar + plain trend chips
                + a "Details" CTA
  Intermediate: same, and expanding reveals CTL / ATL / TSB numbers each with an ⓘ
  Advanced:     numbers visible by default

Expand state is session-only (not persisted) for beginners, so they re-collapse
on next launch; advanced users default to expanded.
```

---

## 4. RIDE DETAIL SCREEN

```
Read CLAUDE.md and docs/ui-copy.md.

Update RideDetailScreen for progressive disclosure.

  Beginner:     distance / duration + a plain-language summary + effort stars (1–5)
                + zone names only (no Z-numbers)
  Intermediate: adds NP / VI / EF / TSS cards + zone numbers
  Advanced:     full detail — power-stream chart + W′ balance

Effort stars from TSS:
  0–50 = 1★, 50–100 = 2★, 100–150 = 3★, 150–200 = 4★, 200+ = 5★
```

---

## 5. PROGRESS SCREEN

```
Read CLAUDE.md and docs/ui-copy.md.

Update ProgressScreen for progressive disclosure.

  Beginner:     FTP in plain words + fitness in plain words + chart with no Y axis
  Intermediate: adds CTL / ATL / TSB numbers + the Y axis
  Advanced:     all numbers + Power Duration Curve unlocked

Provide a small manual level toggle in the header (subtle, textDim).
```

---

## 6. ONBOARDING — KNOWLEDGE LEVEL SELECTION

```
Already handled in docs/prompts-onboarding.md prompt 7.

Implemented as KnowledgeLevelScreen.tsx (self-report during onboarding, written
via setKnowledgeLevel). Skip if already done.
```

---

## 7. PROFILE — DATA DISPLAY LEVEL

```
Read CLAUDE.md and docs/ui-copy.md.

Add a "Data display" row to ProfileScreen settings.

  - Tapping it opens a modal with 3 radio options (beginner / intermediate /
    advanced), each with a one-line description of what it shows.
  - Selecting saves via setKnowledgeLevel (AsyncStorage + Supabase).
  - Show a small hint that tapping ⓘ on any metric explains it (and that the
    level adapts automatically as you explore).
```
