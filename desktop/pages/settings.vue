<template>
  <div class="page-stack">
    <section class="card settings-hero">
      <div class="settings-hero-copy">
        <div class="eyebrow">Settings</div>
        <h1 style="margin: 0 0 8px; font-size: 2.4rem">Session defaults, payouts, and notifications</h1>
        <p class="muted" style="margin: 0">
          Account security, Polar onboarding, sound alerts, visibility settings, and legal links all anchor here.
        </p>
      </div>

      <div class="settings-profile-card">
        <div class="settings-avatar">
          <img v-if="avatarUrl" :src="avatarUrl" alt="Profile photo" />
          <span v-else>{{ avatarInitial }}</span>
        </div>
        <div class="settings-profile-copy">
          <div class="settings-profile-name">{{ user?.displayName ?? "DJ" }}</div>
          <div class="settings-profile-email">{{ user?.email ?? "Signed in to RQST." }}</div>
        </div>
        <div class="settings-pill-row">
          <span class="tag tag-mint">{{ roleLabel }}</span>
          <span class="tag" :class="user?.isEmailVerified ? 'tag-mint' : 'tag-gold'">
            {{ user?.isEmailVerified ? "Email verified" : "Email pending" }}
          </span>
          <span v-if="djProfile" class="tag tag-slate">{{ djProfile.isPublic ? "Public profile" : "Private profile" }}</span>
        </div>
      </div>
    </section>

    <section class="grid cols-3">
      <NuxtLink class="settings-link-card" to="/profile">
        <div class="eyebrow">Profile</div>
        <div class="settings-link-title">Edit public DJ profile</div>
        <p class="muted settings-link-copy">Avatar, artist name, bio, city, and genres.</p>
        <span class="settings-link-action">Open profile</span>
      </NuxtLink>

      <NuxtLink class="settings-link-card" to="/payments">
        <div class="eyebrow">Payments</div>
        <div class="settings-link-title">Ledger and payouts</div>
        <p class="muted settings-link-copy">Earnings, pending balance, and Polar onboarding.</p>
        <span class="settings-link-action">View payments</span>
      </NuxtLink>

      <div class="settings-link-card settings-link-card-static">
        <div class="eyebrow">Polar</div>
        <div class="settings-link-title">Payout onboarding</div>
        <p class="muted settings-link-copy">Connect Polar to receive nightly payout batches.</p>
        <span class="tag tag-gold">Not connected</span>
      </div>
    </section>

    <section class="card settings-section">
      <div class="settings-section-header">
        <div>
          <div class="eyebrow">Appearance</div>
          <div class="section-title">Color theme</div>
        </div>
      </div>

      <div class="settings-appearance-copy">
        <p class="muted" style="margin: 0">
          Choose light or dark mode, or match your device settings automatically.
        </p>
      </div>

      <div class="segment-tabs cols-3" role="group" aria-label="Color theme">
        <button
          class="segment-tab"
          :class="{ 'is-selected': settings.colorScheme === 'system' }"
          type="button"
          @click="settings.colorScheme = 'system'"
        >
          System
        </button>
        <button
          class="segment-tab"
          :class="{ 'is-selected': settings.colorScheme === 'light' }"
          type="button"
          @click="settings.colorScheme = 'light'"
        >
          Light
        </button>
        <button
          class="segment-tab"
          :class="{ 'is-selected': settings.colorScheme === 'dark' }"
          type="button"
          @click="settings.colorScheme = 'dark'"
        >
          Dark
        </button>
      </div>
    </section>

    <section class="card settings-section">
      <div class="settings-section-header">
        <div>
          <div class="eyebrow">Preferences</div>
          <div class="section-title">Session alerts</div>
        </div>
      </div>

      <div class="settings-rows">
        <label class="settings-row">
          <div class="settings-row-copy">
            <div class="settings-row-title">Sound alerts</div>
            <div class="settings-row-subtitle">Play a chime when a new request lands in the queue.</div>
          </div>
          <input v-model="settings.soundAlerts" class="settings-toggle" type="checkbox" />
        </label>

        <label class="settings-row">
          <div class="settings-row-copy">
            <div class="settings-row-title">Desktop notifications</div>
            <div class="settings-row-subtitle">Show native alerts for queue updates while the console is open.</div>
          </div>
          <input v-model="settings.desktopNotifications" class="settings-toggle" type="checkbox" />
        </label>

        <label class="settings-row">
          <div class="settings-row-copy">
            <div class="settings-row-title">Confirm before play</div>
            <div class="settings-row-subtitle">Require confirmation before marking a request as played.</div>
          </div>
          <input v-model="settings.confirmBeforePlay" class="settings-toggle" type="checkbox" />
        </label>
      </div>
    </section>

    <section class="card settings-section">
      <div class="settings-section-header">
        <div>
          <div class="eyebrow">Account</div>
          <div class="section-title">The essentials</div>
        </div>
      </div>

      <div class="settings-rows">
        <div class="settings-row settings-row-static">
          <div class="settings-row-copy">
            <div class="settings-row-title">Account email</div>
            <div class="settings-row-subtitle">{{ user?.email ?? "—" }}</div>
          </div>
          <span class="tag tag-slate">{{ roleLabel }}</span>
        </div>

        <div class="settings-row settings-row-static">
          <div class="settings-row-copy">
            <div class="settings-row-title">Display name</div>
            <div class="settings-row-subtitle">{{ user?.displayName ?? "—" }}</div>
          </div>
          <NuxtLink class="settings-inline-link" to="/profile">Edit</NuxtLink>
        </div>

        <div v-if="djProfile" class="settings-row settings-row-static">
          <div class="settings-row-copy">
            <div class="settings-row-title">Public profile URL</div>
            <div class="settings-row-subtitle">rqst.app/djs/{{ djProfile.slug }}</div>
          </div>
          <span class="tag" :class="djProfile.isPublic ? 'tag-mint' : 'tag-gold'">
            {{ djProfile.isPublic ? "Live" : "Hidden" }}
          </span>
        </div>

        <div class="settings-row settings-row-static">
          <div class="settings-row-copy">
            <div class="settings-row-title">Security</div>
            <div class="settings-row-subtitle">Password-protected session on this device.</div>
          </div>
          <span class="tag tag-mint">Good</span>
        </div>

        <button
          class="settings-logout"
          :disabled="loggingOut"
          type="button"
          @click="handleLogout"
        >
          <span class="settings-logout-icon" aria-hidden="true">↪</span>
          <span class="settings-logout-copy">
            <span class="settings-logout-title">{{ loggingOut ? "Signing out..." : "Log out" }}</span>
            <span class="settings-logout-subtitle">Sign out of this device.</span>
          </span>
        </button>
      </div>
    </section>

    <section class="grid cols-3">
      <section class="card settings-section">
        <div class="settings-section-header">
          <div>
            <div class="eyebrow">Help</div>
            <div class="section-title">Support and details</div>
          </div>
        </div>

        <div class="settings-rows">
          <a class="settings-action-row" href="https://rqst.app/faq" rel="noopener noreferrer" target="_blank">
            <div class="settings-row-copy">
              <div class="settings-row-title">FAQ</div>
              <div class="settings-row-subtitle">Questions about requests and refunds.</div>
            </div>
            <span class="settings-inline-link">Open</span>
          </a>

          <a class="settings-action-row" href="mailto:support@rqst.app">
            <div class="settings-row-copy">
              <div class="settings-row-title">Support</div>
              <div class="settings-row-subtitle">Contact the RQST team.</div>
            </div>
            <span class="settings-inline-link">Email</span>
          </a>

          <a
            class="settings-action-row"
            href="https://rqst.app/terms"
            rel="noopener noreferrer"
            target="_blank"
          >
            <div class="settings-row-copy">
              <div class="settings-row-title">Terms</div>
              <div class="settings-row-subtitle">Policy and payment details.</div>
            </div>
            <span class="settings-inline-link">Read</span>
          </a>
        </div>
      </section>

      <section class="card settings-section">
        <div class="settings-section-header">
          <div>
            <div class="eyebrow">App</div>
            <div class="section-title">Connection</div>
          </div>
        </div>

        <div class="settings-rows">
          <div class="settings-row settings-row-static">
            <div class="settings-row-copy">
              <div class="settings-row-title">API endpoint</div>
              <div class="settings-row-subtitle settings-mono">{{ apiBaseUrl }}</div>
            </div>
          </div>

          <div class="settings-row settings-row-static">
            <div class="settings-row-copy">
              <div class="settings-row-title">WebSocket endpoint</div>
              <div class="settings-row-subtitle settings-mono">{{ wsBaseUrl }}</div>
            </div>
          </div>

          <div class="settings-row settings-row-static">
            <div class="settings-row-copy">
              <div class="settings-row-title">Console version</div>
              <div class="settings-row-subtitle">RQST DJ Console {{ appVersion }}</div>
            </div>
          </div>
        </div>
      </section>
    </section>
  </div>
