import { create } from "zustand";
import type { QueueItem } from "../features/rqst/mock-data";

export type SelectedSession = {
  sessionId: number;
  djName: string;
  venueName: string;
  slug: string;
};

type AppState = {
  localQueueRequests: QueueItem[];
  addLocalQueueRequest: (request: QueueItem) => void;
  selectedSession: SelectedSession | null;
  setSelectedSession: (session: SelectedSession | null) => void;
};

export const useAppStore = create<AppState>((set) => ({
  localQueueRequests: [],
  addLocalQueueRequest: (request) =>
    set((state) => ({
      localQueueRequests: [
        request,
        ...state.localQueueRequests.filter((queueRequest) => queueRequest.id !== request.id),
      ],
    })),
  selectedSession: null,
  setSelectedSession: (selectedSession) => set({ selectedSession }),
}));
