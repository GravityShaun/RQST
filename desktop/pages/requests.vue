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
      :show-deadline-column="showDeadlineColumn"
      :empty-message="queueEmptyMessage"
      show-shoutout-column
      @play="openPlayModal"
      @thank="thankTipRow"
    />

    <Teleport to="body">
      <div v-if="playTarget" class="modal-backdrop" @click.self="closePlayModal">
        <div class="modal-card" role="dialog" aria-labelledby="play-modal-title" aria-modal="true">
          <div class="eyebrow">Confirm song play</div>
          <h2 id="play-modal-title" style="margin: 0; font-size: 1.8rem">{{ playTarget.title }}</h2>
          <p class="muted" style="margin: 0">{{ playTarget.artist }}</p>
          <div class="play-amount-pill">{{ formatUsd(playTarget.songAmountCents) }}</div>
          <p v-if="playTarget.isComplimentary" class="complimentary-play-note">
            This is a free song from the code you issued. It is not a real request and there will be no charge or payout
            when played.
          </p>
          <p v-else class="muted" style="margin: 0">Mark this request as played for the room.</p>
          <div v-if="playTarget.playDeadlineExpiresAt && !playTarget.isExpired" class="deadline-play-banner">
            <div class="deadline-play-label">Play deadline</div>
            <div class="deadline-play-countdown">{{ playModalCountdown }}</div>
            <div v-if="playTarget.playDeadlinePrice" class="deadline-play-meta">
              {{ formatDeadlineDuration(playTarget.playDeadlineMinutes) ?? "Deadline" }}
              · {{ playTarget.playDeadlinePrice }}
            </div>
          </div>
          <label v-if="playTarget.hasShoutout" class="shoutout-play-option">
            <input v-model="includeShoutout" type="checkbox" />
            <span>
              Include shoutout
              <span class="muted">({{ playTarget.shoutoutPrice }})</span>
            </span>
          </label>
          <div v-if="playTarget.hasShoutout" class="shoutout-play-preview">
            <div class="shoutout-play-label">Shoutout message</div>
            <p class="shoutout-play-message">{{ playTarget.shoutoutMessage }}</p>
          </div>
          <p v-if="playError" class="play-error">{{ playError }}</p>
          <div class="btn-row" style="margin-top: 4px">
            <button class="btn btn-secondary" type="button" :disabled="isPlaying" @click="closePlayModal">Cancel</button>
            <button class="btn btn-primary" type="button" :disabled="isPlaying" @click="confirmPlay">
              {{ isPlaying ? "Playing..." : includeShoutout && playTarget.hasShoutout ? "Confirm play + shoutout" : "Confirm play" }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import QueueTable from "~/components/QueueTable.vue";
import { useSessionQueue, isActiveQueueStatus, type SessionRequest, type SessionTip } from "~/composables/useSessionQueue";
import { countUniqueContributors } from "~/utils/contributors";
import { formatDurationSeconds, formatTimeAgo, parseApiDateTime } from "~/utils/datetime";

type RequestTab = "queued" | "played";

type QueueRow = {
  id: number;
  rank: number;
  title: string;
  artist: string;
  total: string;
  amountCents: number;
  songAmountCents: number;
  contributors: number;
  rawStatus: string;
  requestedAt?: string;
  hasShoutout: boolean;
  shoutoutMessage?: string;
  shoutoutPrice?: string;
  shoutoutAmountCents: number;
  shoutoutFulfilled?: boolean | null;
  playDeadlineMinutes?: number | null;
  playDeadlineAmountCents?: number;
  playDeadlinePrice?: string;
  playDeadlineExpiresAt?: string | null;
  playDeadlineRemainingSeconds?: number | null;
  playDeadlineElapsedSeconds?: number | null;
  playDeadlineRemainingLabel?: string;
  playDeadlineElapsedLabel?: string;
  isExpired?: boolean;
  isComplimentary?: boolean;
  kind?: "request" | "tip";
  senderUserId?: number;
  senderAvatarUrl?: string | null;
  senderDisplayName?: string;
};

const requestTabs = [
  { id: "queued" as const, label: "Queued" },
  { id: "played" as const, label: "Played" },
];

const activeTab = ref<RequestTab>("queued");
const playTarget = ref<QueueRow | null>(null);
const includeShoutout = ref(false);
const playError = ref("");
const isPlaying = ref(false);
const now = ref(Date.now());

let timeAgoInterval: ReturnType<typeof setInterval> | undefined;
let playModalCountdownInterval: ReturnType<typeof setInterval> | undefined;

onMounted(() => {
  timeAgoInterval = setInterval(() => {
    now.value = Date.now();
  }, 30_000);
});

onUnmounted(() => {
  if (timeAgoInterval) {
    clearInterval(timeAgoInterval);
  }
  if (playModalCountdownInterval) {
    clearInterval(playModalCountdownInterval);
  }
});

watch(playTarget, (target) => {
  if (playModalCountdownInterval) {
    clearInterval(playModalCountdownInterval);
    playModalCountdownInterval = undefined;
  }

  if (!target?.playDeadlineExpiresAt || target.isExpired) {
    return;
  }

  now.value = Date.now();
  playModalCountdownInterval = setInterval(() => {
    now.value = Date.now();
  }, 1000);
});

function formatDeadlineDuration(minutes: number | null | undefined) {
  if (minutes == null) {
    return null;
  }
  if (minutes === 60) {
    return "1 hour";
  }
  return `${minutes} min`;
}

function formatDeadlineCountdown(expiresAt: string, nowMs = Date.now()) {
  const expiresAtDate = parseApiDateTime(expiresAt);
  const remainingMs = (expiresAtDate?.getTime() ?? 0) - nowMs;
  if (!expiresAtDate || remainingMs <= 0) {
    return "0:00";
  }

  const totalSeconds = Math.ceil(remainingMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

const playModalCountdown = computed(() => {
  if (!playTarget.value?.playDeadlineExpiresAt) {
    return null;
  }
  return formatDeadlineCountdown(playTarget.value.playDeadlineExpiresAt, now.value);
});

const { requests: backendRequests, playedRequests, expiredRequests, tips, thankedTips, pending, error, sessionId, markRequestPlayed, thankTip } = useSessionQueue();

function getEffectiveTotalCents(
  totalCents: number,
  shoutoutAmountCents: number,
  hasShoutout: boolean,
  rawStatus: string,
  shoutoutFulfilled?: boolean | null,
) {
  const isPlayed = rawStatus.toLowerCase() === "played";
  if (isPlayed && hasShoutout && !shoutoutFulfilled) {
    return Math.max(totalCents - shoutoutAmountCents, 0);
  }

  return totalCents;
}

function toTipRow(tip: SessionTip, rank: number): QueueRow {
  return {
    id: tip.id,
    rank,
    title: "Tip",
    artist: tip.sender_display_name || "RQST listener",
    total: formatUsd(tip.amount_cents),
    amountCents: tip.amount_cents,
    songAmountCents: tip.amount_cents,
    contributors: 1,
    rawStatus: tip.status,
    requestedAt: formatTimeAgo(tip.created_at, now.value),
    hasShoutout: false,
    shoutoutAmountCents: 0,
    kind: "tip",
    senderUserId: tip.user_id,
    senderAvatarUrl: tip.sender_avatar_url ?? null,
    senderDisplayName: tip.sender_display_name || "RQST listener",
  };
}

function toQueueRow(item: SessionRequest, rank: number): QueueRow {
  const shoutoutAmountCents = item.shoutout_amount_cents ?? 0;
  const hasShoutout = shoutoutAmountCents > 0 && Boolean(item.note?.trim());
  const playDeadlineAmountCents = item.play_deadline_amount_cents ?? 0;
  const playDeadlineMinutes = item.play_deadline_minutes ?? null;
  const baseTotalCents = item.total_amount_cents || item.original_amount_cents;
  const effectiveTotalCents = getEffectiveTotalCents(
    baseTotalCents,
    shoutoutAmountCents,
    hasShoutout,
    item.status,
    item.shoutout_fulfilled,
  );
  return {
    id: item.id,
    rank,
    title: item.song_title ?? `Request #${item.id}`,
    artist: item.song_artist ?? "Unknown artist",
    total: formatUsd(effectiveTotalCents),
    amountCents: effectiveTotalCents,
    songAmountCents: Math.max(baseTotalCents - shoutoutAmountCents - playDeadlineAmountCents, 0),
    contributors: countUniqueContributors(item.contributor_count, item.contributors),
    rawStatus: item.status,
    requestedAt: formatTimeAgo(item.created_at, now.value),
    hasShoutout,
    shoutoutMessage: hasShoutout ? item.note?.trim() : undefined,
    shoutoutPrice: hasShoutout ? formatUsd(shoutoutAmountCents) : undefined,
    shoutoutAmountCents,
    shoutoutFulfilled: item.shoutout_fulfilled,
    playDeadlineMinutes,
    playDeadlineAmountCents,
    playDeadlinePrice: playDeadlineAmountCents > 0 ? formatUsd(playDeadlineAmountCents) : undefined,
    playDeadlineExpiresAt: item.play_deadline_expires_at ?? null,
    playDeadlineRemainingSeconds: item.play_deadline_remaining_seconds ?? null,
    playDeadlineElapsedSeconds: item.play_deadline_elapsed_seconds ?? null,
    playDeadlineRemainingLabel: formatDurationSeconds(item.play_deadline_remaining_seconds),
    playDeadlineElapsedLabel: formatDurationSeconds(item.play_deadline_elapsed_seconds),
    isExpired: item.status.toLowerCase() === "expired",
    isComplimentary: Boolean(item.is_complimentary),
    kind: "request",
  };
}

function formatUsd(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

function sortByAmountAndCreatedAt(left: SessionRequest, right: SessionRequest) {
  const amountSort = right.total_amount_cents - left.total_amount_cents;
  if (amountSort !== 0) {
    return amountSort;
  }

  const leftCreatedAt = parseApiDateTime(left.created_at)?.getTime() ?? 0;
  const rightCreatedAt = parseApiDateTime(right.created_at)?.getTime() ?? 0;
  return leftCreatedAt - rightCreatedAt;
}

function sortQueueRowsByAmount(left: QueueRow, right: QueueRow) {
  const amountSort = right.amountCents - left.amountCents;
  if (amountSort !== 0) {
    return amountSort;
  }
  return left.id - right.id;
}

const liveRows = computed<QueueRow[]>(() =>
  [...backendRequests.value]
    .sort(sortByAmountAndCreatedAt)
    .map((item, index) => toQueueRow(item, index + 1)),
);

const timedOutRows = computed(() =>
  [...expiredRequests.value]
    .map((item) => toQueueRow(item, 0))
    .sort(sortQueueRowsByAmount),
);

const queuedItems = computed(() => {
  const active = liveRows.value
    .filter((item) => isActiveQueueStatus(item.rawStatus))
    .map((item, index) => ({ ...item, rank: index + 1 }));
  const tipRows = tips.value.map((tip, index) => toTipRow(tip, active.length + index + 1));
  const timedOut = timedOutRows.value.map((item, index) => ({
    ...item,
    rank: active.length + tipRows.length + index + 1,
  }));
  return [...active, ...tipRows, ...timedOut];
});
const playedItems = computed(() => {
  const playedSongRows = playedRequests.value.map((item, index) => toQueueRow(item, index + 1));
  const thankedTipRows = thankedTips.value.map((tip, index) =>
    toTipRow(tip, playedSongRows.length + index + 1),
  );
  return [...playedSongRows, ...thankedTipRows];
});

const visibleItems = computed(() => {
  if (error.value) {
    return [];
  }

  return activeTab.value === "queued" ? queuedItems.value : playedItems.value;
});

const showDeadlineColumn = computed(
  () =>
    (activeTab.value === "queued" &&
      queuedItems.value.some((item) => Boolean(item.playDeadlineExpiresAt) || Boolean(item.isExpired))) ||
    (activeTab.value === "played" &&
      playedItems.value.some((item) => (item.playDeadlineAmountCents ?? 0) > 0)),
);

const queueEmptyMessage = computed(() => {
  if (activeTab.value === "queued") {
    return "No queued requests yet.";
  }
  return "No played requests yet.";
});

const totalRequested = computed(() => {
  if (error.value) {
    return formatUsd(0);
  }

  const allRequests = [...backendRequests.value, ...playedRequests.value];
  const requestCents = allRequests.reduce((total, request) => {
    if (request.is_complimentary) {
      return total;
    }
    const shoutoutAmountCents = request.shoutout_amount_cents ?? 0;
    const hasShoutout = shoutoutAmountCents > 0 && Boolean(request.note?.trim());
    const baseTotalCents = request.total_amount_cents || request.original_amount_cents;
    return (
      total +
      getEffectiveTotalCents(
        baseTotalCents,
        shoutoutAmountCents,
        hasShoutout,
        request.status,
        request.shoutout_fulfilled,
      )
    );
  }, 0);
  const tipCents = [...tips.value, ...thankedTips.value].reduce(
    (total, tip) => total + tip.amount_cents,
    0,
  );
  return formatUsd(requestCents + tipCents);
});

function openPlayModal(item: QueueRow) {
  if (item.kind === "tip") {
    return;
  }
  playError.value = "";
  includeShoutout.value = false;
  playTarget.value = item;
}

async function thankTipRow(item: QueueRow) {
  if (item.kind !== "tip") {
    return;
  }

  try {
    await thankTip(item.id);
    activeTab.value = "played";
  } catch {
    playError.value = "Could not send a thank you. Confirm the backend is running and try again.";
  }
}

function closePlayModal() {
  if (isPlaying.value) {
    return;
  }

  playTarget.value = null;
  includeShoutout.value = false;
  playError.value = "";
}

async function confirmPlay() {
  if (!playTarget.value || isPlaying.value) {
    return;
  }

  isPlaying.value = true;
  playError.value = "";

  try {
    await markRequestPlayed(
      playTarget.value.id,
      playTarget.value.rawStatus,
      includeShoutout.value && playTarget.value.hasShoutout,
    );
    playTarget.value = null;
    includeShoutout.value = false;
    activeTab.value = "played";
  } catch {
    playError.value = "Could not mark this song as played. Confirm the backend is running and try again.";
  } finally {
    isPlaying.value = false;
  }
}

</script>
