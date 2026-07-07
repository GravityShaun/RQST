<script setup lang="ts">
const admin = useAdminConsole();
const email = ref("");
const password = ref("");

onMounted(admin.bootstrap);

async function submit() {
  await admin.signIn(email.value, password.value);
}
</script>

<template>
  <section class="login-page">
    <form class="login-panel" @submit.prevent="submit">
      <span class="eyebrow">RQST Admin</span>
      <h1>Admin Dashboard</h1>
      <label>
        Email
        <input v-model="email" autocomplete="email" required type="email" />
      </label>
      <label>
        Password
        <input v-model="password" autocomplete="current-password" required type="password" />
      </label>
      <p class="login-subtitle">
        Default admin: <strong>admin-console@example.com</strong> / <strong>rqst-admin-console</strong>
      </p>
      <button class="primary-button" type="submit" :disabled="admin.state.value.loading">
        Sign in
      </button>
    </form>
  </section>
</template>
