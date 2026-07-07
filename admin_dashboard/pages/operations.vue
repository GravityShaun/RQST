<script setup lang="ts">
const admin = useAdminConsole();
const sessionQuery = ref("");

onMounted(async () => {
  await admin.bootstrap();
  if (admin.isAuthenticated.value && !admin.state.value.sessions.length) {
    await Promise.all([admin.refreshSection("djs"), admin.refreshSection("sessions")]);
  }
});

const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;
const filteredSessions = computed(() => {
  const search = sessionQuery.value.trim().toLowerCase();
  return admin.state.value.sessions.filter(
    (session) =>
      !search ||
      session.djArtistName.toLowerCase().includes(search) ||
      session.venueName.toLowerCase().includes(search) ||
      String(session.id).includes(search),
  );
});
</script>

<template>
  <section class="page-stack">
    <div class="metric-grid">
      <article class="metric-card tone-blue">
        <span>DJ profiles</span>
        <strong>{{ admin.state.value.djs.length }}</strong>
        <small>{{ admin.state.value.djs.filter((dj) => dj.isPublic).length }} public</small>
      </article>
      <article class="metric-card tone-mint">
        <span>Sessions</span>
        <strong>{{ admin.state.value.sessions.length }}</strong>
        <small>{{ admin.state.value.sessions.filter((session) => session.status === "live").length }} live</small>
      </article>
      <article class="metric-card">
        <span>Requests</span>
        <strong>{{ admin.state.value.sessions.reduce((total, session) => total + session.requestCount, 0) }}</strong>
        <small>Across all sessions</small>
      </article>
      <article class="metric-card">
        <span>Session gross</span>
        <strong>{{ money(admin.state.value.sessions.reduce((total, session) => total + session.grossPaymentsCents, 0)) }}</strong>
        <small>Successful payments</small>
      </article>
    </div>

    <section class="panel">
      <div class="panel-heading">
        <h2>DJ Directory</h2>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>DJ</th>
              <th>Owner</th>
              <th>Sessions</th>
              <th>Earnings</th>
              <th>Visibility</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="dj in admin.state.value.djs" :key="dj.id">
              <td>
                <strong>{{ dj.artistName }}</strong>
                <small>{{ dj.city || "No city" }} · /{{ dj.slug }}</small>
              </td>
              <td>{{ dj.userEmail }}</td>
              <td>{{ dj.sessionCount }} <small v-if="dj.liveSessionId">Live #{{ dj.liveSessionId }}</small></td>
              <td>{{ money(dj.totalEarningsCents) }}</td>
              <td><span class="status">{{ dj.isPublic ? "Public" : "Hidden" }}</span></td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section class="panel">
      <div class="panel-heading">
        <h2>Session Controls</h2>
        <input v-model="sessionQuery" type="search" placeholder="Search sessions" />
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Session</th>
              <th>Status</th>
              <th>Requests</th>
              <th>Minimum</th>
              <th>Taking Requests</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="session in filteredSessions" :key="session.id">
              <td>
                <strong>#{{ session.id }} · {{ session.djArtistName }}</strong>
                <small>{{ session.venueName }}</small>
              </td>
              <td><span class="status">{{ session.status }}</span></td>
              <td>{{ session.requestCount }}</td>
              <td>
                <input
                  type="number"
                  min="100"
                  step="100"
                  :value="session.minimumRequestAmountCents"
                  @change="
                    admin.updateSession(session.id, {
                      minimumRequestAmountCents: Number(($event.target as HTMLInputElement).value),
                    })
                  "
                />
              </td>
              <td>
                <button
                  class="pill-button"
                  type="button"
                  @click="admin.updateSession(session.id, { acceptingRequests: !session.acceptingRequests })"
                >
                  {{ session.acceptingRequests ? "Accepting" : "Paused" }}
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </section>
</template>
