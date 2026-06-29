export const apiRoutes = {
  health: "/api/v1/health",
  register: "/api/v1/auth/register",
  login: "/api/v1/auth/login",
  refresh: "/api/v1/auth/refresh",
  me: "/api/v1/me",
  djs: "/api/v1/djs",
  sessionsNearby: "/api/v1/sessions/nearby",
  songsSearch: "/api/v1/songs/search",
} as const;

