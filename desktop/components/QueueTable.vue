<template>
  <section class="card" style="display: grid; gap: 12px">
    <div
      class="queue-row queue-header"
      :class="{
        'has-action': showPlayButton,
        'has-shoutout': showShoutoutColumn,
        'has-deadline': showQueuedDeadline,
        'has-timer': showPlayedTimerColumn,
      }"
    >
      <span class="queue-rank-col">Rank</span>
      <span class="queue-song-col">Song</span>
      <span v-if="showShoutoutColumn" class="queue-shoutout-col">Shoutout</span>
      <span class="queue-contributors-col">Contributors</span>
      <span class="queue-time-col">{{ showQueuedDeadline ? "Deadline" : "Time Requested" }}</span>
      <span v-if="showPlayedTimerColumn" class="queue-timer-col">Timer</span>
      <span class="queue-total-col">Total</span>
      <span v-if="showPlayButton">Action</span>
    </div>
    <div v-if="items.length === 0" class="queue-empty muted">
      {{ emptyMessage ?? (showPlayButton ? "No queued requests yet." : "No played requests yet.") }}
    </div>
    <div
      v-for="item in items"
      :key="`${item.kind ?? 'request'}-${item.id}`"
      class="queue-row"
      :class="{
        'has-action': showPlayButton,
        'has-shoutout': showShoutoutColumn,
        'has-deadline': showQueuedDeadline,
        'has-timer': showPlayedTimerColumn,
        'is-expired': item.isExpired,
      }"
    >
      <span class="rank-badge queue-rank-col">#{{ item.rank }}</span>
      <div class="queue-song-col">
        <div class="song-title">{{ item.title }}</div>
        <div class="muted">{{ item.artist }}</div>
      </div>
      <div v-if="showShoutoutColumn" class="queue-shoutout-col">
        <div v-if="item.kind === 'tip'" class="tip-badge">Tip</div>
        <div v-else-if="item.hasShoutout && (showPlayButton || item.shoutoutFulfilled)" class="shoutout-cell">
          <span class="shoutout-badge">Shoutout</span>
          <div class="shoutout-tooltip" role="tooltip">
            <div class="shoutout-tooltip-message">{{ item.shoutoutMessage }}</div>
            <div class="shoutout-tooltip-price">{{ item.shoutoutPrice }}</div>
          </div>
        </div>
        <span v-else-if="item.hasShoutout" class="shoutout-badge shoutout-badge-muted">No shoutout</span>
        <span v-else class="muted">—</span>
      </div>
      <div class="queue-meta queue-contributors-col">
        <NuxtLink
          v-if="item.kind === 'tip' && item.senderUserId"
          class="tip-sender-avatar"
          :to="tipperProfilePath(item)"
          :title="`View ${item.senderDisplayName || item.artist}'s profile`"
        >
          <img
            v-if="resolveTipAvatar(item.senderAvatarUrl)"
            :src="resolveTipAvatar(item.senderAvatarUrl)!"
            :alt="`${item.senderDisplayName || item.artist} avatar`"
          />
          <span v-else>{{ tipperInitial(item) }}</span>
        </NuxtLink>
        <template v-else>
          {{ item.contributors }}
        </template>
      </div>
      <div
        class="queue-meta queue-time-col"
        :class="{ 'deadline-active': item.playDeadlineExpiresAt && !item.isExpired && showPlayButton }"
      >
        <template v-if="item.isExpired">
          <div v-if="item.playDeadlinePrice" class="deadline-cell">
            <span class="timed-out-label">Timed out</span>
            <div class="deadline-tooltip" role="tooltip">
              <div class="deadline-tooltip-message">
                {{ formatDeadlineDuration(item.playDeadlineMinutes) ?? "Deadline" }} total
              </div>
              <div class="deadline-tooltip-price">{{ item.playDeadlinePrice }}</div>
            </div>
          </div>
          <span v-else class="timed-out-label">Timed out</span>
          <div class="time-requested-sub">{{ item.requestedAt }}</div>
        </template>
        <template v-else-if="item.playDeadlineExpiresAt && showPlayButton">
          <div class="deadline-cell">
            <span class="deadline-countdown">{{ formatDeadlineCountdown(item.playDeadlineExpiresAt) }}</span>
            <div class="deadline-tooltip" role="tooltip">
              <div class="deadline-tooltip-message">
                {{ formatDeadlineDuration(item.playDeadlineMinutes) ?? "Deadline" }} total
              </div>
              <div class="deadline-tooltip-price">{{ item.playDeadlinePrice }}</div>
            </div>
          </div>
          <div class="time-requested-sub">{{ item.requestedAt }}</div>
        </template>
        <template v-else>
          {{ item.requestedAt }}
        </template>
      </div>
      <div v-if="showPlayedTimerColumn" class="queue-meta queue-timer-col">
        <div v-if="item.playDeadlinePrice" class="deadline-cell">
          <span class="timer-amount-label">{{ item.playDeadlinePrice }}</span>
          <div class="deadline-tooltip" role="tooltip">
            <div class="deadline-tooltip-message">
              {{
                item.playDeadlineElapsedLabel
                  ? `Played in ${item.playDeadlineElapsedLabel}`
                  : formatDeadlineDuration(item.playDeadlineMinutes)
                    ? `${formatDeadlineDuration(item.playDeadlineMinutes)} timer`
                    : "Deadline timer"
              }}
            </div>
            <div class="deadline-tooltip-price">{{ item.playDeadlinePrice }}</div>
          </div>
        </div>
        <span v-else class="muted">—</span>
      </div>
      <div
        class="queue-total queue-total-col"
        :class="{ 'is-complimentary-total': item.isComplimentary && !showPlayButton }"
      >
        {{ item.total }}
      </div>
      <div v-if="showPlayButton">
        <div
          v-if="item.kind === 'tip'"
          class="play-action-cell tip-action-cell"
        >
          <button
            class="btn btn-thanks"
            type="button"
            title="Send the sender a thank you message"
            @click="emit('thank', item)"
          >
            Thanks
          </button>
          <div class="thanks-tooltip" role="tooltip">
            Send the sender a thank you message
          </div>
        </div>
        <div v-else-if="canPlay(item.rawStatus)" class="play-action-cell" :class="{ 'is-complimentary': item.isComplimentary }">
          <button
            class="btn btn-play"
            :class="{ 'btn-play-complimentary': item.isComplimentary }"
            type="button"
            @click="emit('play', item)"
          >
            Play
          </button>
          <div v-if="item.isComplimentary" class="complimentary-tooltip" role="tooltip">
            This is a free song from the code you issued. It is not a real request and there will be no charge or payout
            when played
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { getDisplayInitial, resolveAvatarUrl } from "~/composables/useDjProfile";
import { parseApiDateTime } from "~/utils/datetime";

