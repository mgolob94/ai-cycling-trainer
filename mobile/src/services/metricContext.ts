// Single source of truth for what every metric MEANS — plain-language name,
// a short line, an analogy, and labelled reference ranges. Components (MetricBadge,
// MetricTooltip, FirstEncounterHint, EffortRating, the TSS chart, the form scale)
// all read from here so context is consistent everywhere. No raw number is ever
// shown without a label drawn from this file.
//
// `color` values are tokens resolved by the consumer: zone keys ('z1'…'z6' →
// zoneColors) or status keys ('green' | 'warning' | 'danger' → theme colors).

export interface MetricRange {
  min?: number;
  max?: number;
  label: string;
  color?: string;
  description: string;
}

export interface MetricContextDef {
  name: string;
  short: string;
  analogy: string;
  unit?: string;
  ranges?: MetricRange[];
  weeklyRanges?: MetricRange[];
  wkgRanges?: MetricRange[];
  weeklyGrowthNote?: string;
  raceTarget?: string;
}

export const METRIC_CONTEXT = {
  tss: {
    name: 'Training Stress',
    short: 'How hard this ride was overall.',
    analogy: "Think of it as the 'cost' of a ride. 100 = one hour at your absolute limit.",
    ranges: [
      { max: 50, label: 'Light', color: 'z1', description: 'Easy spin. Low cost.' },
      { max: 100, label: 'Moderate', color: 'z2', description: 'Solid workout. Body notices.' },
      { max: 150, label: 'Hard', color: 'z4', description: 'Demanding. Plan recovery.' },
      { max: 200, label: 'Very hard', color: 'z5', description: 'Big effort. Rest tomorrow.' },
      { max: 999, label: 'Extreme', color: 'z6', description: 'Max day. 2 days recovery.' },
    ],
    weeklyRanges: [
      { max: 150, label: 'Easy week', description: 'Good for recovery or beginners.' },
      { max: 300, label: 'Normal week', description: 'Solid training stimulus.' },
      { max: 450, label: 'Big week', description: 'Meaningful load. Rest day needed.' },
      { max: 600, label: 'Heavy week', description: 'High load. Monitor fatigue closely.' },
      { max: 9999, label: 'Max week', description: 'Only sustainable short-term.' },
    ],
  },

  ctl: {
    name: 'Fitness',
    short: 'Your long-term training fitness. Builds over months.',
    analogy: "Think of it as how full your 'fitness bank' is. Fills slowly, empties slowly.",
    unit: 'points',
    ranges: [
      { max: 20, label: 'Getting started', description: "You're building the habit. Keep showing up." },
      { max: 40, label: 'Building base', description: 'Consistency is working. Base is forming.' },
      { max: 60, label: 'Solid fitness', description: 'Good aerobic foundation.' },
      { max: 80, label: 'Strong amateur', description: 'Serious training. Visible results.' },
      { max: 100, label: 'Dedicated athlete', description: 'High fitness. Hard to maintain.' },
      { max: 999, label: 'Elite level', description: 'Professional training load.' },
    ],
    weeklyGrowthNote: 'Healthy growth: 3–6 points per week. More than 10/week risks injury.',
  },

  atl: {
    name: 'Fatigue',
    short: 'How tired your legs are right now. Changes quickly.',
    analogy: 'Like a fuel gauge for your legs. Drains with hard training, refills with rest.',
    unit: 'points',
    ranges: [
      { max: 20, label: 'Fresh', description: 'Legs are rested. Ready to push.' },
      { max: 40, label: 'Moderate', description: 'Normal training fatigue.' },
      { max: 60, label: 'Tired', description: 'Body is working hard. Rest soon.' },
      { max: 999, label: 'Very tired', description: 'Reduce load or take a day off.' },
    ],
  },

  tsb: {
    name: 'Form',
    short: "Your fitness minus your fatigue. Tells you if you're ready.",
    analogy: 'Positive = fresh and ready. Negative = tired. Sweet spot for racing: +5 to +20.',
    unit: '',
    ranges: [
      { min: -999, max: -25, label: 'Overtrained', color: 'danger', description: 'Too much load. Rest now — no exceptions.' },
      { min: -25, max: -10, label: 'Tired', color: 'warning', description: 'Heavy legs. Train easy or rest.' },
      { min: -10, max: 5, label: 'Optimal', color: 'green', description: 'Best zone for training adaptation.' },
      { min: 5, max: 20, label: 'Fresh', color: 'green', description: 'Ready for hard efforts or racing.' },
      { min: 20, max: 999, label: 'Very fresh', color: 'warning', description: 'Well rested — maybe too little training?' },
    ],
    raceTarget: 'For your best performance at an event, aim for TSB between +5 and +20.',
  },

  ftp: {
    name: 'FTP — Threshold Power',
    short: 'The maximum power you can hold for one hour.',
    analogy: 'Your engine size. Higher FTP = faster at the same effort.',
    unit: 'W',
    wkgRanges: [
      { max: 2.0, label: 'Getting started', description: 'Focus on consistency and base miles.' },
      { max: 2.5, label: 'Recreational', description: 'Good foundation. Room to grow.' },
      { max: 3.0, label: 'Fitness cyclist', description: 'Solid fitness. Competitive in local rides.' },
      { max: 3.5, label: 'Club cyclist', description: 'Strong. Competitive in group rides.' },
      { max: 4.0, label: 'Serious amateur', description: 'Very strong. Cat 4-3 race territory.' },
      { max: 4.5, label: 'Advanced amateur', description: 'Elite amateur. Cat 2-1 territory.' },
      { max: 5.0, label: 'Semi-pro', description: 'Near professional level.' },
      { max: 999, label: 'Professional', description: 'World Tour level.' },
    ],
  },

  np: {
    name: 'Normalized Power',
    short: 'A smarter measure of effort than average power.',
    analogy: 'Average power lies — it ignores surges and climbs. NP tells the real story.',
    unit: 'W',
  },

  vi: {
    name: 'Variability Index',
    short: 'How steady your power was throughout the ride.',
    analogy: '1.00 = perfectly smooth. 1.10 = very variable. Lower is better for long rides.',
    unit: '',
    ranges: [
      { max: 1.02, label: 'Very steady', description: 'Excellent pacing. Very efficient.' },
      { max: 1.05, label: 'Steady', description: 'Good pacing discipline.' },
      { max: 1.1, label: 'Variable', description: 'Some surges. Normal for outdoor rides.' },
      { max: 999, label: 'Very variable', description: 'Lots of surges. High physiological cost.' },
    ],
  },

  recovery: {
    name: 'Recovery Score',
    short: 'How ready your body is to train today.',
    analogy: 'Like a battery charge. 100% = fully charged. 20% = needs charging.',
    unit: '',
    ranges: [
      { max: 30, label: 'Rest', color: 'danger', description: 'Body is asking for a day off.' },
      { max: 50, label: 'Easy', color: 'warning', description: 'Light activity only.' },
      { max: 70, label: 'Moderate', color: 'warning', description: 'Train but dial back intensity.' },
      { max: 85, label: 'Good', color: 'green', description: 'Train as planned.' },
      { max: 100, label: 'Optimal', color: 'green', description: 'Best conditions to push hard.' },
    ],
  },
} satisfies Record<string, MetricContextDef>;

export type MetricContextKey = keyof typeof METRIC_CONTEXT;

/** The labelled range a value falls into for a metric, or null if none defined. */
export function getRange(metric: MetricContextKey, value: number): MetricRange | null {
  const m = METRIC_CONTEXT[metric] as MetricContextDef;
  if (!m.ranges) return null;
  return m.ranges.find((r) => value <= (r.max ?? 999) && value >= (r.min ?? -999)) ?? null;
}

/** The W/kg category for an FTP-to-weight ratio. */
export function getWkgRange(wkg: number): MetricRange | null {
  return METRIC_CONTEXT.ftp.wkgRanges.find((r) => wkg <= (r.max ?? 999)) ?? null;
}
