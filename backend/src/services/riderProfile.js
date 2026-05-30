// Comprehensive rider profile from the power-duration curve.

// Expected power at each duration as a multiple of FTP (rough Coggan-style
// reference for a "balanced" rider). Used for strength/weakness comparison.
const EXPECTED_RATIOS = {
  5: 2.9,
  10: 2.6,
  30: 1.9,
  60: 1.6,
  120: 1.4,
  300: 1.18,
  480: 1.1,
  600: 1.08,
  1200: 1.05,
  1800: 1.0,
  3600: 0.92,
  5400: 0.87,
};

// Six representative durations for the radar chart.
const RADAR_DURATIONS = [
  { sec: 5, label: '5s' },
  { sec: 30, label: '30s' },
  { sec: 60, label: '1min' },
  { sec: 300, label: '5min' },
  { sec: 1200, label: '20min' },
  { sec: 3600, label: '60min' },
];

const TYPE_INFO = {
  sprinter: { label: 'Sprinter', icon: '🚀', description: 'Eksplozivna moč na kratke razdalje.' },
  puncher: { label: 'Puncher', icon: '👊', description: 'Močan na kratkih, ostrih naporih (1–5 min).' },
  climber: { label: 'Hribolazec', icon: '⛰️', description: 'Močan na daljših vzponih, šibkejši sprint.' },
  time_trialist: { label: 'Kronometrist', icon: '⏱️', description: 'Zelo močan na 20–60 min, šibkejša kratka moč.' },
  endurance: { label: 'Vzdržljivostni', icon: '🚴', description: 'Konsistenten čez vse dolžine.' },
  unknown: { label: 'Neznano', icon: '❓', description: 'Premalo podatkov — opravi več voženj z merilcem moči.' },
};

function classify(map, ref20) {
  const p5 = map[5];
  const p60s = map[60];
  const p300 = map[300];
  const pLong = map[3600] ?? map[1800];
  if (!ref20 || p5 == null || p60s == null || p300 == null) return 'unknown';

  const sprint = p5 / ref20;
  const punch1 = p60s / ref20;
  const punch5 = p300 / ref20;
  const long = pLong != null ? pLong / ref20 : null;

  if (sprint > 1.8) return 'sprinter';
  if (punch1 > 1.5 || punch5 > 1.25) return 'puncher';
  if (long != null && long > 0.93 && sprint < 1.4) return 'time_trialist';
  if (long != null && long > 0.88 && sprint < 1.6) return 'climber';
  return 'endurance';
}

function durationLabel(sec) {
  if (sec < 60) return `${sec}s`;
  if (sec < 3600) return `${sec / 60}min`;
  return `${sec / 3600}hr`;
}

function recommendationForDuration(sec) {
  if (sec <= 30) return 'Dodaj sprinte in nevromuskularne intervale.';
  if (sec <= 300) return 'Dodaj VO2max intervale (3–5 min).';
  if (sec <= 1200) return 'Dodaj pragovne intervale (npr. 2× 20 min).';
  return 'Povečaj obseg vzdržljivostnih voženj v coni 2.';
}

// Which rider types suit which goals; otherwise we nudge toward the goal.
function goalAlignment(type, goal) {
  if (!goal || type === 'unknown') return null;
  const g = goal.toLowerCase();
  const enduranceGoal = /endurance|fondo|vzdr/.test(g);
  const speedGoal = /speed|race|racing|sprint|hitr/.test(g);

  if (enduranceGoal && (type === 'sprinter' || type === 'puncher')) {
    return `Tvoj profil je ${TYPE_INFO[type].label}, toda tvoj cilj je vzdržljivost — fokusiraj se na Z2 vzdržljivost in pragovne napore.`;
  }
  if (speedGoal && (type === 'climber' || type === 'time_trialist' || type === 'endurance')) {
    return `Tvoj profil je ${TYPE_INFO[type].label}, tvoj cilj pa je hitrost — dodaj sprinte in kratke VO2max napore.`;
  }
  return `Tvoj profil (${TYPE_INFO[type].label}) se dobro ujema s tvojim ciljem.`;
}

/**
 * Build the rider profile. pdcArray: [{ duration_sec, power_watts }]; ftp number
 * or null; goal string.
 */
function analyze(pdcArray, ftp, goal) {
  const map = {};
  (pdcArray || []).forEach((p) => {
    if (p.power_watts != null) map[p.duration_sec] = p.power_watts;
  });

  const ref20 = map[1200] ?? (ftp ? Math.round(ftp / 0.95) : null);
  const ftpRef = ftp ?? (map[1200] ? Math.round(map[1200] * 0.95) : null);

  if (!ftpRef || Object.keys(map).length === 0) {
    return {
      rider_type: 'unknown',
      ...TYPE_INFO.unknown,
      strengths: [],
      weaknesses: [],
      recommendations: [],
      radar: RADAR_DURATIONS.map((d) => ({
        duration_sec: d.sec,
        label: d.label,
        value_pct: 0,
        ideal_pct: 100,
        power_watts: null,
      })),
      goal_alignment: null,
    };
  }

  const type = classify(map, ref20);

  const strengths = [];
  const weaknesses = [];
  for (const [secStr, ratio] of Object.entries(EXPECTED_RATIOS)) {
    const sec = Number(secStr);
    const actual = map[sec];
    if (actual == null) continue;
    const expected = ftpRef * ratio;
    if (actual > expected * 1.05) strengths.push(durationLabel(sec));
    else if (actual < expected * 0.95) weaknesses.push(durationLabel(sec));
  }

  // Recommendations from weaknesses (deduped, by weakest band first).
  const recommendations = [];
  for (const [secStr] of Object.entries(EXPECTED_RATIOS)) {
    const sec = Number(secStr);
    const actual = map[sec];
    if (actual == null) continue;
    const expected = ftpRef * EXPECTED_RATIOS[sec];
    if (actual < expected * 0.95) {
      const rec = recommendationForDuration(sec);
      if (!recommendations.includes(rec)) recommendations.push(rec);
    }
  }

  const radar = RADAR_DURATIONS.map((d) => {
    const actual = map[d.sec];
    const expected = ftpRef * (EXPECTED_RATIOS[d.sec] ?? 1);
    return {
      duration_sec: d.sec,
      label: d.label,
      value_pct: actual != null ? Math.round((actual / expected) * 100) : 0,
      ideal_pct: 100,
      power_watts: actual ?? null,
    };
  });

  return {
    rider_type: type,
    ...TYPE_INFO[type],
    strengths,
    weaknesses,
    recommendations,
    radar,
    goal_alignment: goalAlignment(type, goal),
  };
}

module.exports = { analyze, classify, EXPECTED_RATIOS, RADAR_DURATIONS };
