import { create } from 'zustand';

import { setAuthToken } from '../services/api';

interface AuthState {
  token: string | null;
  userId: string | null;
  setSession: (token: string, userId: string) => void;
  clearSession: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  userId: null,
  setSession: (token, userId) => {
    setAuthToken(token);
    set({ token, userId });
  },
  clearSession: () => {
    setAuthToken(null);
    set({ token: null, userId: null });
  },
}));
