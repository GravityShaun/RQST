export type UserRole = "listener" | "dj" | "admin";
export type PaymentStatus =
  | "payment_created"
  | "checkout_started"
  | "payment_pending"
  | "payment_authorized"
  | "payment_succeeded"
  | "payment_failed"
  | "payment_cancelled"
  | "payment_refunded"
  | "payment_disputed";
export type SessionStatus = "not_started" | "live" | "paused" | "ended";

export type TokenResponse = {
  accessToken: string;
  refreshToken: string;
};

export type CurrentUser = {
  id: number;
  email: string;
  displayName: string;
  role: UserRole;
  isEmailVerified: boolean;
};

export type AdminOverview = {
  totalUsers: number;
  activeUsers: number;
  totalDjs: number;
  liveSessions: number;
  openReports: number;
  paymentsOverview: {
    totalGrossCents: number;
    totalNetCents: number;
    totalPlatformFeesCents: number;
    totalRefundedCents: number;
    succeededCount: number;
    pendingCount: number;
    failedCount: number;
    disputedCount: number;
    currency: string;
  };
};

export type AdminUser = {
  id: number;
  email: string;
  displayName: string;
  role: UserRole;
  isEmailVerified: boolean;
  deletedAt: string | null;
  createdAt: string;
  requestCount: number;
  paymentTotalCents: number;
};

export type AdminPayment = {
  id: number;
  userId: number;
  userEmail: string;
  userDisplayName: string;
  djProfileId: number;
  djArtistName: string | null;
  sessionId: number;
  songRequestId: number;
  grossAmountCents: number;
  netAmountCents: number;
  platformFeeCents: number;
  processingFeeCents: number;
  currency: string;
  status: PaymentStatus;
  provider: string;
  providerPaymentId: string | null;
  succeededAt: string | null;
  refundedAt: string | null;
  createdAt: string;
  songTitle: string | null;
  songArtist: string | null;
};

export type AdminDj = {
  id: number;
  userId: number;
  artistName: string;
  slug: string;
  city: string | null;
  isPublic: boolean;
  userEmail: string;
  liveSessionId: number | null;
  totalEarningsCents: number;
  sessionCount: number;
  createdAt: string;
};

export type AdminSession = {
  id: number;
  djProfileId: number;
  djArtistName: string;
  venueName: string;
  eventName: string | null;
  status: SessionStatus;
  acceptingRequests: boolean;
  minimumRequestAmountCents: number;
  startedAt: string | null;
  endedAt: string | null;
  requestCount: number;
  grossPaymentsCents: number;
};

export type AdminReport = {
  id: number;
  reporterUserId: number;
  reporterDisplayName: string;
  targetType: string;
  targetId: number;
  reason: string;
  status: string;
  createdAt: string;
};

export type AdminSettings = {
  apiBaseUrl: string;
  colorScheme: "light" | "dark" | "system";
  requireConfirmations: boolean;
  denseTables: boolean;
};

const TOKEN_KEY = "rqst.admin.tokens";
const SETTINGS_KEY = "rqst.admin.settings";

type StoredTokens = {
  accessToken: string;
  refreshToken: string;
};

type ApiErrorBody = {
  detail?: string | Array<{ msg?: string }>;
};

export function toCamelCase(value: unknown): unknown {
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

function toSnakeCase(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(toSnakeCase);
  }
  if (!value || typeof value !== "object") {
    return value;
  }
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`),
      toSnakeCase(item),
    ]),
  );
}

function parseApiError(status: number, body: ApiErrorBody): string {
  if (Array.isArray(body.detail)) {
    return body.detail.map((item) => item.msg).filter(Boolean).join(", ") || `Request failed with status ${status}.`;
  }
  if (typeof body.detail === "string") {
    return body.detail;
  }
  return `Request failed with status ${status}.`;
}

export function loadTokens(): StoredTokens | null {
  if (import.meta.server) {
    return null;
  }
  const raw = window.localStorage.getItem(TOKEN_KEY);
  return raw ? (JSON.parse(raw) as StoredTokens) : null;
}

export function saveTokens(tokens: StoredTokens) {
  window.localStorage.setItem(TOKEN_KEY, JSON.stringify(tokens));
}

export function clearTokens() {
  window.localStorage.removeItem(TOKEN_KEY);
}

export function loadAdminSettings(defaultApiBaseUrl: string): AdminSettings {
  if (import.meta.server) {
    return {
      apiBaseUrl: defaultApiBaseUrl,
      colorScheme: "system",
      requireConfirmations: true,
      denseTables: true,
    };
  }
  const raw = window.localStorage.getItem(SETTINGS_KEY);
  return {
    apiBaseUrl: defaultApiBaseUrl,
    colorScheme: "system",
    requireConfirmations: true,
    denseTables: true,
    ...(raw ? (JSON.parse(raw) as Partial<AdminSettings>) : {}),
  };
}

export function saveAdminSettings(settings: AdminSettings) {
  window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

async function request<T>(apiBaseUrl: string, path: string, init: RequestInit = {}, accessToken?: string): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  if (accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }
  if (init.body && !(init.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${apiBaseUrl}${path}`, { ...init, headers });
  if (!response.ok) {
    let message = `Request failed with status ${response.status}.`;
    try {
      message = parseApiError(response.status, (await response.json()) as ApiErrorBody);
    } catch {
      message = parseApiError(response.status, {});
    }
    throw new Error(message);
  }
  if (response.status === 204) {
    return undefined as T;
  }
  return toCamelCase(await response.json()) as T;
}

