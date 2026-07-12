<template>
  <div class="profile-preview">
    <div class="profile-preview-hero">
      <div class="profile-preview-hero-overlay" />
    </div>

    <div class="profile-preview-body">
      <div class="profile-preview-top">
        <div class="profile-preview-avatar">
          <img v-if="avatarUrl" :src="avatarUrl" :alt="`${displayName} avatar`" />
          <span v-else>{{ initial }}</span>
        </div>
        <div class="profile-preview-copy">
          <div class="profile-preview-name">{{ artistName || displayName || "Your DJ name" }}</div>
          <div class="profile-preview-handle">@{{ slug || "your-handle" }}</div>
          <p class="profile-preview-bio">{{ bio || "Add a short bio so fans know your vibe before they request." }}</p>
        </div>
      </div>

      <div v-if="city" class="profile-preview-location">{{ city }}</div>

      <div v-if="genres.length" class="profile-preview-tags">
        <span v-for="(genre, index) in genres" :key="genre" class="tag" :class="tagTone(index)">
          {{ genre }}
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  displayName: string;
  artistName: string;
  slug: string;
  bio: string;
  city: string;
  genres: string[];
  avatarUrl?: string | null;
  initial: string;
}>();

const tagTones = ["tag-gold", "tag-mint", "tag-slate"] as const;

function tagTone(index: number) {
  return tagTones[index % tagTones.length];
}
</script>

<style scoped>
.profile-preview {
  background: rgba(255, 255, 255, 0.72);
  border: 1.5px solid var(--rqst-border);
  border-radius: var(--rqst-radius-md);
  overflow: hidden;
}

.profile-preview-hero {
  background:
    linear-gradient(135deg, rgba(76, 95, 125, 0.88), rgba(135, 168, 216, 0.92)),
    var(--rqst-blue);
  height: 140px;
  position: relative;
}

.profile-preview-hero-overlay {
  background: rgba(30, 23, 23, 0.14);
  inset: 0;
  position: absolute;
}

.profile-preview-body {
  display: grid;
  gap: 14px;
  padding: 0 18px 18px;
}

.profile-preview-top {
  align-items: center;
  display: flex;
  gap: 14px;
  margin-top: -34px;
  position: relative;
}

.profile-preview-avatar {
  align-items: center;
  background: #efe2de;
  border: 3px solid #ffffff;
  border-radius: 999px;
  color: var(--rqst-ink);
  display: flex;
  flex-shrink: 0;
  font-size: 1.6rem;
  font-weight: 800;
  height: 84px;
  justify-content: center;
  overflow: hidden;
  width: 84px;
}

.profile-preview-avatar img {
  height: 100%;
  object-fit: cover;
  width: 100%;
}

.profile-preview-copy {
  display: grid;
  gap: 6px;
  min-width: 0;
  padding-top: 34px;
}

.profile-preview-name {
  font-size: 1.2rem;
  font-weight: 800;
}

.profile-preview-handle {
  color: var(--rqst-ink-muted);
  font-size: 0.92rem;
  font-weight: 700;
}

.profile-preview-bio {
  color: var(--rqst-ink-muted);
  font-size: 0.92rem;
  line-height: 1.5;
  margin: 0;
}

.profile-preview-location {
  color: var(--rqst-ink-muted);
  font-size: 0.86rem;
  font-weight: 700;
}

.profile-preview-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
</style>
