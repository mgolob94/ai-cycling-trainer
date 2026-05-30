// Cycling power zones (Coggan 7-zone model). Use these colors EVERYWHERE zones
// appear — workout cards, ride analysis, charts — for visual consistency.
// Labels are in English to match the rest of the app.

export interface PowerZone {
  zone: string;
  color: string;
  bg: string;
  label: string;
  range: string;
  /** Lower/upper bounds as a fraction of FTP (upper is exclusive; Z7 is open). */
  min: number;
  max: number;
}

export const POWER_ZONES: PowerZone[] = [
  { zone: 'Z1', color: '#CBD5E1', bg: '#F8FAFC', label: 'Active Recovery', range: '< 55% FTP', min: 0, max: 0.55 },
  { zone: 'Z2', color: '#60A5FA', bg: '#EFF6FF', label: 'Endurance', range: '56–75% FTP', min: 0.55, max: 0.75 },
  { zone: 'Z3', color: '#34D399', bg: '#ECFDF5', label: 'Tempo', range: '76–90% FTP', min: 0.75, max: 0.9 },
  { zone: 'Z4', color: '#FBBF24', bg: '#FFFBEB', label: 'Threshold', range: '91–105% FTP', min: 0.9, max: 1.05 },
  { zone: 'Z5', color: '#F97316', bg: '#FFF7ED', label: 'VO2max', range: '106–120% FTP', min: 1.05, max: 1.2 },
  { zone: 'Z6', color: '#F43F5E', bg: '#FFF1F2', label: 'Anaerobic', range: '121–150% FTP', min: 1.2, max: 1.5 },
  { zone: 'Z7', color: '#A855F7', bg: '#FAF5FF', label: 'Neuromuscular', range: '> 150% FTP', min: 1.5, max: Infinity },
];

/** The zone a given power output falls into for the rider's FTP. */
export function getZoneForPower(power: number, ftp: number): PowerZone {
  if (!ftp || ftp <= 0) return POWER_ZONES[0];
  const frac = power / ftp;
  const found = POWER_ZONES.find((z) => frac < z.max);
  return found ?? POWER_ZONES[POWER_ZONES.length - 1];
}

/** Percentage of time spent in each zone across a 1-second power stream. */
export function getZoneDistribution(
  powerStream: number[],
  ftp: number
): Array<PowerZone & { pct: number; seconds: number }> {
  const counts = POWER_ZONES.map(() => 0);
  let total = 0;

  if (ftp > 0) {
    for (const p of powerStream) {
      if (!Number.isFinite(p)) continue;
      total += 1;
      const idx = POWER_ZONES.indexOf(getZoneForPower(p, ftp));
      counts[idx] += 1;
    }
  }

  return POWER_ZONES.map((z, i) => ({
    ...z,
    seconds: counts[i],
    pct: total ? Math.round((counts[i] / total) * 1000) / 10 : 0,
  }));
}

export default POWER_ZONES;
