import { useAuthStore } from "~/stores/auth";

export function useDjAuth() {
  const authStore = useAuthStore();

  async function ensureAuth() {
    await authStore.bootstrap();

    if (!authStore.accessToken) {
      await navigateTo("/login");
      throw new Error("Not authenticated");
    }

    return authStore.accessToken;
  }

  async function signOut() {
    await authStore.signOut();
  }

  return {
    accessToken: computed(() => authStore.accessToken),
    user: computed(() => authStore.user),
    isAuthenticated: computed(() => authStore.isAuthenticated),
    ensureAuth,
    signOut,
    clearAuth: signOut,
  };
}
