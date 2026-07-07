import { defineStore } from "pinia";

import {
  fetchCurrentUser,
  loginWithPassword,
  refreshAuthTokens,
  registerDjAccount,
  type TokenPair,
} from "~/lib/auth-api";
import { clearStoredTokens, loadStoredTokens, saveStoredTokens } from "~/lib/auth-storage";

import type { UserProfile } from "@rqst/contracts";

export type AuthStatus = "loading" | "authenticated" | "unauthenticated";

export const useAuthStore = defineStore("auth", {
  state: () => ({
    status: "loading" as AuthStatus,
    user: null as UserProfile | null,
    accessToken: null as string | null,
    refreshToken: null as string | null,
    bootstrapped: false,
  }),

  getters: {
    isAuthenticated: (state) => state.status === "authenticated" && Boolean(state.accessToken),
  },

  actions: {
    async bootstrap() {
      if (import.meta.server) {
        return;
      }

      if (this.bootstrapped) {
        return;
      }

      const config = useRuntimeConfig();
      this.status = "loading";

      try {
        const storedTokens = loadStoredTokens();

        if (storedTokens?.accessToken) {
          try {
            const user = await fetchCurrentUser(config.public.apiBaseUrl, storedTokens.accessToken);
            this.accessToken = storedTokens.accessToken;
            this.refreshToken = storedTokens.refreshToken || null;
            this.user = user;
            this.status = "authenticated";
            this.bootstrapped = true;
            return;
          } catch {
            if (storedTokens.refreshToken) {
              try {
                const refreshed = await refreshAuthTokens(config.public.apiBaseUrl, storedTokens.refreshToken);
                await this.applyTokens(refreshed);
                this.bootstrapped = true;
                return;
              } catch {
                clearStoredTokens();
              }
            } else {
              clearStoredTokens();
            }
          }
        }

        this.accessToken = null;
        this.refreshToken = null;
        this.user = null;
        this.status = "unauthenticated";
      } catch {
        this.accessToken = null;
        this.refreshToken = null;
        this.user = null;
        this.status = "unauthenticated";
      } finally {
        this.bootstrapped = true;
      }
    },

    async applyTokens(tokens: TokenPair) {
      const config = useRuntimeConfig();
      saveStoredTokens({
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      });

      const user = await fetchCurrentUser(config.public.apiBaseUrl, tokens.accessToken);
      this.accessToken = tokens.accessToken;
      this.refreshToken = tokens.refreshToken;
      this.user = user;
      this.status = "authenticated";
    },

    async signIn(email: string, password: string) {
      const config = useRuntimeConfig();
      const tokens = await loginWithPassword(config.public.apiBaseUrl, email.trim().toLowerCase(), password);
      await this.applyTokens(tokens);
    },

    async signUp(email: string, password: string, displayName: string) {
      const config = useRuntimeConfig();
      const tokens = await registerDjAccount(config.public.apiBaseUrl, {
        email: email.trim().toLowerCase(),
        password,
        displayName: displayName.trim(),
      });
      await this.applyTokens(tokens);
    },

    async signOut() {
      clearStoredTokens();
      this.accessToken = null;
      this.refreshToken = null;
      this.user = null;
      this.status = "unauthenticated";
    },

    async refreshSession() {
      if (!this.refreshToken) {
        return false;
      }

      const config = useRuntimeConfig();

      try {
        const refreshed = await refreshAuthTokens(config.public.apiBaseUrl, this.refreshToken);
        await this.applyTokens(refreshed);
        return true;
      } catch {
        await this.signOut();
        return false;
      }
    },
  },
});
