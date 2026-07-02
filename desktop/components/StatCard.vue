<template>
  <section class="card">
    <div class="muted">{{ label }}</div>
    <div class="metric">{{ value }}</div>
    <div v-if="hint" class="muted">{{ hint }}</div>
  </section>
</template>

<script setup lang="ts">
defineProps<{
  label: string;
  value: string;
  hint?: string;
}>();
</script>

