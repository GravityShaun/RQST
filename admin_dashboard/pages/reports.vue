<script setup lang="ts">
const admin = useAdminConsole();

onMounted(async () => {
  await admin.bootstrap();
  if (admin.isAuthenticated.value && !admin.state.value.reports.length) await admin.refreshSection("reports");
});
</script>

<template>
  <section class="page-stack">
    <section class="panel">
      <div class="panel-heading">
        <h2>Trust Reports</h2>
        <span>{{ admin.state.value.reports.filter((report) => report.status === "open").length }} open</span>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Report</th>
              <th>Target</th>
              <th>Reporter</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="report in admin.state.value.reports" :key="report.id">
              <td>
                <strong>#{{ report.id }} · {{ report.reason }}</strong>
                <small>{{ new Date(report.createdAt).toLocaleString() }}</small>
              </td>
              <td>{{ report.targetType }} #{{ report.targetId }}</td>
              <td>{{ report.reporterDisplayName }} (#{{ report.reporterUserId }})</td>
              <td><span class="status" :class="{ bad: report.status === 'open' }">{{ report.status }}</span></td>
              <td>
                <button
                  class="secondary-button"
                  type="button"
                  :disabled="report.status !== 'open'"
                  @click="admin.resolveReport(report.id)"
                >
                  Resolve
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </section>
</template>
