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
  sprinter: { label: 'Sprinter', icon: '🚀', description: 'Explosive power over short distances.' },
  puncher: { label: 'Puncher', icon: '👊', description: 'Strong on short, sharp efforts (1–5 min).' },
  climber: { label: 'Climber', icon: '⛰️', description: 'Strong on longer climbs, weaker sprint.' },
  time_trialist: { label: 'Time Trialist', icon: '⏱️', description: 'Very strong at 20–60 min, weaker short power.' },
  endurance: { label: 'Endurance', icon: '🚴', description: 'Consistent across all durations.' },
  unknown: { label: 'Unknown', icon: '❓', description: 'Not enough data — record more rides with a power meter.' },
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
  if (sec <= 30) return 'Add sprints and neuromuscular intervals.';
  if (sec <= 300) return 'Add VO2max intervals (3–5 min).';
  if (sec <= 1200) return 'Add threshold intervals (e.g. 2x 20 min).';
  return 'Increase Zone 2 endurance volume.';
}

// Which rider types suit which goals; otherwise we nudge toward the goal.
function goalAlignment(type, goal) {
  if (!goal || type === 'unknown') return null;
  const g = goal.toLowerCase();
  const enduranceGoal = /endurance|fondo|vzdr/.test(g);
  const speedGoal = /speed|race|racing|sprint|hitr/.test(g);

  if (enduranceGoal && (type === 'sprinter' || type === 'puncher')) {
    return `Your profile is ${TYPE_INFO[type].label}, but your goal is endurance — focus on Z2 endurance and threshold work.`;
  }
  if (speedGoal && (type === 'climber' || type === 'time_trialist' || type === 'endurance')) {
    return `Your profile is ${TYPE_INFO[type].label}, but your goal is speed — add sprints and short VO2max efforts.`;
  }
  return `Your profile (${TYPE_INFO[type].label}) matches your goal well.`;
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
