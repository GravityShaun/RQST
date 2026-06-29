<template>
  <section class="card" style="display: grid; gap: 12px">
    <div class="queue-row muted" style="font-size: 0.82rem; text-transform: uppercase; letter-spacing: 0.08em">
      <span>Rank</span>
      <span>Song</span>
      <span>Total</span>
      <span>Contributors</span>
      <span>Status</span>
    </div>
    <div v-for="item in items" :key="item.rank" class="queue-row">
      <strong class="accent">#{{ item.rank }}</strong>
      <div>
        <div style="font-weight: 700">{{ item.title }}</div>
        <div class="muted">{{ item.artist }}</div>
      </div>
      <div>{{ item.total }}</div>
      <div>{{ item.contributors }}</div>
      <div class="muted">{{ item.status }}</div>
    </div>
  </section>
</template>

<script setup lang="ts">
defineProps<{
  items: Array<{
    rank: number;
    title: string;
    artist: string;
    total: string;
    contributors: number;
    status: string;
  }>;
}>();
</script>

