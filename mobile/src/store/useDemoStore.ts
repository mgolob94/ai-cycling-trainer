import { create } from 'zustand';

// Ephemeral demo mode — lets a new user explore the app with mock data before
// signing up. Intentionally NOT persisted: closing the app exits demo mode.
interface DemoState {
  demo: boolean;
  enterDemo: () => void;
  exitDemo: () => void;
}

export const useDemoStore = create<DemoState>((set) => ({
  demo: false,
  enterDemo: () => set({ demo: true }),
  exitDemo: () => set({ demo: false }),
}));
