<template>
  <section class="card" style="display: grid; gap: 12px">
    <div class="queue-row queue-header" :class="{ 'has-action': showPlayButton }">
      <span class="queue-rank-col">Rank</span>
      <span class="queue-song-col">Song</span>
      <span>Contributors</span>
      <span class="queue-time-col">Time Requested</span>
      <span class="queue-total-col">Total</span>
      <span v-if="showPlayButton">Action</span>
    </div>
    <div v-if="items.length === 0" class="queue-empty muted">
      {{ showPlayButton ? "No queued requests yet." : "No played requests yet." }}
    </div>
    <div v-for="item in items" :key="item.id" class="queue-row" :class="{ 'has-action': showPlayButton }">
      <span class="rank-badge queue-rank-col">#{{ item.rank }}</span>
      <div class="queue-song-col">
        <div class="song-title">{{ item.title }}</div>
        <div class="muted">{{ item.artist }}</div>
      </div>
      <div class="queue-meta">{{ item.contributors }}</div>
      <div class="queue-meta queue-time-col muted">{{ item.requestedAt }}</div>
      <div class="queue-total queue-total-col">{{ item.total }}</div>
      <div v-if="showPlayButton">
        <button
          v-if="canPlay(item.rawStatus)"
          class="btn btn-play"
          type="button"
          @click="emit('play', item)"
        >
          Play
        </button>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
type QueueItem = {
  id: number;
  rank: number;
  title: string;
  artist: string;
  total: string;
  contributors: number;
  rawStatus: string;
  requestedAt?: string;
};

defineProps<{
  items: QueueItem[];
  showPlayButton?: boolean;
}>();

const emit = defineEmits<{
  play: [item: QueueItem];
}>();

function canPlay(status: string) {
  const normalized = status.toLowerCase();
  return normalized !== "played" && normalized !== "cancelled" && normalized !== "rejected" && normalized !== "refunded";
}
</script>
