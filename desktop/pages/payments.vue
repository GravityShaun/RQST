<template>
  <div class="page-stack">
    <section class="card">
      <div>
        <div class="eyebrow">Payments</div>
        <h1 style="margin: 0 0 8px; font-size: 2.4rem">Earnings dashboard</h1>
        <p class="muted" style="margin: 0; max-width: 62ch">
          Every song you play adds its request funds to tonight's show pool. When the show ends, settled earnings
          move into your wallet for bank withdrawal.
        </p>
      </div>
    </section>

    <p v-if="pending && !dashboard" class="muted">Loading earnings...</p>
    <p v-else-if="error" class="form-error">{{ error }}</p>

    <template v-if="dashboard">
      <section class="grid cols-3">
        <StatCard
          label="Show pool"
          :value="formatUsd(dashboard.summary.showPoolCents, dashboard.summary.currency)"
          hint="Played tonight, waiting for show to end"
          tone="gold"
        />
        <StatCard
          label="Wallet balance"
          :value="formatUsd(dashboard.summary.walletAvailableCents, dashboard.summary.currency)"
          hint="Ready to withdraw to your bank"
          tone="mint"
        />
        <StatCard
          label="Pending play"
          :value="formatUsd(dashboard.summary.pendingConfirmationCents, dashboard.summary.currency)"
          hint="Paid requests not yet played"
          tone="slate"
        />
      </section>

      <section class="grid cols-3">
        <StatCard
          label="Lifetime gross"
          :value="formatUsd(dashboard.summary.lifetimeGrossCents, dashboard.summary.currency)"
          hint="All listener payments before fees"
          tone="blue"
        />
        <StatCard
          label="Lifetime net"
          :value="formatUsd(dashboard.summary.lifetimeNetCents, dashboard.summary.currency)"
          :hint="`Fees: ${formatUsd(totalFees, dashboard.summary.currency)}`"
          tone="coral"
        />
        <StatCard
          label="Paid out"
          :value="formatUsd(dashboard.summary.paidOutCents, dashboard.summary.currency)"
          hint="Already sent to your bank"
        />
      </section>

      <section class="card payments-wallet-card">
        <div class="section-heading">
          <div>
            <div class="eyebrow">Wallet</div>
            <div class="section-title">Withdraw to bank</div>
            <p class="muted" style="margin: 8px 0 0">
              Connect Polar to receive payouts. Funds become withdrawable after each show ends.
            </p>
          </div>
          <span class="payments-badge" :class="dashboard.summary.polarConnected ? 'badge-mint' : 'badge-gold'">
            {{ dashboard.summary.polarConnected ? "Polar connected" : "Polar not connected" }}
          </span>
        </div>

        <div class="payments-withdraw-row">
          <div class="payments-withdraw-balance">
            <div class="muted">Available now</div>
            <div class="metric">
              {{ formatUsd(dashboard.summary.walletAvailableCents, dashboard.summary.currency) }}
            </div>
          </div>
          <div class="btn-row">
            <button
              class="btn btn-primary"
              type="button"
              :disabled="withdrawing || dashboard.summary.walletAvailableCents <= 0"
              @click="withdrawAll"
            >
              {{ withdrawing ? "Processing..." : "Withdraw all" }}
            </button>
            <NuxtLink class="btn btn-secondary" to="/settings">Set up Polar</NuxtLink>
          </div>
        </div>
        <p v-if="withdrawMessage" class="payments-withdraw-message">{{ withdrawMessage }}</p>
      </section>

      <section class="card" style="display: grid; gap: 14px">
        <div>
          <div class="eyebrow">Shows</div>
          <div class="section-title">Earnings by show</div>
          <p class="muted" style="margin: 8px 0 0">
            Track how each session built its pool, what settled to your wallet, and what's still waiting on a play.
          </p>
        </div>

        <div v-if="dashboard.shows.length === 0" class="muted">No show earnings yet.</div>

        <div v-for="show in dashboard.shows" :key="show.sessionId" class="payments-show-card">
          <div class="payments-show-header">
            <div>
              <div class="payments-show-title">{{ show.eventName ?? "Live session" }}</div>
              <div class="muted">{{ show.venueName }} · {{ formatShowDates(show) }}</div>
            </div>
            <span class="payments-badge" :class="showStatusClass(show.status)">{{ formatShowStatus(show.status) }}</span>
          </div>

          <div class="payments-show-metrics">
            <div>
              <div class="muted">Gross</div>
              <div class="payments-show-value">{{ formatUsd(show.grossCents, dashboard.summary.currency) }}</div>
            </div>
            <div>
              <div class="muted">Show pool</div>
              <div class="payments-show-value">{{ formatUsd(show.showPoolCents, dashboard.summary.currency) }}</div>
            </div>
            <div>
              <div class="muted">In wallet</div>
              <div class="payments-show-value">{{ formatUsd(show.walletCents, dashboard.summary.currency) }}</div>
            </div>
            <div>
              <div class="muted">Pending play</div>
              <div class="payments-show-value">{{ formatUsd(show.pendingCents, dashboard.summary.currency) }}</div>
            </div>
            <div>
              <div class="muted">Songs played</div>
              <div class="payments-show-value">{{ show.songsPlayed }}</div>
            </div>
          </div>
        </div>
      </section>

      <section class="card" style="display: grid; gap: 12px">
        <div>
          <div class="eyebrow">Ledger</div>
          <div class="section-title">Recent song earnings</div>
        </div>

        <div v-if="dashboard.recentEntries.length === 0" class="muted">No played songs yet.</div>

        <div v-else class="payments-ledger">
          <div class="queue-row payments-ledger-header">
            <span class="queue-song-col">Song</span>
            <span>Show</span>
            <span class="payments-played-col">Played</span>
            <span>Status</span>
            <span class="queue-total-col">Amount</span>
          </div>
          <div v-for="entry in dashboard.recentEntries" :key="entry.songRequestId" class="queue-row payments-ledger-row">
            <div class="queue-song-col">
              <div class="song-title">{{ entry.songTitle ?? "Unknown song" }}</div>
              <div class="muted">{{ entry.songArtist ?? "Unknown artist" }}</div>
            </div>
            <div class="queue-meta muted">{{ entry.eventName ?? entry.venueName ?? `Session #${entry.sessionId}` }}</div>
            <div class="queue-meta payments-played-col">{{ formatEventDateTime(entry.playedAt) }}</div>
            <div>
              <span class="payments-badge" :class="payoutStatusClass(entry.payoutStatus)">
                {{ formatPayoutStatus(entry.payoutStatus) }}
              </span>
            </div>
            <div class="queue-total queue-total-col">
              {{ formatUsd(entry.songTotalCents, dashboard.summary.currency) }}
            </div>
          </div>
        </div>
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
import StatCard from "~/components/StatCard.vue";
import { formatUsd, usePaymentsDashboard } from "~/composables/usePaymentsDashboard";
import { formatEventDateTime } from "~/utils/datetime";

