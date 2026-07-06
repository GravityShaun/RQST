const PUBLIC_ROUTES = ["/login", "/signup", "/onboarding"];

export default defineNuxtRouteMiddleware(async (to) => {
  if (import.meta.server) {
    return;
  }

  const authStore = useAuthStore();
  await authStore.bootstrap();

  const isPublicRoute = PUBLIC_ROUTES.some((route) => to.path === route || to.path.startsWith(`${route}/`));

  if (authStore.isAuthenticated) {
    if (isPublicRoute) {
      return navigateTo("/home");
    }
    return;
  }

  if (!isPublicRoute && to.path !== "/") {
    return navigateTo("/login");
  }
});
