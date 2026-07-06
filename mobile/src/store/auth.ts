import { create } from "zustand";

import {
  fetchCurrentUser,
  loginWithPassword,
  refreshAuthTokens,
  registerAccount,
  type TokenPair,
  type UserProfile,
} from "../lib/auth-api";
import { clearStoredTokens, loadStoredTokens, saveStoredTokens } from "../lib/auth-storage";

export type AuthStatus = "loading" | "authenticated" | "unauthenticated";

type AuthState = {
  status: AuthStatus;
  user: UserProfile | null;
  accessToken: string | null;
  refreshToken: string | null;
  bootstrap: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, displayName: string) => Promise<void>;
  signOut: () => Promise<void>;
  applyTokens: (tokens: TokenPair) => Promise<void>;
  setUser: (user: UserProfile) => void;
};

const devAccessToken = process.env.EXPO_PUBLIC_RQST_ACCESS_TOKEN ?? null;

async function hydrateUser(accessToken: string): Promise<UserProfile> {
  return fetchCurrentUser(accessToken);
}

export const useAuthStore = create<AuthState>((set, get) => ({
  status: "loading",
  user: null,
  accessToken: devAccessToken,
  refreshToken: null,

  bootstrap: async () => {
    const current = get();
    if (current.status === "authenticated" && current.accessToken) {
      return;
    }

    if (current.status !== "loading") {
      set({ status: "loading" });
    }

    try {
      const storedTokens = await loadStoredTokens();

      if (storedTokens) {
        try {
          const user = await hydrateUser(storedTokens.accessToken);
          set({
            status: "authenticated",
            user,
            accessToken: storedTokens.accessToken,
            refreshToken: storedTokens.refreshToken,
          });
          return;
        } catch {
          try {
            const refreshed = await refreshAuthTokens(storedTokens.refreshToken);
            await saveStoredTokens({
              accessToken: refreshed.accessToken,
              refreshToken: refreshed.refreshToken,
            });
            const user = await hydrateUser(refreshed.accessToken);
            set({
              status: "authenticated",
              user,
              accessToken: refreshed.accessToken,
              refreshToken: refreshed.refreshToken,
            });
            return;
          } catch {
            await clearStoredTokens();
          }
        }
      }

      if (devAccessToken) {
        try {
          const user = await hydrateUser(devAccessToken);
          set({
            status: "authenticated",
            user,
            accessToken: devAccessToken,
            refreshToken: null,
          });
          return;
        } catch {
          // Fall through to unauthenticated when dev token is invalid.
        }
      }

      set({
        status: "unauthenticated",
        user: null,
        accessToken: null,
        refreshToken: null,
      });
    } catch {
      set({
        status: "unauthenticated",
        user: null,
        accessToken: null,
        refreshToken: null,
      });
    }
  },

  applyTokens: async (tokens) => {
    await saveStoredTokens({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    });
    const user = await hydrateUser(tokens.accessToken);
    set({
      status: "authenticated",
      user,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    });
  },

  signIn: async (email, password) => {
    const tokens = await loginWithPassword(email.trim().toLowerCase(), password);
    await get().applyTokens(tokens);
  },

  signUp: async (email, password, displayName) => {
    const tokens = await registerAccount({
      email: email.trim().toLowerCase(),
      password,
      displayName: displayName.trim(),
    });
    await get().applyTokens(tokens);
  },

  signOut: async () => {
    await clearStoredTokens();
    set({
      status: "unauthenticated",
      user: null,
      accessToken: null,
      refreshToken: null,
    });
  },

  setUser: (user) => {
    set({ user });
  },
}));

export function isAuthenticated(): boolean {
  return useAuthStore.getState().status === "authenticated" && Boolean(useAuthStore.getState().accessToken);
}

export function getAccessToken(): string | null {
  return useAuthStore.getState().accessToken;
}

export function getRefreshToken(): string | null {
  return useAuthStore.getState().refreshToken;
}
