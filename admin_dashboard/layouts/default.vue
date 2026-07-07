<script setup lang="ts">
const admin = useAdminConsole();
const route = useRoute();

const navItems = [
  { to: "/", label: "Overview" },
  { to: "/users", label: "Users" },
  { to: "/payments", label: "Payments" },
  { to: "/operations", label: "Operations" },
  { to: "/reports", label: "Reports" },
  { to: "/settings", label: "Settings" },
];

onMounted(async () => {
  await admin.bootstrap();
  if (route.path !== "/login" && !admin.isAuthenticated.value) {
    await navigateTo("/login");
  }
});
</script>

<template>
  <div class="admin-shell" :class="{ compact: admin.state.value.settings?.denseTables }">
    <aside v-if="route.path !== '/login'" class="sidebar">
      <div class="brand">
        <span class="brand-mark">RQ</span>
        <div>
          <strong>RQST Admin</strong>
          <small>Management Console</small>
        </div>
      </div>
      <nav class="nav">
        <NuxtLink v-for="item in navItems" :key="item.to" :to="item.to" class="nav-link">
          {{ item.label }}
        </NuxtLink>
      </nav>
      <div class="sidebar-footer">
        <span>{{ admin.state.value.currentUser?.email }}</span>
        <button class="ghost-button" type="button" @click="admin.signOut">Sign out</button>
      </div>
    </aside>

    <main class="content">
      <div v-if="route.path !== '/login'" class="topbar">
        <div>
          <span class="eyebrow">Admin</span>
          <h1>{{ navItems.find((item) => item.to === route.path)?.label || "Overview" }}</h1>
        </div>
        <button class="secondary-button" type="button" :disabled="admin.state.value.loading" @click="admin.refreshAll">
          Refresh
        </button>
      </div>

      <div v-if="admin.state.value.error" class="notice error">{{ admin.state.value.error }}</div>
      <div v-if="admin.state.value.message" class="notice success">{{ admin.state.value.message }}</div>

      <slot />
    </main>
  </div>
</template>
