import { Platform } from "react-native";
import type { SongRequestSummary } from "@rqst/contracts";

const localApiHost = Platform.OS === "android" ? "10.0.2.2" : "127.0.0.1";

export const apiBaseUrl = (process.env.EXPO_PUBLIC_RQST_API_URL ?? `http://${localApiHost}:8000/api/v1`).replace(/\/$/, "");
const accessToken = process.env.EXPO_PUBLIC_RQST_ACCESS_TOKEN;
export const hasApiAccessToken = Boolean(accessToken);

type ApiOptions = RequestInit & {
  auth?: boolean;
};

function toCamelCase(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(toCamelCase);
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase()),
      toCamelCase(item),
    ]),
  );
}

export async function rqstApi<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set("Accept", "application/json");

  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  if (options.auth !== false && accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }

  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    throw new Error(`RQST API request failed with ${response.status}`);
  }

  return toCamelCase(await response.json()) as T;
}

export type RequestCreatePayload = {
  song_id: number;
  amount_cents: number;
  note?: string | null;
};

export type ContributionCreatePayload = {
  amount_cents: number;
};

export type { SongRequestSummary };
