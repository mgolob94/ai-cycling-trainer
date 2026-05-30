// Converts raw training numbers into plain-language explanations. Numbers are
// secondary — plain language is primary. (Copy is English to match the app.)
//
// `color` fields are Badge/semantic color keys ('rose' | 'amber' | 'indigo' |
// 'emerald' | 'sky' | 'default') so they plug straight into <Badge> and map to
// palette tokens.

export type StatusColor = 'rose' | 'amber' | 'indigo' | 'emerald' | 'sky' | 'default';

export interface TrainingStatus {
  status: 'overreached' | 'tired' | 'optimal' | 'fresh' | 'very_fresh';
  label: string;
  description: string;
  todayAdvice: string;
  color: StatusColor;
  emoji: string;
  scalePosition: number; // 0–100 position on the TSB scale
}

export interface FitnessStatus {
  label: string;
  trend: string;
  category: string;
  categoryRange: string;
}

export interface FatigueStatus {
  label: string;
  advice: string;
  isHigh: boolean;
}

export interface VolumeStatus {
  label: string;
  vsAverage: string;
  suggestion: string;
}

export interface FTPStatus {
  wattsPerKg: number;
  category: string;
  categoryDescription: string;
  changeLabel: string | null;
  nextMilestone: string;
}

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

// ---------------------------------------------------------------------------
// 1. TSB → training status (form)
// ---------------------------------------------------------------------------
const TSB_SCALE_MIN = -40;
const TSB_SCALE_MAX = 40;

export function interpretTSB(tsb: number): TrainingStatus {
  const scalePosition = clamp(
    ((tsb - TSB_SCALE_MIN) / (TSB_SCALE_MAX - TSB_SCALE_MIN)) * 100,
    0,
    100
  );

  if (tsb < -25) {
    return {
      status: 'overreached',
      label: 'Overreached',
      description: "Your body can't make progress in this state.",
      todayAdvice: 'You need at least 2 rest days.',
      color: 'rose',
      emoji: '⚠️',
      scalePosition,
    };
  }
  if (tsb < -10) {
    return {
      status: 'tired',
      label: 'Fatigued',
      description: 'Fatigue is building up.',
      todayAdvice: 'Easy training or rest today.',
      color: 'amber',
      emoji: '🟡',
      scalePosition,
    };
  }
  if (tsb <= 5) {
    return {
      status: 'optimal',
      label: 'Optimal form',
      description: 'Fitness and fatigue are well balanced.',
      todayAdvice: 'Ideal time for a quality workout.',
      color: 'indigo',
      emoji: '🔵',
      scalePosition,
    };
  }
  if (tsb <= 20) {
    return {
      status: 'fresh',
      label: 'Fresh & ready',
      description: 'You are well recovered.',
      todayAdvice: 'You can handle anything today — intervals, a long ride, a race.',
      color: 'emerald',
      emoji: '🟢',
      scalePosition,
    };
  }
  return {
    status: 'very_fresh',
    label: 'Very fresh — undertraining?',
    description: 'Form is good, but you may be training too little.',
    todayAdvice: 'Consider whether you are training enough.',
    color: 'emerald',
    emoji: '✨',
    scalePosition,
  };
}

// ---------------------------------------------------------------------------
// 2. CTL → fitness status
// ---------------------------------------------------------------------------
const CTL_CATEGORIES: { max: number; category: string; label: string; range: string }[] = [
  { max: 30, category: 'Beginner', label: 'Building your base. Focus on consistency.', range: '0–30' },
  { max: 50, category: 'Recreational', label: 'Good base endurance.', range: '30–50' },
  { max: 70, category: 'Fitness rider', label: 'Solid form for weekend riders.', range: '50–70' },
  { max: 90, category: 'Amateur', label: 'Training seriously. Visible progress.', range: '70–90' },
  { max: 110, category: 'Advanced amateur', label: 'High form. Close to professional levels.', range: '90–110' },
  { max: Infinity, category: 'Elite', label: 'Professional training load.', range: '110+' },
];

export function interpretCTL(ctl: number, ctlTrend: number): FitnessStatus {
  const cat = CTL_CATEGORIES.find((c) => ctl < c.max) ?? CTL_CATEGORIES[CTL_CATEGORIES.length - 1];
  const rounded = Math.round(ctlTrend);
  const trend =
    rounded > 1
      ? `Rising +${rounded} this month 📈`
      : rounded < -1
        ? `Falling ${rounded} this month 📉`
        : 'Stable this month';

  return {
    label: cat.label,
    trend,
    category: cat.category,
    categoryRange: `Typical for this level: ${cat.range}`,
  };
}

