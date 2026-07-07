<script setup lang="ts">
import type { AdminPayment, PaymentStatus } from "~/lib/admin-api";

const admin = useAdminConsole();
const query = ref("");
const status = ref<"all" | PaymentStatus>("all");
const actionReason = ref("Admin console action");

onMounted(async () => {
  await admin.bootstrap();
  if (admin.isAuthenticated.value && !admin.state.value.payments.length) await admin.refreshSection("payments");
});

const money = (cents: number, currency: string) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);

const filteredPayments = computed(() => {
  const search = query.value.trim().toLowerCase();
  return admin.state.value.payments.filter((payment) => {
    const matchesSearch =
      !search ||
      payment.userEmail.toLowerCase().includes(search) ||
      payment.userDisplayName.toLowerCase().includes(search) ||
      (payment.songTitle || "").toLowerCase().includes(search) ||
      String(payment.id).includes(search);
    const matchesStatus = status.value === "all" || payment.status === status.value;
    return matchesSearch && matchesStatus;
  });
});

function canReverse(payment: AdminPayment) {
  return !["payment_refunded", "payment_disputed", "payment_failed", "payment_cancelled"].includes(payment.status);
}
</script>

<template>
  <section class="page-stack">
    <div class="toolbar">
      <input v-model="query" type="search" placeholder="Search payments, users, songs" />
      <select v-model="status">
        <option value="all">All payment states</option>
        <option value="payment_succeeded">Succeeded</option>
        <option value="checkout_started">Checkout started</option>
        <option value="payment_pending">Pending</option>
        <option value="payment_failed">Failed</option>
        <option value="payment_refunded">Refunded</option>
        <option value="payment_disputed">Disputed</option>
      </select>
      <input v-model="actionReason" placeholder="Action note" />
    </div>

    <section class="panel">
      <div class="panel-heading">
        <h2>Payments</h2>
        <span>{{ filteredPayments.length }} records</span>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Payment</th>
              <th>User</th>
              <th>DJ / Session</th>
              <th>Gross</th>
              <th>Fees</th>
              <th>Net</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="payment in filteredPayments" :key="payment.id">
              <td>
                <strong>#{{ payment.id }} · {{ payment.songTitle || "Song request" }}</strong>
                <small>{{ payment.songArtist || "Unknown artist" }} · {{ payment.provider }}</small>
              </td>
              <td>
                <strong>{{ payment.userDisplayName }}</strong>
                <small>{{ payment.userEmail }}</small>
              </td>
              <td>
                <strong>{{ payment.djArtistName || "Unknown DJ" }}</strong>
                <small>Session #{{ payment.sessionId }} · Request #{{ payment.songRequestId }}</small>
              </td>
              <td>{{ money(payment.grossAmountCents, payment.currency) }}</td>
              <td>{{ money(payment.platformFeeCents + payment.processingFeeCents, payment.currency) }}</td>
              <td>{{ money(payment.netAmountCents, payment.currency) }}</td>
              <td><span class="status">{{ payment.status.replaceAll("_", " ") }}</span></td>
              <td>
                <span class="action-buttons">
                  <button
                    class="secondary-button"
                    type="button"
                    :disabled="!canReverse(payment)"
                    @click="admin.refundPayment(payment.id, actionReason)"
                  >
                    Refund
                  </button>
                  <button
                    class="danger-button"
                    type="button"
                    :disabled="!canReverse(payment)"
                    @click="admin.chargebackPayment(payment.id, actionReason)"
                  >
                    Chargeback
                  </button>
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </section>
</template>
