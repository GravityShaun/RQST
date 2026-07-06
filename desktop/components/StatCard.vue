<template>
  <section class="stat-card" :class="tone ? `tone-${tone}` : undefined">
    <div class="eyebrow">{{ label }}</div>
    <div class="metric">{{ value }}</div>
    <div v-if="hint" class="muted">{{ hint }}</div>
  </section>
</template>

<script setup lang="ts">
defineProps<{
  label: string;
  value: string;
  hint?: string;
  tone?: "gold" | "mint" | "coral" | "slate" | "blue";
}>();
</script>
