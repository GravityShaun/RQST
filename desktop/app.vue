<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>

<script setup lang="ts">
import { applyColorScheme } from "~/lib/color-scheme";

const { resolved } = useAppTheme();

watch(
  resolved,
  (theme) => {
    applyColorScheme(theme);
  },
  { immediate: true },
);
</script>
