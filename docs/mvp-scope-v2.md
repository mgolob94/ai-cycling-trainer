# Kōda — v2.0 Scope (Smer C: All-in-one)

**Pozicija:** The only cycling app that grows with you.
**Ciljna publika:** Začetniki → Amaterji → Izkušeni (ne pro)
**Core loop:** Connect Strava → Get full plan (training + nutrition + strength) → Train → Feedback → Plan gets smarter

---

## FILOZOFIJA

En app. En account. UI se prilagodi glede na nivo uporabnika.
Začetnik vidi plain language. Amater vidi številke. Izkušen vidi vse.
Recovery je implementiran v ozadju — UI pride ko bodo API-ji odobreni.

---

## KAR GRADIMO V V1.0

### 1. Training Plan
- ✅ Personalized weekly plan (Strava history + fitness + goal)
- ✅ Phase engine: Base → Build → Peak (auto ali event-driven)
- ✅ Daily adaptations — plan se prilagodi če izpustiš trening
- ✅ Availability updates — spremeni teden, plan se takoj prilagodi
- ✅ Structured workouts — cilj, trajanje, cona, razlog
- ✅ Key workout of the week

### 2. Nutrition Plan
- ✅ Weekly fueling guide generiran skupaj s treningom
- ✅ Prilagodi se obremenitvi — več goriva na težkih tednih
- ✅ Meal timing per day (pred/med/po vožnji)
- ✅ Plain language — praktično, brez macro obsessing

### 3. Strength Plan
- ✅ 2x tedensko off-bike strength sessions
- ✅ Cycling-specific: glutes, core, hip flexors, lower back
- ✅ Prilagodi se fazi — lažje v peak/taper tednih
- ✅ Integriran v tedenski urnik — ne kolide z key ride dnevi

### 4. Fitness Tracking
- ✅ Strava full sync (vsa zgodovinska aktivnost)
- ✅ Incremental sync (samo nove vožnje)
- ✅ CTL / ATL / TSB iz celotne zgodovine
- ✅ FTP auto-update (Coggan metoda iz Strava podatkov)
- ✅ Progressive disclosure (beginner → intermediate → advanced)

### 5. Post-Workout Feedback
- ✅ 3-vprašalni survey 30min po Strava syncu
- ✅ AI coach feedback — kako ta vožnja ustreza napredku
- ✅ Feedback vpliva na naslednji teden

### 6. Recovery — IMPLEMENTIRANO, UI SKRIT
- ✅ Morning check-in (5 emoji) — shrani v DB, vpliva na plan
- ✅ Recovery score iz check-in + ATL — izračun teče v ozadju
- ✅ Apple Health sync (HRV + spanec) — implementirano, podatki se shranjujejo
- ✅ Plan se prilagodi glede na recovery score — tiho, brez UI razlage
- 🙈 Recovery zaslon — SKRIT dokler niso odobreni Garmin/Whoop API-ji
- ❌ Garmin / Whoop — čakamo na API approval

### 7. Notifications
- ✅ Jutranja pripravljenost (daily, contextual)
- ✅ Tedenski recap (nedelja)
- ✅ Milestones (PR, FTP, streaks)
- ✅ Phase transitions
- ✅ Max 2/dan, quiet hours, brez guilt

### 8. UI
- ✅ React Native (iOS + Android)
- ✅ Light tema z auto dark mode
- ✅ Emerald green primary / true black dark
- ✅ Progressive disclosure (3 nivoji)
- ✅ Grows with user — UI se prilagodi knowledge levelu

---

## 7 ZASLONOV

| Zaslon | Vsebina |
|---|---|
| Dashboard | Forma + ta teden (trening + quick nutrition) |
| Plan | Faza + tedenski treningi + strength sessions + zgodovina |
| Ride Detail | Stats + AI coach feedback + zone breakdown |
| Progress | FTP + CTL/ATL/TSB + personal records |
| Nutrition | Tedenski fueling guide + meal timing |
| Profile | Coach stil, availability, nivo, tema |
| Recovery | **SKRIT** — implementiran, ne viden |

---

## KAR NI V V1.0

| Funkcija | Status |
|---|---|
| Recovery UI zaslon | Implementiran, skrit — pride z Garmin/Whoop |
| Garmin / Wahoo / Zwift / Rouvy | Čaka API approval |
| Coach chat | Po validaciji core loopa |
| Mesečni pregled | Ni podatkov v prvem mesecu |
| Subscription billing | Po validaciji |
| Power Duration Curve / W' | v1.1 |
| Social features | Out of scope |
| Web app | Mobile first |

---

## STACK

| Layer | Tech |
|---|---|
| Mobile | React Native (Expo) |
| Backend | Node.js (Express) |
| Database + Auth | Supabase |
| AI | OpenAI GPT-4o |
| Health data | Apple HealthKit (expo-health) |
| Activity data | Strava API |
| Deployment | Docker (self-hosted) |

---

## TIMELINE (8 tednov)

| Teden | Fokus |
|---|---|
| 1 | Setup + Supabase schema + Strava OAuth |
| 2 | Strava full sync + CTL/ATL/TSB + FTP |
| 3 | Phase engine + AI plan generator + cache |
| 4 | Nutrition plan + strength plan generator |
| 5 | Dashboard + Plan screen + Workout detail |
| 6 | Nutrition screen + post-workout survey |
| 7 | Apple Health (HRV/sleep) + morning check-in (hidden recovery) |
| 8 | Notifications + progressive disclosure + polish + beta |

---

## SUCCESS CRITERIA V1.0

- Strava connect → prvi plan v < 5 minutah
- Plan vključuje trening + nutrition + strength — v eni app
- Začetnik razume vse brez razlage
- Po 2 tednih: plan se vidno razlikuje od tedna 1
- Po 4 tednih: FTP recalculated, plan v drugačni fazi
- Recovery teče v ozadju — plan se prilagodi tiho
