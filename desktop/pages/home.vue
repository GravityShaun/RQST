<template>
  <div class="page-stack">
    <section class="card card-hero" style="display: grid; gap: 10px">
      <div class="eyebrow">Live operations</div>
      <h1 style="margin: 0; font-size: 3rem">Run the room, not the software.</h1>
      <p class="muted" style="max-width: 60ch">
        The home dashboard anchors venue selection, request minimums, QR sharing, and the nightly earnings snapshot.
      </p>
    </section>

    <section class="grid cols-3">
      <StatCard
        v-for="(stat, index) in data.stats"
        :key="stat.label"
        :label="stat.label"
        :value="stat.value"
        :hint="stat.hint"
        :tone="statTones[index % statTones.length]"
      />
    </section>

    <section class="card" style="display: grid; gap: 14px">
      <div class="section-heading">
        <div>
          <div class="eyebrow">Quick controls</div>
          <div class="section-title">Session controls</div>
        </div>
        <div class="btn-row">
          <button class="btn btn-primary" type="button">Pause session</button>
          <button class="btn btn-secondary" type="button">Change venue</button>
          <button class="btn btn-secondary" type="button">Show QR</button>
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
const statTones = ["gold", "mint", "slate"] as const;
</script>
