<template>
  <div style="display: grid; gap: 20px">
    <section class="card listener-profile-card">
      <NuxtLink class="btn btn-secondary listener-back" to="/requests">Back to queue</NuxtLink>

      <div v-if="pending" class="muted">Loading listener profile...</div>
      <div v-else-if="error" class="muted">{{ error }}</div>
      <div v-else-if="profile" class="listener-hero">
        <div class="listener-avatar">
          <img v-if="avatarUrl" :src="avatarUrl" :alt="`${profile.display_name} avatar`" />
          <span v-else>{{ initial }}</span>
        </div>
        <div class="listener-copy">
          <div class="eyebrow">Tipper profile</div>
          <h1 style="margin: 0; font-size: 2.2rem">{{ profile.display_name }}</h1>
          <p class="listener-handle">{{ profile.handle }}</p>
          <p class="muted" style="margin: 0">
            Listener who tipped during your live set. Review their support history below.
          </p>
        </div>
      </div>
    </section>

    <section v-if="profile" class="listener-stats-grid">
      <div class="card listener-stat-card">
        <div class="listener-stat-label">Requests made</div>
        <div class="listener-stat-value">{{ profile.requests_made }}</div>
      </div>
      <div class="card listener-stat-card">
        <div class="listener-stat-label">Songs supported</div>
        <div class="listener-stat-value">{{ profile.songs_supported }}</div>
      </div>
      <div class="card listener-stat-card">
        <div class="listener-stat-label">Tips sent</div>
        <div class="listener-stat-value">{{ profile.tips_sent }}</div>
      </div>
      <div class="card listener-stat-card">
        <div class="listener-stat-label">Total tipped</div>
        <div class="listener-stat-value">{{ formatUsd(profile.tips_sent_cents) }}</div>
      </div>
      <div class="card listener-stat-card">
        <div class="listener-stat-label">Total spent</div>
        <div class="listener-stat-value">{{ formatUsd(profile.total_spent_cents) }}</div>
      </div>
      <div class="card listener-stat-card">
        <div class="listener-stat-label">Member since</div>
        <div class="listener-stat-value listener-stat-value-sm">{{ memberSinceLabel }}</div>
      </div>
    </section>

    <section v-if="profile" class="card" style="display: grid; gap: 10px">
      <div class="eyebrow">About</div>
      <div class="listener-meta-row">
        <span class="listener-meta-label">Display name</span>
        <span>{{ profile.display_name }}</span>
      </div>
      <div class="listener-meta-row">
        <span class="listener-meta-label">Handle</span>
        <span>{{ profile.handle }}</span>
      </div>
      <div class="listener-meta-row">
        <span class="listener-meta-label">Verified</span>
        <span>{{ profile.is_email_verified ? "Yes" : "No" }}</span>
      </div>
      <div class="listener-meta-row">
        <span class="listener-meta-label">User ID</span>
        <span>{{ profile.id }}</span>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { apiRouteBuilders } from "@rqst/contracts";

import { useDjAuth } from "~/composables/useDjAuth";
import { getDisplayInitial, resolveAvatarUrl } from "~/composables/useDjProfile";

type ListenerProfile = {
  id: number;
  display_name: string;
  avatar_url?: string | null;
  handle: string;
  role: string;
  requests_made: number;
  songs_supported: number;
  tips_sent: number;
  tips_sent_cents: number;
  total_spent_cents: number;
  member_since: string;
  is_email_verified: boolean;
};

const route = useRoute();
const config = useRuntimeConfig();
const { ensureAuth } = useDjAuth();

const pending = ref(true);
const error = ref("");
const profile = ref<ListenerProfile | null>(null);

const listenerId = computed(() => Number(route.params.id));
const avatarUrl = computed(() => resolveAvatarUrl(config.public.apiBaseUrl, profile.value?.avatar_url));
const initial = computed(() => getDisplayInitial(profile.value?.display_name ?? "RQST"));
const memberSinceLabel = computed(() => {
  if (!profile.value?.member_since) {
    return "—";
  }
  const date = new Date(profile.value.member_since);
  if (Number.isNaN(date.getTime())) {
    return "—";
  }
  return date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
});

function formatUsd(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

async function loadProfile() {
  pending.value = true;
  error.value = "";
  profile.value = null;

  if (!Number.isFinite(listenerId.value) || listenerId.value <= 0) {
    error.value = "Listener not found.";
    pending.value = false;
    return;
  }

  try {
    const accessToken = await ensureAuth();
    const response = await fetch(
      `${config.public.apiBaseUrl}${apiRouteBuilders.djListenerProfile(listenerId.value).replace("/api/v1", "")}`,
      {
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );
    if (!response.ok) {
      throw new Error(`Request failed with ${response.status}`);
    }
    profile.value = (await response.json()) as ListenerProfile;
  } catch {
    error.value = "Could not load this listener profile.";
  } finally {
    pending.value = false;
  }
}

onMounted(() => {
  void loadProfile();
});

watch(listenerId, () => {
  void loadProfile();
});
</script>

<style scoped>
.listener-profile-card {
  display: grid;
  gap: 20px;
}

.listener-back {
  justify-self: start;
  text-decoration: none;
  width: fit-content;
}

.listener-hero {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 18px;
}

.listener-avatar {
  align-items: center;
  background: rgba(224, 90, 71, 0.12);
  border: 2px solid rgba(224, 90, 71, 0.24);
  border-radius: 999px;
  color: var(--rqst-coral);
  display: flex;
  font-size: 1.8rem;
  font-weight: 800;
  height: 88px;
  justify-content: center;
  overflow: hidden;
  width: 88px;
}

.listener-avatar img {
  height: 100%;
  object-fit: cover;
  width: 100%;
}

.listener-copy {
  display: grid;
  gap: 8px;
  min-width: 220px;
}

.listener-handle {
  color: var(--rqst-coral);
  font-size: 0.95rem;
  font-weight: 700;
  margin: 0;
}

.listener-stats-grid {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
}

.listener-stat-card {
  display: grid;
  gap: 8px;
}

.listener-stat-label {
  color: var(--rqst-ink-muted);
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.listener-stat-value {
  font-size: 1.55rem;
  font-weight: 800;
}

.listener-stat-value-sm {
  font-size: 1.15rem;
}

.listener-meta-row {
  align-items: center;
  display: flex;
  gap: 16px;
  justify-content: space-between;
}

.listener-meta-label {
  color: var(--rqst-ink-muted);
  font-size: 0.85rem;
  font-weight: 700;
  letter-spacing: 0.03em;
  text-transform: uppercase;
}
</style>
