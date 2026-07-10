import { apiRoutes, type UserRole } from "@rqst/contracts";

import { apiBaseUrl } from "./api-config";

export type TokenPair = {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
};

export type UserProfile = {
  id: number;
  email: string;
  displayName: string;
  avatarUrl?: string | null;
  role: UserRole;
  isEmailVerified: boolean;
};

type ApiErrorBody = {
  detail?: string | { msg?: string }[];
};

export class AuthRequestError extends Error {
  readonly status: number | null;

  constructor(message: string, status: number | null = null) {
    super(message);
    this.name = "AuthRequestError";
    this.status = status;
  }

  get isUnauthorized(): boolean {
    return this.status === 401 || this.status === 403;
  }

  get isNetworkError(): boolean {
    return this.status === null;
  }
}

export function isAuthRequestError(error: unknown): error is AuthRequestError {
  return error instanceof AuthRequestError;
}

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

function routePath(route: string): string {
  return route.replace("/api/v1", "");
}

function parseApiError(status: number, body: ApiErrorBody): string {
  if (typeof body.detail === "string") {
    return body.detail;
  }

  if (Array.isArray(body.detail) && body.detail[0]?.msg) {
    return body.detail[0].msg;
  }

  if (status === 401) {
    return "Invalid email or password.";
  }

  if (status === 409) {
    return "An account with this email already exists for this app.";
  }

  return `Request failed with status ${status}.`;
}

async function authRequest<T>(path: string, init: RequestInit, timeoutMs = 10_000): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");

  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl}${path}`, {
      ...init,
      headers,
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new AuthRequestError(
        "Could not reach the RQST server. Check that the backend is running.",
        null,
      );
    }
    throw new AuthRequestError(
      error instanceof Error ? error.message : "Network request failed.",
      null,
    );
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    let message = `Request failed with status ${response.status}.`;

    try {
      const body = (await response.json()) as ApiErrorBody;
      message = parseApiError(response.status, body);
    } catch {
      message = parseApiError(response.status, {});
    }

    throw new AuthRequestError(message, response.status);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return toCamelCase(await response.json()) as T;
}

export async function loginWithPassword(email: string, password: string): Promise<TokenPair> {
  return authRequest<TokenPair>(routePath(apiRoutes.login), {
    method: "POST",
    body: JSON.stringify({ email, password, role: "listener" }),
  });
}

export async function registerAccount(payload: {
  email: string;
  password: string;
  displayName: string;
}): Promise<TokenPair> {
  return authRequest<TokenPair>(routePath(apiRoutes.register), {
    method: "POST",
    body: JSON.stringify({
      email: payload.email,
      password: payload.password,
      display_name: payload.displayName,
      role: "listener",
    }),
  });
}

export async function refreshAuthTokens(refreshToken: string): Promise<TokenPair> {
  return authRequest<TokenPair>(routePath(apiRoutes.refresh), {
    method: "POST",
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
}

export async function fetchCurrentUser(accessToken: string): Promise<UserProfile> {
  return authRequest<UserProfile>(routePath(apiRoutes.me), {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}

export async function uploadUserAvatar(accessToken: string, localUri: string): Promise<UserProfile> {
  const formData = new FormData();
  formData.append("file", {
    uri: localUri,
    name: "avatar.jpg",
    type: "image/jpeg",
  } as unknown as Blob);

  const response = await fetch(`${apiBaseUrl}${routePath(apiRoutes.meAvatar)}`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: formData,
  });

  if (!response.ok) {
    let message = `Request failed with status ${response.status}.`;

    try {
      const body = (await response.json()) as ApiErrorBody;
      message = parseApiError(response.status, body);
    } catch {
      message = parseApiError(response.status, {});
    }

    throw new Error(message);
  }

  return toCamelCase(await response.json()) as UserProfile;
}
