import { defineStore } from "pinia";

export const useSessionStore = defineStore("session", {
  state: () => ({
    currentSessionId: null as number | null,
  }),
  actions: {
    setCurrentSessionId(sessionId: number | null) {
      this.currentSessionId = sessionId;
    },
  },
});