type QueueItem = {
  id: number;
  rank: number;
  title: string;
  artist: string;
  total: string;
  contributors: number;
  rawStatus: string;
  requestedAt?: string;
  hasShoutout?: boolean;
  shoutoutMessage?: string;
  shoutoutPrice?: string;
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

const props = defineProps<{
  items: QueueItem[];
  showPlayButton?: boolean;
  showShoutoutColumn?: boolean;
  showDeadlineColumn?: boolean;
  emptyMessage?: string;
}>();

const emit = defineEmits<{
  play: [item: QueueItem];
  thank: [item: QueueItem];
}>();

const config = useRuntimeConfig();
const showQueuedDeadline = computed(() => Boolean(props.showPlayButton && props.showDeadlineColumn));
const showPlayedTimerColumn = computed(() => Boolean(!props.showPlayButton && props.showDeadlineColumn));

const now = ref(Date.now());
let countdownInterval: ReturnType<typeof setInterval> | undefined;

onMounted(() => {
  countdownInterval = setInterval(() => {
    now.value = Date.now();
  }, 1000);
});

onBeforeUnmount(() => {
  if (countdownInterval) {
    clearInterval(countdownInterval);
  }
});

function canPlay(status: string) {
  const normalized = status.toLowerCase();
  return (
    normalized !== "played" &&
    normalized !== "cancelled" &&
    normalized !== "rejected" &&
    normalized !== "refunded" &&
    normalized !== "expired"
  );
}

function resolveTipAvatar(avatarUrl?: string | null) {
  return resolveAvatarUrl(config.public.apiBaseUrl, avatarUrl);
}

function tipperInitial(item: QueueItem) {
  return getDisplayInitial(item.senderDisplayName || item.artist || "RQST");
}

function tipperProfilePath(item: QueueItem) {
  return `/listeners/${item.senderUserId}`;
}

function formatDeadlineCountdown(expiresAt: string) {
  const expiresAtDate = parseApiDateTime(expiresAt);
  const remainingMs = (expiresAtDate?.getTime() ?? 0) - now.value;
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

function formatDeadlineDuration(minutes: number | null | undefined) {
  if (minutes == null) {
    return null;
  }
  if (minutes === 60) {
    return "1 hour";
  }
  return `${minutes} min`;
}
</script>

<style scoped>
.deadline-active {
  color: var(--rqst-coral);
  font-weight: 700;
}

.deadline-cell {
  position: relative;
  width: fit-content;
}

.deadline-countdown {
  cursor: default;
}

.deadline-cell:hover .deadline-tooltip,
.deadline-cell:focus-within .deadline-tooltip {
  opacity: 1;
  pointer-events: auto;
  transform: translate(-50%, 0);
  visibility: visible;
}

.deadline-tooltip {
  background: var(--rqst-shoutout-tooltip-bg);
  border: 1px solid var(--rqst-shoutout-tooltip-border);
  border-radius: 12px;
  box-shadow: var(--rqst-shoutout-tooltip-shadow);
  color: var(--rqst-shoutout-tooltip-text);
  left: 50%;
  min-width: 160px;
  opacity: 0;
  padding: 12px 14px;
  pointer-events: none;
  position: absolute;
  top: calc(100% + 8px);
  transform: translate(-50%, 4px);
  transition: opacity 0.15s ease, transform 0.15s ease, visibility 0.15s ease;
  visibility: hidden;
  z-index: 20;
}

.deadline-tooltip-message {
  color: var(--rqst-shoutout-tooltip-text);
  font-size: 0.82rem;
  font-weight: 500;
  line-height: 1.45;
  margin-bottom: 8px;
}

.deadline-tooltip-price {
  color: var(--rqst-coral);
  font-size: 0.78rem;
  font-weight: 800;
  letter-spacing: 0.01em;
}

.timer-amount-label {
  color: var(--rqst-coral);
  cursor: default;
  font-weight: 700;
}

.time-requested-sub {
  color: var(--rqst-ink-muted);
  font-size: 0.72rem;
  font-weight: 600;
  margin-top: 2px;
}

.timed-out-label {
  color: #b42318;
  cursor: default;
  font-weight: 700;
}

.queue-row.is-expired {
  opacity: 0.55;
}

.queue-row.is-expired .btn-play {
  pointer-events: none;
}

.play-action-cell {
  position: relative;
  width: fit-content;
}

.play-action-cell.is-complimentary:hover .complimentary-tooltip,
.play-action-cell.is-complimentary:focus-within .complimentary-tooltip,
.tip-action-cell:hover .thanks-tooltip,
.tip-action-cell:focus-within .thanks-tooltip {
  opacity: 1;
  pointer-events: auto;
  transform: translate(-50%, 0);
  visibility: visible;
}

.complimentary-tooltip,
.thanks-tooltip {
  background: var(--rqst-shoutout-tooltip-bg);
  border: 1px solid var(--rqst-shoutout-tooltip-border);
  border-radius: 12px;
  box-shadow: var(--rqst-shoutout-tooltip-shadow);
  color: var(--rqst-shoutout-tooltip-text);
  font-size: 0.78rem;
  font-weight: 600;
  left: 50%;
  line-height: 1.4;
  max-width: 260px;
  min-width: 220px;
  opacity: 0;
  padding: 10px 12px;
  pointer-events: none;
  position: absolute;
  top: calc(100% + 8px);
  transform: translate(-50%, 4px);
  transition: opacity 0.15s ease, transform 0.15s ease, visibility 0.15s ease;
  visibility: hidden;
  z-index: 20;
}

.tip-badge {
  background: rgba(34, 157, 111, 0.14);
  border: 1px solid rgba(34, 157, 111, 0.28);
  border-radius: 999px;
  color: #1f7a57;
  display: inline-flex;
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.02em;
  padding: 4px 10px;
  text-transform: uppercase;
  width: fit-content;
}

.tip-sender-avatar {
  align-items: center;
  background: rgba(224, 90, 71, 0.12);
  border: 1.5px solid rgba(224, 90, 71, 0.28);
  border-radius: 999px;
  color: var(--rqst-coral);
  display: inline-flex;
  font-size: 0.72rem;
  font-weight: 800;
  height: 28px;
  justify-content: center;
  overflow: hidden;
  text-decoration: none;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
  width: 28px;
}

.tip-sender-avatar:hover,
.tip-sender-avatar:focus-visible {
  box-shadow: 0 6px 14px rgba(224, 90, 71, 0.18);
  outline: none;
  transform: translateY(-1px);
}

.tip-sender-avatar img {
  height: 100%;
  object-fit: cover;
  width: 100%;
}

.btn-thanks {
  background: #22c55e;
  border-color: rgba(255, 255, 255, 0.24);
  box-shadow: 0 8px 18px rgba(34, 197, 94, 0.22);
  color: #ffffff;
  font-size: 0.75rem;
  padding: 8px 14px;
}

.btn-thanks:hover {
  background: #16a34a;
}

.queue-total.is-complimentary-total {
  color: #7c3aed;
  font-weight: 800;
  text-decoration: line-through;
  text-decoration-thickness: 2px;
}
</style>
