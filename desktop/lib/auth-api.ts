import { apiRoutes, type UserProfile } from "@rqst/contracts";

type ApiErrorBody = {
  detail?: string | { msg?: string }[];
};

export const EMAIL_ALREADY_EXISTS_MESSAGE = "An account with this email already exists.";

export type TokenPair = {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
};

function routePath(route: string) {
  return route.replace("/api/v1", "");
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

export function parseApiError(status: number, body: ApiErrorBody): string {
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
    return EMAIL_ALREADY_EXISTS_MESSAGE;
  }

  return `Request failed with status ${status}.`;
}

async function authRequest<T>(apiBaseUrl: string, path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");

  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers,
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

  return toCamelCase(await response.json()) as T;
}

export async function loginWithPassword(
  apiBaseUrl: string,
  email: string,
  password: string,
): Promise<TokenPair> {
  return authRequest<TokenPair>(apiBaseUrl, routePath(apiRoutes.login), {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export async function registerDjAccount(
  apiBaseUrl: string,
  payload: {
    email: string;
    password: string;
    displayName: string;
  },
): Promise<TokenPair> {
  return authRequest<TokenPair>(apiBaseUrl, routePath(apiRoutes.register), {
    method: "POST",
    body: JSON.stringify({
      email: payload.email,
      password: payload.password,
      display_name: payload.displayName,
      role: "dj",
    }),
  });
}

export async function refreshAuthTokens(apiBaseUrl: string, refreshToken: string): Promise<TokenPair> {
  return authRequest<TokenPair>(apiBaseUrl, routePath(apiRoutes.refresh), {
    method: "POST",
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
}

export async function fetchCurrentUser(apiBaseUrl: string, accessToken: string): Promise<UserProfile> {
  return authRequest<UserProfile>(apiBaseUrl, routePath(apiRoutes.me), {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}
