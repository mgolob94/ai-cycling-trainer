import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

import { useAuthStore } from '../store/useAuthStore';
import {
  getKnowledgeLevel,
  setKnowledgeLevel,
  trackInteraction,
  syncKnowledgeLevel,
  getLevelConfig,
  type KnowledgeLevel,
  type LevelConfig,
  type Interaction,
} from '../services/userLevel';

interface KnowledgeLevelContextValue {
  level: KnowledgeLevel;
  config: LevelConfig;
  /** Set the level explicitly (e.g. from the onboarding self-report). */
  setLevel: (level: KnowledgeLevel) => void;
  /** Record a behaviour; may auto-upgrade the level. */
  track: (interaction: Interaction) => void;
}

const defaultLevel: KnowledgeLevel = 'beginner';

const KnowledgeLevelContext = createContext<KnowledgeLevelContextValue>({
  level: defaultLevel,
  config: getLevelConfig(defaultLevel),
  setLevel: () => {},
  track: () => {},
});

export function KnowledgeLevelProvider({ children }: { children: ReactNode }) {
  const userId = useAuthStore((s) => s.userId);
  const [level, setLevelState] = useState<KnowledgeLevel>(defaultLevel);

  // Load the local level immediately, then reconcile with the server.
  useEffect(() => {
    let active = true;
    (async () => {
      const local = await getKnowledgeLevel(userId);
      if (active) setLevelState(local);
      const synced = await syncKnowledgeLevel(userId);
      if (active) setLevelState(synced);
    })();
    return () => {
      active = false;
    };
  }, [userId]);

  const setLevel = useCallback(
    (next: KnowledgeLevel) => {
      setLevelState(next);
      setKnowledgeLevel(userId, next).catch(() => {});
    },
    [userId]
  );

  const track = useCallback(
    (interaction: Interaction) => {
      trackInteraction(userId, interaction)
        .then((next) => setLevelState(next))
        .catch(() => {});
    },
    [userId]
  );

  return (
    <KnowledgeLevelContext.Provider value={{ level, config: getLevelConfig(level), setLevel, track }}>
      {children}
    </KnowledgeLevelContext.Provider>
  );
}

/** Read the active knowledge level + config from anywhere. */
export function useKnowledgeLevel(): KnowledgeLevelContextValue {
  return useContext(KnowledgeLevelContext);
}

export { KnowledgeLevelContext };
