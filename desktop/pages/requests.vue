<template>
  <div style="display: grid; gap: 20px">
    <section class="card" style="display: flex; justify-content: space-between; gap: 20px; flex-wrap: wrap">
      <div>
        <div class="muted">Active queue</div>
        <h1 style="margin: 0; font-size: 2.6rem">Ranked by live dollars</h1>
        <p v-if="pending" class="muted" style="margin: 8px 0 0">Loading live requests...</p>
        <p v-else-if="error" class="muted" style="margin: 8px 0 0">Could not reach the backend. Retrying every 30 seconds.</p>
        <p v-else-if="sessionId" class="muted" style="margin: 8px 0 0">Session #{{ sessionId }} · updates in real time</p>
      </div>
      <div style="text-align: right">
        <div class="metric">{{ totalRequested }}</div>
        <div class="muted">Requested tonight</div>
      </div>
    </section>

    <div class="segment-tabs">
      <button
        v-for="tab in requestTabs"
        :key="tab.id"
        class="segment-tab"
        :class="{ 'is-selected': activeTab === tab.id }"
        type="button"
        @click="activeTab = tab.id"
      >
        {{ tab.label }}
      </button>
    </div>

    <QueueTable
      :items="visibleItems"
      :show-play-button="activeTab === 'queued'"
      @play="openPlayModal"
    />

    <Teleport to="body">
      <div v-if="playTarget" class="modal-backdrop" @click.self="closePlayModal">
        <div class="modal-card" role="dialog" aria-labelledby="play-modal-title" aria-modal="true">
          <div class="eyebrow">Confirm song play</div>
          <h2 id="play-modal-title" style="margin: 0; font-size: 1.8rem">{{ playTarget.title }}</h2>
          <p class="muted" style="margin: 0">{{ playTarget.artist }}</p>
          <div class="play-amount-pill">{{ playTarget.total }}</div>
          <p class="muted" style="margin: 0">Mark this request as played for the room.</p>
          <p v-if="playError" class="play-error">{{ playError }}</p>
          <div class="btn-row" style="margin-top: 4px">
            <button class="btn btn-secondary" type="button" :disabled="isPlaying" @click="closePlayModal">Cancel</button>
            <button class="btn btn-primary" type="button" :disabled="isPlaying" @click="confirmPlay">
              {{ isPlaying ? "Playing..." : "Confirm play" }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import QueueTable from "~/components/QueueTable.vue";
import { useSessionQueue } from "~/composables/useSessionQueue";
import { countUniqueContributors } from "~/utils/contributors";
import { formatTimeAgo, parseApiDateTime } from "~/utils/datetime";

type RequestTab = "queued" | "played";

type QueueRow = {
  id: number;
  rank: number;
  title: string;
  artist: string;
  total: string;
  amountCents: number;
  contributors: number;
  rawStatus: string;
  requestedAt?: string;
};

const requestTabs = [
  { id: "queued" as const, label: "Queued" },
  { id: "played" as const, label: "Played" },
];

const activeTab = ref<RequestTab>("queued");
const playTarget = ref<QueueRow | null>(null);
const playError = ref("");
const isPlaying = ref(false);
const now = ref(Date.now());

let timeAgoInterval: ReturnType<typeof setInterval> | undefined;

onMounted(() => {
  timeAgoInterval = setInterval(() => {
    now.value = Date.now();
  }, 60_000);
});

onUnmounted(() => {
  if (timeAgoInterval) {
    clearInterval(timeAgoInterval);
  }
});

const { requests: backendRequests, pending, error, sessionId, markRequestPlayed } = useSessionQueue();

function formatUsd(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

const liveRows = computed<QueueRow[]>(() =>
  [...backendRequests.value]
    .sort((left, right) => {
      const amountSort = right.total_amount_cents - left.total_amount_cents;
      if (amountSort !== 0) {
        return amountSort;
      }

      const leftCreatedAt = parseApiDateTime(left.created_at)?.getTime() ?? 0;
      const rightCreatedAt = parseApiDateTime(right.created_at)?.getTime() ?? 0;
      return leftCreatedAt - rightCreatedAt;
    })
    .map((item, index) => ({
      id: item.id,
      rank: index + 1,
      title: item.song_title ?? `Request #${item.id}`,
      artist: item.song_artist ?? "Unknown artist",
      total: formatUsd(item.total_amount_cents || item.original_amount_cents),
      amountCents: item.total_amount_cents || item.original_amount_cents,
      contributors: countUniqueContributors(item.contributor_count, item.contributors),
      rawStatus: item.status,
      requestedAt: formatTimeAgo(item.created_at, now.value),
    })),
);

const queuedItems = computed(() =>
  liveRows.value.filter((item) => item.rawStatus !== "played").map((item, index) => ({ ...item, rank: index + 1 })),
);
const playedItems = computed(() =>
  liveRows.value.filter((item) => item.rawStatus === "played").map((item, index) => ({ ...item, rank: index + 1 })),
);

const visibleItems = computed(() => {
  if (error.value) {
    return [];
  }

  return activeTab.value === "queued" ? queuedItems.value : playedItems.value;
});

const totalRequested = computed(() => {
  if (error.value || backendRequests.value.length === 0) {
    return formatUsd(0);
  }

  const cents = backendRequests.value.reduce(
    (total, request) => total + (request.total_amount_cents || request.original_amount_cents),
    0,
  );
  return formatUsd(cents);
});

function openPlayModal(item: QueueRow) {
  playError.value = "";
  playTarget.value = item;
}

function closePlayModal() {
  if (isPlaying.value) {
    return;
  }

  playTarget.value = null;
  playError.value = "";
}

async function confirmPlay() {
  if (!playTarget.value || isPlaying.value) {
    return;
  }

  isPlaying.value = true;
  playError.value = "";

  try {
    await markRequestPlayed(playTarget.value.id, playTarget.value.rawStatus);
    playTarget.value = null;
  } catch {
    playError.value = "Could not mark this song as played. Confirm the backend is running and try again.";
  } finally {
    isPlaying.value = false;
  }
}
</script>
