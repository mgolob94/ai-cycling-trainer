const { supabaseAdmin } = require('../db/supabase');
const pushNotifications = require('./pushNotifications');

// Notification strategy engine. Philosophy: ≤2/day, never during sleep hours,
// never the same type within 48h, contextual timing, warm tone, genuine
// celebrations. Anti-spam is enforced against the notifications_sent table.
// Copy is English to match the app.

const QUIET_START = 22; // 22:00
const QUIET_END = 7; // 07:00
const MAX_PER_DAY = 2;

// Minimum hours between sends of the same type.
const COOLDOWN_HOURS = {
  morning_readiness: 20,
  milestone_ftp: 48,
  milestone_pr: 24,
  inactivity: 504, // 3 weeks
  lack_of_progress: 336, // 2 weeks
  phase_transition: 18, // fires once on the transition day
};

/** Plain-language push copy for a phase transition (from → to). */
function phaseTransitionMessage(from, to, user) {
  const eventName = user?.target_event_name || 'your event';
  switch (to) {
    case 'build':
      return from === 'recovery'
        ? { title: 'Back at it ✓', body: 'Recovery done — Build phase resumes. Fresh and ready.' }
        : { title: 'Base phase done 💪', body: 'Build phase starts this week — time to push.' };
    case 'peak':
      return { title: 'Fitness is high ⚡', body: 'Peak phase — sharp and ready. This is what the base was for.' };
    case 'recovery':
      return { title: 'Recovery week 🔄', body: 'Intentionally easy. Adaptation happens when you rest.' };
    case 'taper':
      return { title: 'Taper time 🏁', body: `${eventName} is close — volume down, intensity stays. Arrive fresh.` };
    case 'base':
    default:
      return { title: 'Base phase 📗', body: 'Building the engine. Long, steady rides. No heroics.' };
  }
}

function inQuietHours(now) {
  const h = now.getHours();
  return h >= QUIET_START || h < QUIET_END;
}

function readinessMessage(score) {
  if (score >= 85) return 'Flying today ⚡ — perfect day to go hard';
  if (score >= 70) return 'Good shape today 🟢 — train as planned';
  if (score >= 50) return 'A bit tired 🟡 — dial it back a notch';
  if (score >= 30) return 'Take it easy today 🟠 — light or rest';
  return 'Rest day 🔴 — your body is asking for it';
}

const isoDate = (d) => d.toISOString().slice(0, 10);
function daysAgo(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() - n);
  return x;
}

