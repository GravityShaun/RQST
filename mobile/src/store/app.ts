import { create } from "zustand";

type AppState = {
  selectedSessionId: number | null;
  setSelectedSessionId: (sessionId: number | null) => void;
};

export const useAppStore = create<AppState>((set) => ({
  selectedSessionId: null,
  setSelectedSessionId: (selectedSessionId) => set({ selectedSessionId }),
}));