// ---------------------------------------------------------------------------
// 3. ATL → fatigue status
// ---------------------------------------------------------------------------
export function interpretATL(atl: number, atlTrend: number, ctl: number | null = null): FatigueStatus {
  const isHigh = ctl != null && atl > ctl + 15;

  const label =
    atl < 30 ? 'Low fatigue' : atl < 60 ? 'Moderate fatigue' : atl < 90 ? 'High fatigue' : 'Very high fatigue';

  const advice = isHigh
    ? 'Fatigue is outpacing your fitness — ease off to absorb the work.'
    : atlTrend > 5
      ? 'Normal fatigue after an active week.'
      : atlTrend < -5
        ? 'Fatigue is dropping — you are recovering well.'
        : 'Fatigue is steady.';

  return { label, advice, isHigh };
}

// ---------------------------------------------------------------------------
// 4. Weekly TSS → volume status
// ---------------------------------------------------------------------------
export function interpretWeeklyTSS(tss: number, avgTss4weeks: number): VolumeStatus {
  const avg = avgTss4weeks > 0 ? avgTss4weeks : tss || 1;
  const ratio = tss / avg;
  const pct = Math.round((ratio - 1) * 100);
  const vsAverage =
    pct === 0 ? 'In line with your average' : pct > 0 ? `+${pct}% above your average` : `${pct}% below your average`;

  if (ratio < 0.7) {
    return { label: 'Light week — not much stimulus', vsAverage, suggestion: 'Add a bit more volume next week if you feel fresh.' };
  }
  if (ratio < 0.9) {
    return { label: 'Recovery week — good', vsAverage, suggestion: 'Great for absorbing fitness. Ramp back up next week.' };
  }
  if (ratio <= 1.1) {
    return { label: 'Normal week — on plan', vsAverage, suggestion: 'Keep this rhythm going.' };
  }
  if (ratio <= 1.3) {
    return { label: 'Hard week — watch recovery', vsAverage, suggestion: 'Consider easing 10–15% next week (recovery week).' };
  }
  return { label: 'Very hard week — rest needed', vsAverage, suggestion: 'Schedule a recovery week to avoid overreaching.' };
}

// ---------------------------------------------------------------------------
// 5. FTP → power status
// ---------------------------------------------------------------------------
const FTP_CATEGORIES: { max: number; category: string; description: string }[] = [
  { max: 2.0, category: 'Recreational', description: 'Building toward structured fitness.' },
  { max: 3.0, category: 'Fitness rider', description: 'Solid all-round power.' },
  { max: 4.0, category: 'Amateur', description: 'Strong club-level power.' },
  { max: 5.0, category: 'Advanced amateur', description: 'Racing-level power.' },
  { max: Infinity, category: 'Elite', description: 'Professional-level power.' },
];

export function interpretFTP(ftp: number, weight: number, prevFtp: number | null): FTPStatus {
  const wattsPerKg = weight > 0 ? Math.round((ftp / weight) * 100) / 100 : 0;
  const idx = FTP_CATEGORIES.findIndex((c) => wattsPerKg < c.max);
  const catIdx = idx === -1 ? FTP_CATEGORIES.length - 1 : idx;
  const cat = FTP_CATEGORIES[catIdx];

  let changeLabel: string | null = null;
  if (prevFtp != null && prevFtp > 0) {
    const delta = ftp - prevFtp;
    if (delta !== 0) {
      const pct = Math.round((delta / prevFtp) * 1000) / 10;
      changeLabel = `${delta > 0 ? '+' : ''}${delta}W since last test (${delta > 0 ? '+' : ''}${pct}%)`;
    }
  }

  // Watts needed to reach the next category's lower bound (this category's max).
  let nextMilestone = 'Top category reached 🏆';
  if (cat.max !== Infinity && weight > 0) {
    const targetWatts = Math.ceil(cat.max * weight);
    const needed = targetWatts - ftp;
    if (needed > 0) nextMilestone = `To next category: +${needed}W (${cat.max.toFixed(1)} W/kg)`;
  }

  return {
    wattsPerKg,
    category: cat.category,
    categoryDescription: cat.description,
    changeLabel,
    nextMilestone,
  };
}
