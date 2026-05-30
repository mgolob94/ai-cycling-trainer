import { useCallback, useEffect, useState } from 'react';

import { useWeeklyMetrics } from './useWeeklyMetrics';
import { useFtp } from './useFtp';
import { useProfile } from './useProfile';
import { checkNudges, filterDismissed, dismissNudge, type Nudge } from '../services/nudgeService';

function daysBetween(iso: string | null | undefined): number | null {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(`${iso}T00:00:00`).getTime()) / (24 * 3600 * 1000));
}

/**
 * Computes the currently-relevant nudges (max 2, dismissed ones filtered) from
 * the user's metrics, FTP, and profile. Exposes dismiss() to hide one.
 */
export function useNudges() {
  const { weeks } = useWeeklyMetrics();
  const ftp = useFtp();
  const profile = useProfile();
  const [nudges, setNudges] = useState<Nudge[]>([]);

  const recompute = useCallback(async () => {
    if (!weeks.length) {
      setNudges([]);
      return;
    }
    const current = weeks[weeks.length - 1];
    const monthAgo = weeks.length >= 5 ? weeks[weeks.length - 5] : null;
    const weight = profile.profile?.weight_kg ?? 0;
    const ftpWatts = ftp.ftp?.ftp_watts ?? 0;
    const prev = ftp.history.length >= 2 ? ftp.history[ftp.history.length - 2] : null;

    const all = checkNudges({
      tsb: current.tsb,
      ctl: current.ctl,
      atl: current.atl,
      ctlMonthAgo: monthAgo?.ctl ?? null,
      weeklyTss: weeks.map((w) => w.tss),
      daysSinceFtpTest: daysBetween(ftp.ftp?.test_date),
      wattsPerKg: weight > 0 && ftpWatts > 0 ? ftpWatts / weight : null,
      prevWattsPerKg: prev && weight > 0 ? prev.ftp_watts / weight : null,
    });
    setNudges(await filterDismissed(all));
  }, [weeks, ftp.ftp, ftp.history, profile.profile]);

  useEffect(() => {
    recompute();
  }, [recompute]);

  const dismiss = useCallback(
    async (id: string) => {
      await dismissNudge(id);
      recompute();
    },
    [recompute]
  );

  return {
    nudges,
    high: nudges.filter((n) => n.priority === 'high'),
    medium: nudges.filter((n) => n.priority === 'medium'),
    low: nudges.filter((n) => n.priority === 'low'),
    dismiss,
  };
}
