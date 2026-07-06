<template>
  <div class="auth-shell">
    <div class="auth-shell-inner">
      <div class="auth-brand">
        <div class="auth-brand-mark">RQST</div>
        <div class="auth-brand-subtitle">DJ Console</div>
      </div>

      <div class="auth-hero">
        <div class="eyebrow">{{ eyebrow }}</div>
        <h1 class="auth-title">{{ title }}</h1>
        <p class="auth-subtitle">{{ subtitle }}</p>
      </div>

      <section class="card auth-card">
        <slot />
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  eyebrow: string;
  title: string;
  subtitle: string;
}>();
</script>
