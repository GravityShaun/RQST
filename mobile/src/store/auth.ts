import { create } from "zustand";

import {
  fetchCurrentUser,
  isAuthRequestError,
  loginWithPassword,
  refreshAuthTokens,
  registerAccount,
  type TokenPair,
  type UserProfile,
} from "../lib/auth-api";
import {
  clearStoredTokens,
  loadStoredSession,
  saveStoredSession,
  saveStoredTokens,
  saveStoredUser,
} from "../lib/auth-storage";

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

function isUnauthorizedError(error: unknown): boolean {
  return isAuthRequestError(error) && error.isUnauthorized;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  status: "loading",
  user: null,
  accessToken: null,
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
      const storedSession = await loadStoredSession();

      if (storedSession) {
        try {
          const user = await hydrateUser(storedSession.accessToken);
          await saveStoredUser(user);
          set({
            status: "authenticated",
            user,
            accessToken: storedSession.accessToken,
            refreshToken: storedSession.refreshToken,
          });
          return;
        } catch {
          try {
            const refreshed = await refreshAuthTokens(storedSession.refreshToken);
            const user = await hydrateUser(refreshed.accessToken);
            await saveStoredSession(
              {
                accessToken: refreshed.accessToken,
                refreshToken: refreshed.refreshToken,
              },
              user,
            );
            set({
              status: "authenticated",
              user,
              accessToken: refreshed.accessToken,
              refreshToken: refreshed.refreshToken,
            });
            return;
          } catch (refreshError) {
            // Access tokens expire often; only wipe the session when the
            // server rejects the refresh token. Network / backend outages
            // should keep the user signed in with the cached profile.
            if (isUnauthorizedError(refreshError)) {
              await clearStoredTokens();
            } else {
              set({
                status: "authenticated",
                user: storedSession.user,
                accessToken: storedSession.accessToken,
                refreshToken: storedSession.refreshToken,
              });
              return;
            }
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
    await saveStoredUser(user);
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
    void saveStoredUser(user);
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
