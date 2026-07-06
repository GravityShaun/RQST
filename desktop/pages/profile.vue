<template>
  <div class="page-stack">
    <section class="card">
      <div class="section-heading">
        <div>
          <div class="eyebrow">Public DJ profile</div>
          <h1 style="margin: 0 0 8px; font-size: 2.4rem">Edit the profile fans see on mobile</h1>
          <p class="muted" style="margin: 0">
            Set your display name, avatar, artist handle, bio, city, and genres. Changes save to your live DJ profile.
          </p>
        </div>
        <div v-if="!pending && !hasProfile" class="tag tag-coral">Profile required</div>
      </div>
    </section>

    <p v-if="pending" class="muted">Loading profile...</p>
    <p v-else-if="loadError" class="form-error">{{ loadError }}</p>

    <div v-else class="profile-layout">
      <section class="card profile-form-card">
        <form class="profile-form" @submit.prevent="handleSubmit">
          <div class="form-section">
            <div class="form-section-title">Account</div>

            <label class="form-field">
              <span class="form-label">Display name</span>
              <input v-model="displayName" class="form-input" maxlength="120" required type="text" />
            </label>

            <div class="form-field">
              <span class="form-label">Profile photo</span>
              <div class="avatar-upload-row">
                <div class="avatar-upload-preview">
                  <img v-if="avatarPreviewUrl" :src="avatarPreviewUrl" alt="Profile preview" />
                  <span v-else>{{ avatarInitial }}</span>
                </div>
                <div class="avatar-upload-actions">
                  <label class="btn btn-secondary avatar-upload-button">
                    {{ uploadingAvatar ? "Uploading..." : "Choose photo" }}
                    <input
                      accept="image/jpeg,image/png,image/webp"
                      class="avatar-upload-input"
                      :disabled="uploadingAvatar || saving"
                      type="file"
                      @change="handleAvatarChange"
                    />
                  </label>
                  <p class="form-help">JPEG, PNG, or WebP up to 5 MB.</p>
                </div>
              </div>
            </div>
          </div>

          <div class="form-section">
            <div class="form-section-title">Public DJ profile</div>

            <label class="form-field">
              <span class="form-label">Artist name</span>
              <input
                v-model="artistName"
                class="form-input"
                maxlength="120"
                minlength="2"
                required
                type="text"
                @input="handleArtistNameInput"
              />
            </label>

            <label class="form-field">
              <span class="form-label">Profile URL slug</span>
              <div class="slug-field">
                <span class="slug-prefix">rqst.app/djs/</span>
                <input
                  v-model="slug"
                  class="form-input slug-input"
                  maxlength="120"
                  minlength="2"
                  pattern="[a-z0-9-]+"
                  required
                  type="text"
                  @input="slugTouched = true"
                />
              </div>
              <p class="form-help">Lowercase letters, numbers, and hyphens only.</p>
            </label>

            <label class="form-field">
              <span class="form-label">Bio</span>
              <textarea v-model="bio" class="form-textarea" maxlength="500" rows="4" />
            </label>

            <label class="form-field">
              <span class="form-label">City</span>
              <input v-model="city" class="form-input" maxlength="120" type="text" />
            </label>

            <label class="form-field">
              <span class="form-label">Genres</span>
              <input
                v-model="genresInput"
                class="form-input"
                placeholder="House, Disco, R&B"
                type="text"
              />
              <p class="form-help">Separate genres with commas.</p>
            </label>
          </div>

          <p v-if="formError" class="form-error">{{ formError }}</p>
          <p v-if="saveMessage" class="form-success">{{ saveMessage }}</p>

          <div class="btn-row">
            <button class="btn btn-primary" :disabled="saving || uploadingAvatar" type="submit">
              {{ saving ? "Saving..." : hasProfile ? "Save profile" : "Create profile" }}
            </button>
          </div>
        </form>
      </section>

      <section class="card profile-preview-card">
        <div class="eyebrow">Mobile preview</div>
        <div class="section-title" style="margin-bottom: 14px">How fans will see you</div>
        <ProfilePreview
          :artist-name="artistName"
          :avatar-url="avatarPreviewUrl"
          :bio="bio"
          :city="city"
          :display-name="displayName"
          :genres="previewGenres"
          :initial="avatarInitial"
          :slug="slug"
        />
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import ProfilePreview from "~/components/ProfilePreview.vue";
import {
  formatGenresInput,
  getDisplayInitial,
  parseGenresInput,
  slugifyArtistName,
  useDjProfile,
} from "~/composables/useDjProfile";

const {
  user,
  djProfile,
  pending,
  saving,
  uploadingAvatar,
  error: loadError,
  saveMessage,
  saveProfile,
  uploadAvatar,
  resolveAvatarUrl,
} = useDjProfile();

