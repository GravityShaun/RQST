<template>
  <div class="page-stack">
    <section class="card">
      <div class="eyebrow">Payments</div>
      <h1 style="margin: 0 0 8px; font-size: 2.4rem">Ledger and payout visibility</h1>
      <p class="muted">
        This page will bind to DJ earnings, payment rows, refund states, and Polar onboarding readiness.
      </p>
    </section>
    <section class="grid cols-3">
      <StatCard label="Lifetime earnings" value="$12,480" hint="Gross before fees" tone="gold" />
      <StatCard label="Pending balance" value="$144" hint="Waiting for confirmation" tone="mint" />
      <StatCard label="Available balance" value="$286" hint="Eligible for payout batch" tone="coral" />
    </section>
  </div>
</template>

<script setup lang="ts">
import StatCard from "~/components/StatCard.vue";
</script>
