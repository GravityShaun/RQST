<script setup lang="ts">
const authStore = useAuthStore();

if (import.meta.client) {
  await authStore.bootstrap();
  await navigateTo(authStore.isAuthenticated ? "/home" : "/login");
}
</script>
