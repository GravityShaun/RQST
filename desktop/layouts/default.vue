<template>
  <div class="shell-grid">
    <aside class="sidebar">
      <div style="display: grid; gap: 24px">
        <div>
          <div class="muted" style="text-transform: uppercase; letter-spacing: 0.12em; font-size: 0.72rem">RQST</div>
          <div style="font-size: 1.8rem; font-weight: 800">DJ Console</div>
        </div>
        <nav style="display: grid; gap: 12px">
          <NuxtLink v-for="item in items" :key="item.to" :to="item.to" class="card" style="padding: 14px 16px">
            {{ item.label }}
          </NuxtLink>
        </nav>
      </div>
    </aside>
    <main class="content">
      <slot />
    </main>
  </div>
</template>

<script setup lang="ts">
const items = [
  { label: "Home", to: "/home" },
  { label: "Requests", to: "/requests" },
  { label: "Payments", to: "/payments" },
  { label: "Profile", to: "/profile" },
  { label: "Settings", to: "/settings" },
];
</script>

