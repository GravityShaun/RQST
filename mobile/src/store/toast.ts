import { create } from "zustand";

type ToastMessage = {
  id: number;
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void | Promise<void>;
  durationMs?: number;
  showConfetti?: boolean;
  confettiEmoji?: string;
};

type ToastState = {
  toast: ToastMessage | null;
  showToast: (payload: Omit<ToastMessage, "id">) => void;
  dismissToast: () => void;
};

let nextToastId = 1;

export const useToastStore = create<ToastState>((set) => ({
  toast: null,
  showToast: ({ title, message, actionLabel, onAction, durationMs, showConfetti, confettiEmoji }) => {
    set({
      toast: {
        id: nextToastId++,
        title,
        message,
        actionLabel,
        onAction,
        durationMs,
        showConfetti,
        confettiEmoji,
      },
    });
  },
  dismissToast: () => {
    set({ toast: null });
  },
}));
