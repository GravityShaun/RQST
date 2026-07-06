<template>
  <div class="shell-grid">
    <aside class="sidebar">
      <div class="sidebar-brand">
        <div class="eyebrow">RQST</div>
        <div class="sidebar-title">DJ Console</div>
      </div>
      <nav class="sidebar-nav">
        <NuxtLink v-for="item in items" :key="item.to" :to="item.to" class="nav-link">
          {{ item.label }}
        </NuxtLink>
      </nav>

      <div v-if="user" class="sidebar-account">
        <div class="sidebar-account-label">Signed in as</div>
        <div class="sidebar-account-name">{{ user.displayName }}</div>
        <div class="sidebar-account-email">{{ user.email }}</div>
        <button class="btn btn-secondary sidebar-signout" type="button" @click="handleSignOut">
          Sign out
        </button>
      </div>
    </aside>
    <main class="content">
      <slot />
    </main>
  </div>
</template>

<script setup lang="ts">
const authStore = useAuthStore();
const user = computed(() => authStore.user);

const items = [
  { label: "Home", to: "/home" },
  { label: "Requests", to: "/requests" },
  { label: "Payments", to: "/payments" },
  { label: "Shows", to: "/shows" },
  { label: "Profile", to: "/profile" },
  { label: "Settings", to: "/settings" },
];

async function handleSignOut() {
  await authStore.signOut();
  await navigateTo("/login");
}
</script>

<style scoped>
.sidebar {
  align-self: start;
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  position: sticky;
  top: 0;
}

.sidebar-account {
  border-top: 1px solid var(--rqst-border);
  display: grid;
  gap: 6px;
  margin-top: auto;
  padding-top: 20px;
}

.sidebar-account-label {
  color: var(--rqst-ink-muted);
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.sidebar-account-name {
  font-size: 0.98rem;
  font-weight: 800;
}

.sidebar-account-email {
  color: var(--rqst-ink-muted);
  font-size: 0.84rem;
  word-break: break-word;
}

.sidebar-signout {
  justify-content: center;
  margin-top: 8px;
  width: 100%;
}
</style>