const { dashboard, pending, error, withdrawMessage, withdrawing, withdraw } = usePaymentsDashboard();

const totalFees = computed(() => {
  if (!dashboard.value) {
    return 0;
  }
  return dashboard.value.summary.platformFeesCents + dashboard.value.summary.processingFeesCents;
});

function formatShowDates(show: { startedAt?: string | null; endedAt?: string | null }) {
  if (show.startedAt && show.endedAt) {
    return `${formatEventDateTime(show.startedAt)} – ${formatEventDateTime(show.endedAt)}`;
  }
  if (show.startedAt) {
    return formatEventDateTime(show.startedAt);
  }
  return "Date TBD";
}

function formatShowStatus(status: string) {
  switch (status) {
    case "live":
      return "Live";
    case "paused":
      return "Paused";
    case "ended":
      return "Ended";
    case "not_started":
      return "Not started";
    default:
      return status.replaceAll("_", " ");
  }
}

function showStatusClass(status: string) {
  if (status === "live") {
    return "badge-mint";
  }
  if (status === "ended") {
    return "badge-slate";
  }
  if (status === "paused") {
    return "badge-gold";
  }
  return "badge-neutral";
}

function formatPayoutStatus(status: string) {
  switch (status) {
    case "show_pool":
      return "Show pool";
    case "in_wallet":
      return "In wallet";
    case "paid_out":
      return "Paid out";
    default:
      return status.replaceAll("_", " ");
  }
}