/** Candidate notifications for a user at `now` (before anti-spam filtering). */
async function buildCandidates(userId, now) {
  const today = isoDate(now);
  const out = [];

  // 1. Morning readiness (~07:00–07:59 local).
  if (now.getHours() === QUIET_END) {
    const { data: rec } = await supabaseAdmin
      .from('recovery_scores')
      .select('recovery_score')
      .eq('user_id', userId)
      .eq('date', today)
      .maybeSingle();
    if (rec?.recovery_score != null) {
      out.push({ type: 'morning_readiness', title: 'Morning readiness', body: readinessMessage(rec.recovery_score), deep_link: 'Recovery' });
    }
  }

  // 3. Milestones — recent FTP increase / new PR (last 2 days).
  const { data: ftps } = await supabaseAdmin
    .from('ftp_tests')
    .select('ftp_watts, test_date')
    .eq('user_id', userId)
    .order('test_date', { ascending: true });
  if (ftps && ftps.length >= 2) {
    const latest = ftps[ftps.length - 1];
    const prev = ftps[ftps.length - 2];
    const recent = new Date(`${latest.test_date}T00:00:00Z`) >= daysAgo(now, 2);
    if (recent && latest.ftp_watts > prev.ftp_watts) {
      const delta = latest.ftp_watts - prev.ftp_watts;
      out.push({ type: 'milestone_ftp', title: 'FTP improvement! 💪', body: `FTP up to ${latest.ftp_watts}W (+${delta}W). The work is paying off 💪`, deep_link: 'Progress' });
    }
  }
  const { data: prs } = await supabaseAdmin
    .from('personal_records')
    .select('record_type, value, unit, achieved_date')
    .eq('user_id', userId)
    .gte('achieved_date', isoDate(daysAgo(now, 2)))
    .order('achieved_date', { ascending: false })
    .limit(1);
  if (prs && prs.length) {
    const pr = prs[0];
    out.push({ type: 'milestone_pr', title: 'New record 🏆', body: `New record. ${pr.record_type.replace(/_/g, ' ')}: ${pr.value}${pr.unit === 'watts' ? 'W' : ` ${pr.unit}`}`, deep_link: 'Progress' });
  }

  // 4. Lack of progress — TSS declined 3 weeks straight.
  const { data: weeks } = await supabaseAdmin
    .from('performance_metrics')
    .select('tss, week_start')
    .eq('user_id', userId)
    .order('week_start', { ascending: false })
    .limit(3);
  if (weeks && weeks.length === 3 && weeks[0].tss < weeks[1].tss && weeks[1].tss < weeks[2].tss) {
    out.push({ type: 'lack_of_progress', title: 'Checking in', body: "The last few weeks have been quieter. All good? Your plan is here when you're ready.", deep_link: 'Progress' });
  }

  // Phase transition — a new phase started today (written by phaseEngine).
  const { data: phaseRows } = await supabaseAdmin
    .from('phase_history')
    .select('phase, started_at')
    .eq('user_id', userId)
    .order('started_at', { ascending: false })
    .limit(2);
  if (phaseRows && phaseRows.length && phaseRows[0].started_at === today) {
    const { data: user } = await supabaseAdmin
      .from('users')
      .select('target_event_name')
      .eq('id', userId)
      .maybeSingle();
    const msg = phaseTransitionMessage(phaseRows[1]?.phase ?? null, phaseRows[0].phase, user);
    out.push({ type: 'phase_transition', title: msg.title, body: msg.body, deep_link: 'TrainingPlan' });
  }

  // 8. Inactivity — no rides in 10+ days (and rode before).
  const { data: lastRide } = await supabaseAdmin
    .from('rides')
    .select('ride_date')
    .eq('user_id', userId)
    .order('ride_date', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (lastRide?.ride_date && new Date(`${lastRide.ride_date}T00:00:00Z`) < daysAgo(now, 10)) {
    out.push({ type: 'inactivity', title: 'Kōda', body: "Hey — whenever you're ready, your plan is here 🚴", deep_link: 'Dashboard' });
  }

  return out;
}

/** Has a given type been sent within its cooldown window? */
async function recentlySent(userId, type, now) {
  const cooldown = COOLDOWN_HOURS[type] ?? 48;
  const since = new Date(now.getTime() - cooldown * 3600 * 1000).toISOString();
  const { count } = await supabaseAdmin
    .from('notifications_sent')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('notification_type', type)
    .gte('sent_at', since);
  return (count ?? 0) > 0;
}

async function sentTodayCount(userId, now) {
  const { count } = await supabaseAdmin
    .from('notifications_sent')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('sent_at', `${isoDate(now)}T00:00:00Z`);
  return count ?? 0;
}

/** Build, filter (anti-spam + quiet hours), send, and record for one user. */
async function runForUser(userId, now) {
  if (inQuietHours(now)) return 0;
  let budget = MAX_PER_DAY - (await sentTodayCount(userId, now));
  if (budget <= 0) return 0;

  const candidates = await buildCandidates(userId, now);
  let sent = 0;
  for (const c of candidates) {
    if (budget <= 0) break;
    if (await recentlySent(userId, c.type, now)) continue;
    await pushNotifications.sendToUser(userId, { title: c.title, body: c.body, data: { screen: c.deep_link } }).catch(() => {});
    await supabaseAdmin.from('notifications_sent').insert({ user_id: userId, notification_type: c.type, deep_link: c.deep_link });
    sent += 1;
    budget -= 1;
  }
  return sent;
}

/** Run for every user with a registered push token (the 15-min cron). */
async function runDue(now = new Date()) {
  const { data } = await supabaseAdmin.from('push_tokens').select('user_id');
  const userIds = [...new Set((data || []).map((r) => r.user_id))];
  let totalSent = 0;
  for (const userId of userIds) {
    try {
      totalSent += await runForUser(userId, now);
    } catch (e) {
      console.warn('[notify] failed for', userId, e.message);
    }
  }
  return { users: userIds.length, sent: totalSent };
}

module.exports = { runDue, runForUser, buildCandidates, inQuietHours, readinessMessage };
