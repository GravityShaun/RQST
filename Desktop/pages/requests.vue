<template>
  <div style="display: grid; gap: 20px">
    <section class="card" style="display: flex; justify-content: space-between; gap: 20px; flex-wrap: wrap">
      <div>
        <div class="muted">Active queue</div>
        <h1 style="margin: 0; font-size: 2.6rem">Ranked by live dollars</h1>
      </div>
      <div style="text-align: right">
        <div class="metric">$286</div>
        <div class="muted">Confirmed tonight</div>
      </div>
    </section>
    <QueueTable :items="data.queue" />
  </div>
</template>

<script setup lang="ts">
import QueueTable from "~/components/QueueTable.vue";
import { useDashboardData } from "~/composables/useDashboardData";

const data = useDashboardData();
</script>

