<template>
  <div style="display: grid; gap: 20px">
    <section class="card" style="display: flex; justify-content: space-between; gap: 20px; flex-wrap: wrap">
      <div>
        <div class="muted">Active queue</div>
        <h1 style="margin: 0; font-size: 2.6rem">Ranked by live dollars</h1>
        <p v-if="pending" class="muted" style="margin: 8px 0 0">Loading live requests...</p>
        <p v-else-if="error" class="muted" style="margin: 8px 0 0">Showing local queue until the backend is reachable.</p>
      </div>
      <div style="text-align: right">
        <div class="metric">{{ totalRequested }}</div>
        <div class="muted">Requested tonight</div>
      </div>
    </section>
    <QueueTable :items="queueItems" />
  </div>
</template>

<script setup lang="ts">
import QueueTable from "~/components/QueueTable.vue";
import { useDashboardData } from "~/composables/useDashboardData";

type ApiRequest = {
  id: number;
  status: string;
  original_amount_cents: number;
  total_amount_cents: number;
  created_at: string;
  song_title?: string | null;
  song_artist?: string | null;
  contributor_count?: number | null;
};

type QueueRow = {
  rank: number;
  title: string;
  artist: string;
  total: string;
  contributors: number;
  status: string;
  requestedAt?: string;
};

const fallbackData = useDashboardData();
const config = useRuntimeConfig();
const sessionId = 1;
const requestUrl = `${config.public.apiBaseUrl}/sessions/${sessionId}/requests`;
const { data: backendRequests, pending, error } = await useFetch<ApiRequest[]>(requestUrl, {
  default: () => [],
});

function formatUsd(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

function formatStatus(status: string) {
  return status
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatRequestedAt(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

const liveRows = computed<QueueRow[]>(() =>
  [...(backendRequests.value ?? [])]
    .sort((left, right) => {
      const amountSort = right.total_amount_cents - left.total_amount_cents;
      return amountSort === 0 ? new Date(left.created_at).getTime() - new Date(right.created_at).getTime() : amountSort;
    })
    .map((item, index) => ({
      rank: index + 1,
      title: item.song_title ?? `Request #${item.id}`,
      artist: item.song_artist ?? "Unknown artist",
      total: formatUsd(item.total_amount_cents || item.original_amount_cents),
      contributors: item.contributor_count ?? 0,
      status: formatStatus(item.status),
      requestedAt: formatRequestedAt(item.created_at),
    })),
);
const queueItems = computed(() => (liveRows.value.length ? liveRows.value : fallbackData.queue));
const totalRequested = computed(() => {
  if (!liveRows.value.length) {
    return "$286";
  }

  const cents = (backendRequests.value ?? []).reduce(
    (total, request) => total + (request.total_amount_cents || request.original_amount_cents),
    0,
  );
  return formatUsd(cents);
});
</script>