function payoutStatusClass(status: string) {
  if (status === "show_pool") {
    return "badge-gold";
  }
  if (status === "in_wallet") {
    return "badge-mint";
  }
  if (status === "paid_out") {
    return "badge-slate";
  }
  return "badge-neutral";
}

async function withdrawAll() {
  if (!dashboard.value || dashboard.value.summary.walletAvailableCents <= 0) {
    return;
  }
  await withdraw(dashboard.value.summary.walletAvailableCents);
}
</script>

<style scoped>
.payments-wallet-card {
  display: grid;
  gap: 16px;
}

.payments-withdraw-row {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 18px;
  justify-content: space-between;
}

.payments-withdraw-balance .metric {
  font-size: 2rem;
}

.payments-withdraw-message {
  color: var(--rqst-coral);
  margin: 0;
}

.payments-show-card {
  background: var(--rqst-surface);
  border: 1.5px solid var(--rqst-border);
  border-radius: var(--rqst-radius-md);
  display: grid;
  gap: 14px;
  padding: 16px;
}

.payments-show-header {
  align-items: flex-start;
  display: flex;
  gap: 12px;
  justify-content: space-between;
}

.payments-show-title {
  font-size: 1.1rem;
  font-weight: 700;
}

.payments-show-metrics {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(5, minmax(0, 1fr));
}

.payments-show-value {
  font-size: 1.05rem;
  font-weight: 700;
}

.payments-ledger-header,
.payments-ledger-row {
  gap: 10px 18px;
  grid-template-columns: minmax(0, 2fr) minmax(0, 1.2fr) 120px 108px 88px;
}

.payments-played-col {
  white-space: nowrap;
}

.payments-ledger-header span:nth-child(4),
.payments-ledger-row > div:nth-child(4) {
  padding-left: 12px;
}

.payments-ledger-header {
  color: var(--rqst-muted);
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.payments-badge {
  align-items: center;
  border: 1px solid transparent;
  border-radius: 999px;
  display: inline-flex;
  font-size: 0.78rem;
  font-weight: 700;
  justify-content: center;
  line-height: 1.2;
  min-height: 28px;
  padding: 5px 10px;
  text-align: center;
  white-space: nowrap;
}

.badge-gold {
  background: #f2c6a6;
  border-color: rgba(74, 52, 40, 0.12);
  color: #4a3428;
}

.badge-mint {
  background: #abdccf;
  border-color: rgba(31, 64, 56, 0.12);
  color: #1f4038;
}

.badge-slate {
  background: #d8c8c8;
  border-color: rgba(58, 46, 50, 0.12);
  color: #3a2e32;
}

.badge-neutral {
  background: var(--rqst-surface-muted);
  border-color: var(--rqst-border);
  color: var(--rqst-ink);
}

[data-theme="dark"] .badge-gold {
  background: rgba(201, 160, 122, 0.28);
  border-color: rgba(243, 198, 166, 0.24);
  color: #f3d4b8;
}

[data-theme="dark"] .badge-mint {
  background: rgba(122, 184, 168, 0.24);
  border-color: rgba(171, 220, 207, 0.22);
  color: #c8ebe2;
}

[data-theme="dark"] .badge-slate {
  background: rgba(122, 155, 184, 0.22);
  border-color: rgba(186, 210, 240, 0.18);
  color: #d4e4f4;
}

@media (max-width: 960px) {
  .payments-show-metrics {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .payments-ledger-header,
  .payments-ledger-row {
    grid-template-columns: minmax(0, 1.6fr) minmax(0, 1fr) 88px;
  }

  .payments-ledger-header span:nth-child(4),
  .payments-ledger-header span:nth-child(5),
  .payments-ledger-row > div:nth-child(4),
  .payments-ledger-row > div:nth-child(5) {
    grid-column: 1 / -1;
  }
}
</style>
