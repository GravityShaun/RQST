<script setup lang="ts">
const admin = useAdminConsole();
const apiBaseUrl = ref("");
const colorScheme = ref<"light" | "dark" | "system">("system");
const requireConfirmations = ref(true);
const denseTables = ref(true);

const isDarkMode = computed(() => colorScheme.value === "dark");

onMounted(async () => {
  await admin.bootstrap();
  apiBaseUrl.value = admin.state.value.settings?.apiBaseUrl || admin.apiBaseUrl.value;
  colorScheme.value = admin.state.value.settings?.colorScheme || "system";
  requireConfirmations.value = admin.state.value.settings?.requireConfirmations ?? true;
  denseTables.value = admin.state.value.settings?.denseTables ?? true;
});

function save() {
  admin.updateSettings({
    apiBaseUrl: apiBaseUrl.value.trim(),
    colorScheme: colorScheme.value,
    requireConfirmations: requireConfirmations.value,
    denseTables: denseTables.value,
  });
}

function setTheme(nextScheme: "light" | "dark") {
  colorScheme.value = nextScheme;
  save();
}
</script>

<template>
  <section class="page-stack">
    <section class="panel settings-panel">
      <div class="panel-heading">
        <h2>Admin Settings</h2>
      </div>
      <label>
        Backend API URL
        <input v-model="apiBaseUrl" placeholder="http://127.0.0.1:8000/api/v1" />
      </label>
      <div class="settings-field">
        <span>Appearance</span>
        <div class="theme-toggle" role="group" aria-label="Appearance">
          <button
            class="theme-toggle-option"
            :class="{ active: !isDarkMode }"
            type="button"
            :aria-pressed="!isDarkMode"
            @click="setTheme('light')"
          >
            Light
          </button>
          <button
            class="theme-toggle-option"
            :class="{ active: isDarkMode }"
            type="button"
            :aria-pressed="isDarkMode"
            @click="setTheme('dark')"
          >
            Dark
          </button>
        </div>
      </div>
      <label class="check-row">
        <input v-model="requireConfirmations" type="checkbox" />
        Require confirmations for destructive admin actions
      </label>
      <label class="check-row">
        <input v-model="denseTables" type="checkbox" />
        Use dense tables
      </label>
      <div class="settings-actions">
        <button class="primary-button" type="button" @click="save">Save settings</button>
        <button class="secondary-button" type="button" @click="admin.refreshAll">Test connection</button>
      </div>
    </section>
  </section>
</template>
