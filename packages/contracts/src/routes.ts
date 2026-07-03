export const apiRoutes = {
  health: "/api/v1/health",
  register: "/api/v1/auth/register",
  login: "/api/v1/auth/login",
  refresh: "/api/v1/auth/refresh",
  me: "/api/v1/me",
  meRequests: "/api/v1/me/requests",
  djs: "/api/v1/djs",
  sessionsNearby: "/api/v1/sessions/nearby",
  songsSearch: "/api/v1/songs/search",
} as const;

export const apiRouteBuilders = {
  sessionRequests: (sessionId: number | string) => `/api/v1/sessions/${sessionId}/requests`,
  createSessionRequest: (sessionId: number | string) => `/api/v1/sessions/${sessionId}/requests`,
  request: (requestId: number | string) => `/api/v1/requests/${requestId}`,
  contributeToRequest: (requestId: number | string) => `/api/v1/requests/${requestId}/contribute`,
  currentDjRequests: "/api/v1/dj/requests/current",
} as const;
