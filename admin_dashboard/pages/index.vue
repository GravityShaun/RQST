<script setup lang="ts">
const admin = useAdminConsole();

onMounted(async () => {
  await admin.bootstrap();
  if (admin.isAuthenticated.value && !admin.state.value.overview) {
    await admin.refreshAll();
  }
});

const money = (cents = 0, currency = "USD") =>
  new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);
</script>

<template>
  <section class="page-stack">
    <div class="metric-grid">
      <article class="metric-card tone-mint">
        <span>Total users</span>
        <strong>{{ admin.state.value.overview?.totalUsers ?? 0 }}</strong>
        <small>{{ admin.state.value.overview?.activeUsers ?? 0 }} active</small>
      </article>
      <article class="metric-card tone-blue">
        <span>DJs</span>
        <strong>{{ admin.state.value.overview?.totalDjs ?? 0 }}</strong>
        <small>{{ admin.state.value.overview?.liveSessions ?? 0 }} live sessions</small>
      </article>
      <article class="metric-card">
        <span>Gross payments</span>
        <strong>
          {{
            money(
              admin.state.value.overview?.paymentsOverview.totalGrossCents,
              admin.state.value.overview?.paymentsOverview.currency,
            )
          }}
        </strong>
        <small>{{ admin.state.value.overview?.paymentsOverview.succeededCount ?? 0 }} succeeded</small>
      </article>
      <article class="metric-card danger">
        <span>Open reports</span>
        <strong>{{ admin.state.value.overview?.openReports ?? 0 }}</strong>
        <small>{{ admin.state.value.overview?.paymentsOverview.disputedCount ?? 0 }} payment disputes</small>
      </article>
    </div>

    <div class="split-grid">
      <section class="panel">
        <div class="panel-heading">
          <h2>Payment Health</h2>
        </div>
        <dl class="stat-list">
          <div>
            <dt>Net earnings</dt>
            <dd>
              {{
                money(
                  admin.state.value.overview?.paymentsOverview.totalNetCents,
                  admin.state.value.overview?.paymentsOverview.currency,
                )
              }}
            </dd>
          </div>
          <div>
            <dt>Platform fees</dt>
            <dd>
              {{
                money(
                  admin.state.value.overview?.paymentsOverview.totalPlatformFeesCents,
                  admin.state.value.overview?.paymentsOverview.currency,
                )
              }}
            </dd>
          </div>
          <div>
            <dt>Refunded</dt>
            <dd>
              {{
                money(
                  admin.state.value.overview?.paymentsOverview.totalRefundedCents,
                  admin.state.value.overview?.paymentsOverview.currency,
                )
              }}
            </dd>
          </div>
          <div>
            <dt>Pending payments</dt>
            <dd>{{ admin.state.value.overview?.paymentsOverview.pendingCount ?? 0 }}</dd>
          </div>
        </dl>
      </section>

      <section class="panel">
        <div class="panel-heading">
          <h2>Recent Admin Work</h2>
        </div>
        <div class="quick-actions">
          <NuxtLink class="action-row" to="/users">Manage users and roles</NuxtLink>
          <NuxtLink class="action-row" to="/payments">Review refunds and chargebacks</NuxtLink>
          <NuxtLink class="action-row" to="/operations">Inspect DJs and live sessions</NuxtLink>
          <NuxtLink class="action-row" to="/reports">Resolve trust and safety reports</NuxtLink>
        </div>
      </section>
    </div>
  </section>
</template>
