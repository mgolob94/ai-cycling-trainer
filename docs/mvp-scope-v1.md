# AI Cycling Trainer — Poenostavljen MVP Scope

**Verzija:** v1.0 MVP
**Cilj:** Ena stvar narejena izjemno dobro.
**Core loop:** Povezi Strava → Dobiš plan → Treniraj → Dobiš feedback

---

## CORE LOOP (3 koraki)

```
1. POVEZI STRAVA
       ↓
2. AI GENERIRA TEDENSKI PLAN
   (glede na tvoje vožnje + forma + recovery)
       ↓
3. TRENIRAJ + OCENI
   (po vožnji: kako je šlo?)
       ↓
   nazaj na 2 (plan se izboljša)
```

---

## V1.0 — KAR GRADIMO

### Zasloni (6 total):

| Zaslon | Namen |
|---|---|
| Onboarding | Registracija + profil + Strava connect |
| Dashboard | Forma danes + ta teden |
| Trening detail | Kaj in zakaj danes |
| Vožnje | Seznam sinhroniziranih voženj |
| Napredek | FTP + CTL/ATL/TSB (plain language) |
| Profil | Nastavitve + coach stil |

---

### Funkcije v1.0:

**Strava:**
- ✓ OAuth connect
- ✓ Full initial sync (vse aktivnosti)
- ✓ Incremental sync (samo nove)
- ✓ Sync gumb

**AI Plan:**
- ✓ Tedenski plan (5-6 treningov)
- ✓ Recovery-aware (prilagodi glede na formo)
- ✓ Shranjen v cache/bazo
- ✓ Coach personality (Motivator / Scientist / Minimalist)

**Recovery:**
- ✓ Morning check-in (5 emoji — brez naprave)
- ✓ Recovery score (0–100) iz check-in + ATL
- ✓ Plain language status ("Optimalna forma")

**Feedback loop:**
- ✓ Post-workout survey (3 vprašanja po vožnji)
- ✓ AI upošteva feedback pri naslednjem planu

**Metrike:**
- ✓ FTP (iz Strava podatkov — Coggan metoda)
- ✓ CTL / ATL / TSB (iz celotne zgodovine)
- ✓ Plain language za vse vrednosti
- ✓ Progresivno razkrivanje (beginner / intermediate / advanced)

**Notifikacije:**
- ✓ Jutranja pripravljenost (1x/dan)
- ✓ Tedenski pregled (nedelja zvečer)
- ✓ Milestone (PR, FTP test)

**UI:**
- ✓ Svetla tema z auto dark mode (preklop: svetla / samodejno / temna)
- ✓ Primarna barva: Vijolična / Indigo (#4F46E5)
- ✓ React Native (iOS + Android)
- ✓ Supabase backend
- ✓ Docker deployment

---

## DESIGN TOKENS (vijolična tema)

### Barve:

| Token | Vrednost | Uporaba |
|---|---|---|
| primary | #4F46E5 | Gumbi, CTA, aktivni tab |
| primary-light | #818CF8 | Ikone, poudarki |
| primary-dark | #1E1B4B | Hero kartica ozadje |
| primary-tint | #EEF2FF | Ozadje badge, surface tint |
| success | #10B981 | Pozitivni trendi, PR |
| warning | #F59E0B | Utrujenost, opozorila |
| danger | #F43F5E | Preobremenitev, napake |
| info | #0EA5E9 | Informacije |
| text-primary | #1E1B4B (light) / #EEF2FF (dark) | Glavni tekst |
| text-secondary | #4338CA (light) / #A5B4FC (dark) | Sekundarni tekst |
| text-tertiary | #818CF8 | Nalepke, meta |
| background | #F8F7FF (light) / #0C0B1A (dark) | Ozadje strani |
| surface | #FFFFFF (light) / #13112B (dark) | Kartice |
| surface-2 | #F1F0FF (light) / #1A1840 (dark) | Sekundarne kartice |
| border | #E0E7FF (light) / #2D2A5E (dark) | Robovi |

### Dark mode:
- Način: samodejno (sledi sistemski nastavitvi)
- Ročni preklop: v profilu → nastavitve → Videz
- Opcije: Svetla / Samodejno / Temna
- Shrani v AsyncStorage

### Zone barve (neodvisne od teme):
| Cona | Barva |
|---|---|
| Z1 Počitek | #CBD5E1 |
| Z2 Vzdržljivost | #818CF8 (indigo) |
| Z3 Tempo | #34D399 |
| Z4 Prag | #F59E0B |
| Z5 VO2max | #F97316 |
| Z6 Anaerobno | #F43F5E |

---

## V1.1 — KAR PRIDE KASNEJE

| Funkcija | Zakaj čaka |
|---|---|
| Apple Health / Garmin / Whoop | Potreben iOS device build |
| HRV trend analiza | Ni podatkov brez naprave |
| Power Duration Curve | Napredno — za power userje |
| W' kalkulator | Napredno |
| Coach chat | Zahteva več AI tokenov |
| Mesečni pregled | Ni podatkov v prvem mesecu |
| Jedilnik / prehrana | Ločena domena |
| Subscription billing | Po validaciji |
| Periodizacija | Po prvem FTP testu |

---

## TECH STACK (nespremenjen)

| Layer | Tech |
|---|---|
| Mobile | React Native (Expo) |
| Backend | Node.js (Express) |
| Database + Auth | Supabase |
| AI | OpenAI GPT-4o |
| Strava | OAuth 2.0 + REST API |
| Deployment | Docker (self-hosted) |

---

## TIMELINE (6 tednov)

| Teden | Fokus |
|---|---|
| 1 | Setup + Supabase schema + Strava OAuth |
| 2 | Strava full sync + metrics (CTL/ATL/TSB) |
| 3 | AI plan generator + cache sistem |
| 4 | Mobile zasloni (Dashboard + Plan) |
| 5 | Recovery check-in + post-workout survey |
| 6 | Notifikacije + UI polish + dark mode + beta test |

---

## USPEŠNOST V1.0

Aplikacija je uspešna če:
- Uporabnik poveže Strava in dobi plan v < 5 minutah
- Plan se prilagodi glede na recovery (zjutraj check-in)
- Po vožnji dobi smiselni feedback
- Naslednji teden je plan boljši kot prejšnji
- UI deluje v svetli in temni temi

---

## KAR NE GRADIMO V V1.0

- ❌ Social features
- ❌ Skupinski treningi
- ❌ Video vsebina
- ❌ Zwift / Garmin integracija
- ❌ Web verzija
- ❌ Coach marketplace
- ❌ Stripe billing

---

## DOCS MAPA (referenca)

Vsi podrobni promti so v `/docs`:

| Datoteka | Vsebina |
|---|---|
| `CLAUDE.md` | Projektni kontekst za Claude Code |
| `prompts-sledenje-napredku.md` | CTL/ATL/TSB, FTP, PR |
| `prompts-strava-sync.md` | Full + incremental sync |
| `prompts-ai-cache.md` | Cache sistem za AI analize |
| `prompts-ui-design-sistem.md` | Design tokens, komponente |
| `prompts-razumljive-metrike.md` | Plain language metrike |
| `prompts-progresivno-razkrivanje.md` | 3-nivo prikaz |
| `prompts-recovery.md` | Recovery score, morning check-in |
| `prompts-mock-data.md` | Dev brez iOS naprave |
| `prompts-ai-coach-core.md` | AI plan, feedback loop, notifikacije |

Za v1.0 uporabi samo promte označene z ✓ v tem dokumentu.
Ostale datoteke so pripravljene za v1.1+