export function login(apiBaseUrl: string, email: string, password: string) {
  return request<TokenResponse>(apiBaseUrl, "/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export function refresh(apiBaseUrl: string, refreshToken: string) {
  return request<TokenResponse>(apiBaseUrl, "/auth/refresh", {
    method: "POST",
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
}

export function getMe(apiBaseUrl: string, accessToken: string) {
  return request<CurrentUser>(apiBaseUrl, "/me", {}, accessToken);
}

export async function authedRequest<T>(apiBaseUrl: string, path: string, init: RequestInit = {}): Promise<T> {
  let tokens = loadTokens();
  if (!tokens?.accessToken) {
    throw new Error("Not authenticated");
  }

  try {
    return await request<T>(apiBaseUrl, path, init, tokens.accessToken);
  } catch (error) {
    if (!tokens.refreshToken) {
      throw error;
    }
    const refreshed = await refresh(apiBaseUrl, tokens.refreshToken);
    tokens = {
      accessToken: refreshed.accessToken,
      refreshToken: refreshed.refreshToken,
    };
    saveTokens(tokens);
    return request<T>(apiBaseUrl, path, init, tokens.accessToken);
  }
}

export const adminApi = {
  overview: (apiBaseUrl: string) => authedRequest<AdminOverview>(apiBaseUrl, "/admin/overview"),
  users: (apiBaseUrl: string) => authedRequest<AdminUser[]>(apiBaseUrl, "/admin/users"),
  updateUser: (apiBaseUrl: string, userId: number, body: Partial<AdminUser>) =>
    authedRequest<AdminUser>(apiBaseUrl, `/admin/users/${userId}`, {
      method: "PATCH",
      body: JSON.stringify(toSnakeCase(body)),
    }),
  deleteUser: (apiBaseUrl: string, userId: number) =>
    authedRequest<{ message: string }>(apiBaseUrl, `/admin/users/${userId}`, { method: "DELETE" }),
  restoreUser: (apiBaseUrl: string, userId: number) =>
    authedRequest<{ message: string }>(apiBaseUrl, `/admin/users/${userId}/restore`, { method: "POST" }),
  payments: (apiBaseUrl: string) => authedRequest<AdminPayment[]>(apiBaseUrl, "/admin/payments"),
  refundPayment: (apiBaseUrl: string, paymentId: number, reason: string) =>
    authedRequest<{ message: string }>(apiBaseUrl, `/admin/payments/${paymentId}/refund`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    }),
  chargebackPayment: (apiBaseUrl: string, paymentId: number, reason: string) =>
    authedRequest<{ message: string }>(apiBaseUrl, `/admin/payments/${paymentId}/chargeback`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    }),
  djs: (apiBaseUrl: string) => authedRequest<AdminDj[]>(apiBaseUrl, "/admin/djs"),
  sessions: (apiBaseUrl: string) => authedRequest<AdminSession[]>(apiBaseUrl, "/admin/sessions"),
  updateSession: (apiBaseUrl: string, sessionId: number, body: Partial<AdminSession>) =>
    authedRequest<AdminSession>(apiBaseUrl, `/admin/sessions/${sessionId}`, {
      method: "PATCH",
      body: JSON.stringify(toSnakeCase(body)),
    }),
  reports: (apiBaseUrl: string) => authedRequest<AdminReport[]>(apiBaseUrl, "/admin/reports"),
  resolveReport: (apiBaseUrl: string, reportId: number) =>
    authedRequest<{ message: string }>(apiBaseUrl, `/admin/reports/${reportId}/resolve`, { method: "POST" }),
};
