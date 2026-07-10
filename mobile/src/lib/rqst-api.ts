import { Platform } from "react-native";
import type { SongRequestSummary } from "@rqst/contracts";

import { isAuthRequestError, refreshAuthTokens } from "./auth-api";
import { apiBaseUrl } from "./api-config";
import { toCamelCase } from "./json";
import { getAccessToken, getRefreshToken, useAuthStore } from "../store/auth";

export { apiBaseUrl };

type ApiOptions = RequestInit & {
  auth?: boolean;
  retry?: boolean;
};

let refreshPromise: Promise<boolean> | null = null;

async function refreshSessionTokens(): Promise<boolean> {
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    const refreshToken = getRefreshToken();
    if (!refreshToken) {
      await useAuthStore.getState().signOut();
      return false;
    }

    try {
      const tokens = await refreshAuthTokens(refreshToken);
      await useAuthStore.getState().applyTokens(tokens);
      return true;
    } catch (error) {
      // Keep the local session on transient network failures; only sign out
      // when the refresh token is rejected by the server.
      if (isAuthRequestError(error) && error.isUnauthorized) {
        await useAuthStore.getState().signOut();
      }
      return false;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

export function hasApiAccessToken(): boolean {
  return Boolean(getAccessToken());
}

export async function rqstApi<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const shouldAuth = options.auth !== false;
  const canRetry = options.retry !== false;

  async function request(accessToken: string | null): Promise<Response> {
    const headers = new Headers(options.headers);
    headers.set("Accept", "application/json");

    if (options.body && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }

    if (shouldAuth && accessToken) {
      headers.set("Authorization", `Bearer ${accessToken}`);
    }

    return fetch(`${apiBaseUrl}${path}`, {
      ...options,
      headers,
    });
  }

  let response = await request(getAccessToken());

  if (response.status === 401 && shouldAuth && canRetry && getRefreshToken()) {
    const refreshed = await refreshSessionTokens();
    if (refreshed) {
      response = await request(getAccessToken());
    }
  }

  if (!response.ok) {
    let message = `RQST API request failed with ${response.status}`;

    try {
      const body = (await response.json()) as { detail?: string };
      if (typeof body.detail === "string") {
        message = body.detail;
      }
    } catch {
      // Keep default message when response body is not JSON.
    }

    throw new Error(message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return toCamelCase(await response.json()) as T;
}

export type RequestCreatePayload = {
  song_id?: number;
  amount_cents: number;
  shoutout_amount_cents?: number;
  play_deadline_minutes?: number | null;
  play_deadline_amount_cents?: number;
  note?: string | null;
  use_complimentary?: boolean;
  song?: {
    title: string;
    artist: string;
    album?: string | null;
    duration_ms?: number | null;
    album_art_url?: string | null;
    isrc?: string | null;
    external_source?: string | null;
    external_id?: string | null;
    explicit?: boolean;
  };
};

export type ContributionCreatePayload = {
  amount_cents: number;
};

export type TipCreatePayload = {
  amount_cents: number;
};

export type { SongRequestSummary };
