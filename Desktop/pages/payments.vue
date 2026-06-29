<template>
  <div style="display: grid; gap: 20px">
    <section class="card">
      <div class="muted">Payments</div>
      <h1 style="margin: 0 0 8px; font-size: 2.4rem">Ledger and payout visibility</h1>
      <p class="muted">
        This page will bind to DJ earnings, payment rows, refund states, and Polar onboarding readiness.
      </p>
    </section>
    <section class="grid cols-3">
      <StatCard label="Lifetime earnings" value="$12,480" hint="Gross before fees" />
      <StatCard label="Pending balance" value="$144" hint="Waiting for confirmation" />
      <StatCard label="Available balance" value="$286" hint="Eligible for payout batch" />
    </section>
  </div>
</template>

<script setup lang="ts">
import StatCard from "~/components/StatCard.vue";
</script>

