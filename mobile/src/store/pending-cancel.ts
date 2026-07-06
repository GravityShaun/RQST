import { create } from "zustand";

import { REQUEST_CANCEL_WINDOW_MS } from "../lib/request-cancel";

type PendingCancelState = {
  expiresByRequestId: Record<number, number>;
  register: (requestId: number) => void;
  clear: (requestId: number) => void;
  pruneExpired: () => void;
};

export const usePendingCancelStore = create<PendingCancelState>((set, get) => ({
  expiresByRequestId: {},
  register: (requestId) =>
    set((state) => ({
      expiresByRequestId: {
        ...state.expiresByRequestId,
        [requestId]: Date.now() + REQUEST_CANCEL_WINDOW_MS,
      },
    })),
  clear: (requestId) =>
    set((state) => {
      if (!(requestId in state.expiresByRequestId)) {
        return state;
      }

      const nextExpiresByRequestId = { ...state.expiresByRequestId };
      delete nextExpiresByRequestId[requestId];
      return { expiresByRequestId: nextExpiresByRequestId };
    }),
  pruneExpired: () => {
    const now = Date.now();
    const current = get().expiresByRequestId;
    const nextExpiresByRequestId = Object.fromEntries(
      Object.entries(current).filter(([, expiresAt]) => expiresAt > now),
    );

    if (Object.keys(nextExpiresByRequestId).length === Object.keys(current).length) {
      return;
    }

    set({ expiresByRequestId: nextExpiresByRequestId });
  },
}));
