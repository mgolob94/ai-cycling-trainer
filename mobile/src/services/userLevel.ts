import AsyncStorage from '@react-native-async-storage/async-storage';

import { supabase } from './supabase';

// Tracks how familiar the user is with cycling metrics and adapts the UI:
//   beginner     — plain language only, no raw numbers
//   intermediate — plain language + numbers on tap
//   advanced     — numbers by default, plain language secondary
//
// Level is set on onboarding (self-report) and only ever auto-upgrades based on
// behaviour — it never silently downgrades. Persisted to AsyncStorage (instant,
// offline) and mirrored to the Supabase users table (cross-device).

export type KnowledgeLevel = 'beginner' | 'intermediate' | 'advanced';

export interface LevelConfig {
  showRawNumbers: boolean;
  showTooltipHints: boolean;
  defaultExpanded: boolean;
  showPowerCurve: boolean;
  showWPrime: boolean;
  numberSize: 'hidden' | 'small' | 'normal';
}

export type Interaction = 'show_more' | 'tooltip' | 'ftp_test' | 'power_curve' | string;

const LEVEL_KEY = 'userLevel.level';
const INTERACTIONS_KEY = 'userLevel.interactions';

const RANK: Record<KnowledgeLevel, number> = { beginner: 0, intermediate: 1, advanced: 2 };

/** The higher (more advanced) of two levels. */
function maxLevel(a: KnowledgeLevel, b: KnowledgeLevel): KnowledgeLevel {
  return RANK[a] >= RANK[b] ? a : b;
}

function isLevel(v: unknown): v is KnowledgeLevel {
  return v === 'beginner' || v === 'intermediate' || v === 'advanced';
}

// ---------------------------------------------------------------------------
// Level → UI config
// ---------------------------------------------------------------------------
const CONFIGS: Record<KnowledgeLevel, LevelConfig> = {
  beginner: {
    showRawNumbers: false,
    showTooltipHints: true,
    defaultExpanded: false,
    showPowerCurve: false,
    showWPrime: false,
    numberSize: 'hidden',
  },
  intermediate: {
    showRawNumbers: true,
    showTooltipHints: true,
    defaultExpanded: false,
    showPowerCurve: true,
    showWPrime: false,
    numberSize: 'small',
  },
  advanced: {
    showRawNumbers: true,
    showTooltipHints: false,
    defaultExpanded: true,
    showPowerCurve: true,
    showWPrime: true,
    numberSize: 'normal',
  },
};

export function getLevelConfig(level: KnowledgeLevel): LevelConfig {
  return CONFIGS[level] ?? CONFIGS.beginner;
}

// ---------------------------------------------------------------------------
// Read / write
// ---------------------------------------------------------------------------
/** Current level from local storage (fast, offline). Defaults to 'beginner'. */
export async function getKnowledgeLevel(_userId?: string | null): Promise<KnowledgeLevel> {
  const stored = await AsyncStorage.getItem(LEVEL_KEY);
  return isLevel(stored) ? stored : 'beginner';
}

/** Persist a level locally and mirror to Supabase (best-effort). */
export async function setKnowledgeLevel(userId: string | null, level: KnowledgeLevel): Promise<void> {
  await AsyncStorage.setItem(LEVEL_KEY, level);
  if (userId) {
    try {
      await supabase.from('users').update({ knowledge_level: level }).eq('id', userId);
    } catch {
      // Offline / RLS hiccup — local copy is the source of truth until next sync.
    }
  }
}

// ---------------------------------------------------------------------------
// Behaviour-driven auto-upgrade
// ---------------------------------------------------------------------------
// Thresholds: reaching any of these never lowers the level, only raises it.
const INTERMEDIATE = { show_more: 5, ftp_test: 1 };
const ADVANCED = { tooltip: 10, power_curve: 1 };

async function readInteractions(): Promise<Record<string, number>> {
  try {
    const raw = await AsyncStorage.getItem(INTERACTIONS_KEY);
    return raw ? (JSON.parse(raw) as Record<string, number>) : {};
  } catch {
    return {};
  }
}

/** Level implied purely by accumulated behaviour. */
function derivedLevel(counts: Record<string, number>): KnowledgeLevel {
  let level: KnowledgeLevel = 'beginner';
  if ((counts.show_more ?? 0) >= INTERMEDIATE.show_more || (counts.ftp_test ?? 0) >= INTERMEDIATE.ftp_test) {
    level = 'intermediate';
  }
  if ((counts.tooltip ?? 0) >= ADVANCED.tooltip || (counts.power_curve ?? 0) >= ADVANCED.power_curve) {
    level = 'advanced';
  }
  return level;
}

/**
 * Record a behaviour and auto-upgrade the level if the behaviour warrants it.
 * Returns the (possibly upgraded) current level.
 */
export async function trackInteraction(userId: string | null, interaction: Interaction): Promise<KnowledgeLevel> {
  const counts = await readInteractions();
  counts[interaction] = (counts[interaction] ?? 0) + 1;
  await AsyncStorage.setItem(INTERACTIONS_KEY, JSON.stringify(counts));

  const current = await getKnowledgeLevel(userId);
  const next = maxLevel(current, derivedLevel(counts));
  if (next !== current) await setKnowledgeLevel(userId, next);
  return next;
}

// ---------------------------------------------------------------------------
// Cross-device sync
// ---------------------------------------------------------------------------
/**
 * Reconcile local and remote levels (takes the higher of the two, since levels
 * only increase) and writes the result back to whichever side was behind.
 * Returns the reconciled level.
 */
export async function syncKnowledgeLevel(userId: string | null): Promise<KnowledgeLevel> {
  const local = await getKnowledgeLevel(userId);
  if (!userId) return local;

  let remote: KnowledgeLevel | null = null;
  try {
    const { data } = await supabase.from('users').select('knowledge_level').eq('id', userId).maybeSingle();
    if (isLevel(data?.knowledge_level)) remote = data!.knowledge_level as KnowledgeLevel;
  } catch {
    return local;
  }

  const merged = remote ? maxLevel(local, remote) : local;
  if (merged !== local) await AsyncStorage.setItem(LEVEL_KEY, merged);
  if (merged !== remote) {
    try {
      await supabase.from('users').update({ knowledge_level: merged }).eq('id', userId);
    } catch {
      /* best-effort */
    }
  }
  return merged;
}