</template>

<script setup lang="ts">
import { useDesktopSettings } from "~/composables/useDesktopSettings";
import { useDjAuth } from "~/composables/useDjAuth";
import { getDisplayInitial, resolveAvatarUrl, useDjProfile } from "~/composables/useDjProfile";

const config = useRuntimeConfig();
const { user, signOut } = useDjAuth();
const { djProfile } = useDjProfile();
const { settings } = useDesktopSettings();

const loggingOut = ref(false);

const apiBaseUrl = config.public.apiBaseUrl;
const wsBaseUrl = config.public.wsBaseUrl;
const appVersion = "0.1.0";

const avatarUrl = computed(() => resolveAvatarUrl(apiBaseUrl, user.value?.avatarUrl));
const avatarInitial = computed(() => getDisplayInitial(user.value?.displayName ?? "DJ"));
const roleLabel = computed(() => {
  const role = user.value?.role;
  if (role === "dj") {
    return "DJ";
  }
  if (role === "admin") {
    return "Admin";
  }
  return "Member";
});

async function handleLogout() {
  loggingOut.value = true;

  try {
    await signOut();
    await navigateTo("/login");
  } finally {
    loggingOut.value = false;
  }
}
</script>

<style scoped>
.settings-hero {
  display: grid;
  gap: 22px;
}

