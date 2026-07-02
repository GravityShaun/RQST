<template>
  <div style="display: grid; gap: 20px">
    <section class="card" style="display: grid; gap: 10px">
      <div class="muted" style="text-transform: uppercase; letter-spacing: 0.12em; font-size: 0.72rem">Live operations</div>
      <h1 style="margin: 0; font-size: 3rem">Run the room, not the software.</h1>
      <p class="muted" style="max-width: 60ch">
        The home dashboard anchors venue selection, request minimums, QR sharing, and the nightly earnings snapshot.
      </p>
    </section>

    <section class="grid cols-3">
      <StatCard v-for="stat in data.stats" :key="stat.label" :label="stat.label" :value="stat.value" :hint="stat.hint" />
    </section>

    <section class="card" style="display: grid; gap: 14px">
      <div style="display: flex; justify-content: space-between; gap: 12px; flex-wrap: wrap">
        <div>
          <div class="muted">Quick controls</div>
          <div style="font-size: 1.4rem; font-weight: 700">Session controls</div>
        </div>
        <div style="display: flex; gap: 12px; flex-wrap: wrap">
          <button class="card" style="padding: 12px 16px; color: var(--rqst-accent)">Pause session</button>
          <button class="card" style="padding: 12px 16px">Change venue</button>
          <button class="card" style="padding: 12px 16px">Show QR</button>
        </div>
      </div>
      <p class="muted">The next implementation pass wires these controls to `backend/api/v1/dj/sessions/*` endpoints.</p>
    </section>
  </div>
</template>

<script setup lang="ts">
import StatCard from "~/components/StatCard.vue";
import { useDashboardData } from "~/composables/useDashboardData";

const data = useDashboardData();
</script>