const displayName = ref("");
const artistName = ref("");
const slug = ref("");
const bio = ref("");
const city = ref("");
const genresInput = ref("");
const slugTouched = ref(false);
const formError = ref("");
const localAvatarPreview = ref<string | null>(null);

const hasProfile = computed(() => Boolean(djProfile.value));
const previewGenres = computed(() => parseGenresInput(genresInput.value));
const avatarPreviewUrl = computed(() => localAvatarPreview.value ?? resolveAvatarUrl(user.value?.avatarUrl));
const avatarInitial = computed(() => getDisplayInitial(displayName.value || artistName.value));

watch(
  user,
  (nextUser) => {
    if (!nextUser) {
      return;
    }

    displayName.value = nextUser.displayName;
  },
  { immediate: true },
);

watch(
  djProfile,
  (nextProfile) => {
    if (!nextProfile) {
      return;
    }

    artistName.value = nextProfile.artistName;
    slug.value = nextProfile.slug;
    bio.value = nextProfile.bio ?? "";
    city.value = nextProfile.city ?? "";
    genresInput.value = formatGenresInput(nextProfile.genresJson);
    slugTouched.value = true;
  },
  { immediate: true },
);

function handleArtistNameInput() {
  if (slugTouched.value) {
    return;
  }

  slug.value = slugifyArtistName(artistName.value);
}

async function handleAvatarChange(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = "";

  if (!file) {
    return;
  }

  formError.value = "";

  if (localAvatarPreview.value) {
    URL.revokeObjectURL(localAvatarPreview.value);
  }
  localAvatarPreview.value = URL.createObjectURL(file);

  try {
    await uploadAvatar(file);
    saveMessage.value = "Photo updated.";
  } catch (uploadError) {
    formError.value = uploadError instanceof Error ? uploadError.message : "Could not upload photo.";
  }
}

function validateForm(): string | null {
  const trimmedDisplayName = displayName.value.trim();
  const trimmedArtistName = artistName.value.trim();
  const trimmedSlug = slug.value.trim();

  if (trimmedDisplayName.length < 2) {
    return "Display name must be at least 2 characters.";
  }

  if (trimmedArtistName.length < 2) {
    return "Artist name must be at least 2 characters.";
  }

  if (trimmedSlug.length < 2) {
    return "Profile slug must be at least 2 characters.";
  }

  if (!/^[a-z0-9-]+$/.test(trimmedSlug)) {
    return "Profile slug can only contain lowercase letters, numbers, and hyphens.";
  }

  return null;
}

async function handleSubmit() {
  formError.value = "";
  saveMessage.value = "";

  const validationError = validateForm();
  if (validationError) {
    formError.value = validationError;
    return;
  }

  try {
    await saveProfile({
      displayName: displayName.value,
      djProfile: {
        artistName: artistName.value,
        slug: slug.value,
        bio: bio.value,
        city: city.value,
        genres: previewGenres.value,
      },
    });
    slugTouched.value = true;
  } catch (saveError) {
    formError.value = saveError instanceof Error ? saveError.message : "Could not save profile.";
  }
}

onBeforeUnmount(() => {
  if (localAvatarPreview.value) {
    URL.revokeObjectURL(localAvatarPreview.value);
  }
});
</script>

<style scoped>
.profile-layout {
  display: grid;
  gap: 20px;
  grid-template-columns: minmax(0, 1.4fr) minmax(280px, 0.9fr);
}

.profile-form {
  display: grid;
  gap: 24px;
}

.form-section {
  display: grid;
  gap: 16px;
}

.form-section + .form-section {
  border-top: 1px solid rgba(47, 36, 36, 0.06);
  padding-top: 24px;
}

.form-section-title {
  font-size: 1.05rem;
  font-weight: 800;
}

.avatar-upload-row {
  align-items: center;
  display: flex;
  gap: 16px;
}

.avatar-upload-preview {
  align-items: center;
  background: #efe2de;
  border: 2px solid rgba(47, 36, 36, 0.08);
  border-radius: 999px;
  color: var(--rqst-ink);
  display: flex;
  flex-shrink: 0;
  font-size: 1.4rem;
  font-weight: 800;
  height: 72px;
  justify-content: center;
  overflow: hidden;
  width: 72px;
}

.avatar-upload-preview img {
  height: 100%;
  object-fit: cover;
  width: 100%;
}

.avatar-upload-actions {
  display: grid;
  gap: 6px;
}

.avatar-upload-button {
  display: inline-flex;
  justify-content: center;
  position: relative;
}

.avatar-upload-input {
  cursor: pointer;
  inset: 0;
  opacity: 0;
  position: absolute;
}

.slug-field {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.slug-prefix {
  color: var(--rqst-ink-muted);
  font-size: 0.92rem;
  font-weight: 700;
}

.slug-input {
  flex: 1;
  min-width: 180px;
}

@media (max-width: 980px) {
  .profile-layout {
    grid-template-columns: 1fr;
  }
}
</style>