.settings-profile-card {
  align-items: center;
  background:
    linear-gradient(135deg, rgba(224, 90, 71, 0.92), rgba(217, 94, 79, 0.82)),
    var(--rqst-coral);
  border: 1.5px solid rgba(255, 255, 255, 0.22);
  border-radius: var(--rqst-radius-md);
  color: var(--rqst-text);
  display: grid;
  gap: 14px;
  justify-items: center;
  padding: 24px;
  text-align: center;
}

.settings-avatar {
  align-items: center;
  background: rgba(255, 255, 255, 0.18);
  border: 2px solid rgba(255, 255, 255, 0.28);
  border-radius: 999px;
  display: flex;
  font-size: 1.6rem;
  font-weight: 800;
  height: 84px;
  justify-content: center;
  overflow: hidden;
  width: 84px;
}

.settings-avatar img {
  height: 100%;
  object-fit: cover;
  width: 100%;
}

.settings-profile-name {
  font-size: 1.8rem;
  font-weight: 800;
}

.settings-profile-email {
  color: rgba(255, 249, 247, 0.82);
  font-size: 0.95rem;
}

.settings-pill-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: center;
}

.settings-link-card {
  background: var(--rqst-surface-elevated);
  border: 1.5px solid var(--rqst-border);
  border-radius: var(--rqst-radius-md);
  box-shadow: var(--rqst-shadow-soft);
  display: grid;
  gap: 8px;
  padding: 18px;
  transition:
    box-shadow 0.18s ease,
    transform 0.18s ease;
}

.settings-link-card:hover {
  box-shadow: var(--rqst-shadow);
  transform: translateY(-1px);
}

.settings-link-card-static {
  cursor: default;
}

.settings-link-card-static:hover {
  transform: none;
}

.settings-link-title {
  font-size: 1.15rem;
  font-weight: 800;
}

.settings-link-copy {
  margin: 0;
}

.settings-link-action {
  color: var(--rqst-coral);
  font-size: 0.88rem;
  font-weight: 800;
}

.settings-mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.82rem;
  word-break: break-all;
}

.settings-appearance-copy {
  margin-bottom: 4px;
}
</style>
