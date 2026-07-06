<template>
  <div class="page-stack">
    <section class="card">
      <div class="section-heading">
        <div>
          <div class="eyebrow">Tour calendar</div>
          <h1 style="margin: 0 0 8px; font-size: 2.4rem">Shows & events</h1>
          <p class="muted" style="margin: 0">
            Add upcoming gigs with venue details, dates, ticket links, and flyers. Fans will see these on your profile.
          </p>
        </div>
        <button class="btn btn-primary" type="button" @click="startCreate">
          {{ showForm ? "Cancel" : "Add show" }}
        </button>
      </div>
    </section>

    <p v-if="pending" class="muted">Loading shows...</p>
    <p v-else-if="error && !showForm" class="form-error">{{ error }}</p>

    <section v-if="showForm" class="card shows-form-card">
      <div class="section-title">{{ editingEventId ? "Edit show" : "New show" }}</div>

      <form class="shows-form" @submit.prevent="handleSubmit">
        <div class="form-section">
          <div class="form-section-title">Event details</div>

          <label class="form-field">
            <span class="form-label">Show name</span>
            <input v-model="form.name" class="form-input" maxlength="255" required type="text" />
          </label>

          <label class="form-field">
            <span class="form-label">Description</span>
            <textarea v-model="form.description" class="form-textarea" maxlength="1000" rows="3" />
          </label>

          <div class="form-grid-two">
            <label class="form-field">
              <span class="form-label">Starts</span>
              <input v-model="form.startsAt" class="form-input" required type="datetime-local" />
            </label>

            <label class="form-field">
              <span class="form-label">Ends (optional)</span>
              <input v-model="form.endsAt" class="form-input" type="datetime-local" />
            </label>
          </div>

          <label class="form-field">
            <span class="form-label">Ticket URL</span>
            <input v-model="form.ticketUrl" class="form-input" placeholder="https://" type="url" />
          </label>
        </div>

        <div class="form-section">
          <div class="form-section-title">Venue</div>

          <label class="form-field">
            <span class="form-label">Search venues</span>
            <input
              v-model="venueSearchQuery"
              class="form-input"
              placeholder="Search club, bar, festival, address..."
              type="search"
              @focus="venueSearchFocused = true"
            />
            <p class="form-help">
              Searches venues previously added by DJs, then OpenStreetMap for new locations.
            </p>
          </label>

          <div v-if="searchingPlaces" class="muted place-search-status">Searching venues...</div>

          <ul v-else-if="venueSearchFocused && placeResults.length" class="place-results">
            <li v-for="place in placeResults" :key="`${place.source}-${place.placeId}`">
              <button class="place-result-button" type="button" @click="applyPlace(place)">
                <span class="place-result-header">
                  <span class="place-result-name">{{ place.name }}</span>
                  <span
                    class="place-result-source"
                    :class="place.source === 'database' ? 'place-result-source-db' : 'place-result-source-online'"
                  >
                    {{ place.source === "database" ? "Previously used" : "Online" }}
                  </span>
                </span>
                <span class="place-result-address">{{ place.displayName }}</span>
              </button>
            </li>
          </ul>

          <label class="form-field">
            <span class="form-label">Venue name</span>
            <input
              v-model="form.venue.name"
              class="form-input"
              maxlength="255"
              required
              type="text"
              @input="clearSelectedVenueId"
            />
          </label>

          <label class="form-field">
            <span class="form-label">Street address</span>
            <input
              v-model="form.venue.address"
              class="form-input"
              maxlength="255"
              required
              type="text"
              @input="clearSelectedVenueId"
            />
          </label>

          <div class="form-grid-three">
            <label class="form-field">
              <span class="form-label">City</span>
              <input
                v-model="form.venue.city"
                class="form-input"
                maxlength="120"
                required
                type="text"
                @input="clearSelectedVenueId"
              />
            </label>

            <label class="form-field">
              <span class="form-label">State / region</span>
              <input
                v-model="form.venue.state"
                class="form-input"
                maxlength="120"
                type="text"
                @input="clearSelectedVenueId"
              />
            </label>

            <label class="form-field">
              <span class="form-label">Country</span>
              <input
                v-model="form.venue.country"
                class="form-input"
                maxlength="120"
                required
                type="text"
                @input="clearSelectedVenueId"
              />
            </label>
          </div>
        </div>

        <div class="form-section">
          <div class="form-section-title">Flyer</div>
          <div class="flyer-upload-row">
            <div v-if="flyerPreviewUrl" class="flyer-preview">
              <img :src="flyerPreviewUrl" alt="Show flyer preview" />
            </div>
            <div class="flyer-upload-actions">
              <label class="btn btn-secondary flyer-upload-button">
                {{ pendingFlyerFile ? "Change flyer" : "Choose flyer" }}
                <input
                  accept="image/jpeg,image/png,image/webp"
                  class="flyer-upload-input"
                  :disabled="saving || uploadingFlyer"
                  type="file"
                  @change="handleFlyerChange"
                />
              </label>
              <p v-if="pendingFlyerFile && !editingEventId" class="form-help">
                Flyer uploads when you create the show.
              </p>
              <p v-else class="form-help">JPEG, PNG, or WebP up to 8 MB.</p>
              <button
                v-if="pendingFlyerFile"
                class="btn btn-secondary flyer-clear-button"
                :disabled="saving || uploadingFlyer"
                type="button"
                @click="clearPendingFlyer"
              >
                Remove flyer
              </button>
            </div>
          </div>
        </div>

        <p v-if="formError" class="form-error">{{ formError }}</p>
        <p v-if="saveMessage" class="form-success">{{ saveMessage }}</p>

        <div class="btn-row">
          <button class="btn btn-primary" :disabled="saving || uploadingFlyer" type="submit">
            {{
              saving
                ? pendingFlyerFile && !editingEventId
                  ? "Creating show..."
                  : "Saving..."
                : editingEventId
                  ? "Save changes"
                  : "Create show"
            }}
          </button>
        </div>
      </form>
    </section>

    <section v-if="!pending" class="shows-list">
      <div v-if="sortedEvents.length === 0" class="card empty-state">
        <div class="section-title">No shows yet</div>
        <p class="muted" style="margin: 0">Add your first upcoming gig so fans know where to find you.</p>
      </div>

      <article v-for="event in sortedEvents" :key="event.id" class="card show-card">
        <div class="show-card-layout">
          <div v-if="resolveAssetUrl(event.flyerUrl)" class="show-flyer">
            <img :src="resolveAssetUrl(event.flyerUrl)!" :alt="`${event.name} flyer`" />
          </div>

          <div class="show-card-body">
            <div class="show-card-header">
              <div>
                <div class="show-date">{{ formatEventDateTime(event.startsAt) }}</div>
                <h2 class="show-title">{{ event.name }}</h2>
                <div class="show-venue">{{ event.venue.name }}</div>
                <div class="show-address">
                  {{ event.venue.address }}, {{ event.venue.city
                  }}<template v-if="event.venue.state">, {{ event.venue.state }}</template>
                </div>
              </div>
              <div class="show-card-actions">
                <button class="btn btn-secondary" type="button" @click="startEdit(event)">Edit</button>
                <button
                  class="btn btn-secondary"
                  :disabled="saving"
                  type="button"
                  @click="handleDelete(event.id)"
                >
                  Delete
                </button>
              </div>
            </div>

            <p v-if="event.description" class="show-description">{{ event.description }}</p>

            <div class="show-meta">
              <span v-if="event.endsAt" class="tag">Ends {{ formatEventDateTime(event.endsAt) }}</span>
              <a
                v-if="event.ticketUrl"
                class="tag tag-coral"
                :href="event.ticketUrl"
                rel="noopener noreferrer"
                target="_blank"
              >
                Tickets
              </a>
            </div>
          </div>
        </div>
      </article>
    </section>
  </div>
</template>

<script setup lang="ts">
import type { DjEvent, PlaceSearchResult } from "@rqst/contracts";

import {
  emptyEventForm,
  useDjEvents,
  type EventFormInput,
} from "~/composables/useDjEvents";
import {
  formatEventDateTime,
  fromDateTimeLocalValue,
  toDateTimeLocalValue,
} from "~/utils/datetime";

const {
  events,
  pending,
  saving,
  uploadingFlyer,
  searchingPlaces,
  placeResults,
  error,
  saveMessage,
  searchPlaces,
  createEvent,
  updateEvent,
  deleteEvent,
  resolveAssetUrl,
} = useDjEvents();

const showForm = ref(false);
const editingEventId = ref<number | null>(null);
const form = ref<EventFormInput>(emptyEventForm());
const formError = ref("");
const venueSearchQuery = ref("");
const venueSearchFocused = ref(false);
const localFlyerPreview = ref<string | null>(null);
const pendingFlyerFile = ref<File | null>(null);
let venueSearchTimer: ReturnType<typeof setTimeout> | null = null;

const sortedEvents = computed(() =>
  [...events.value].sort(
    (left, right) => new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime(),
  ),
);

const flyerPreviewUrl = computed(() => {
  if (localFlyerPreview.value) {
    return localFlyerPreview.value;
  }

  if (!editingEventId.value) {
    return null;
  }

  const event = events.value.find((item) => item.id === editingEventId.value);
  return resolveAssetUrl(event?.flyerUrl);
});

watch(venueSearchQuery, (query) => {
  if (venueSearchTimer) {
    clearTimeout(venueSearchTimer);
  }

  venueSearchTimer = setTimeout(() => {
    void searchPlaces(query);
  }, 350);
});

function resetForm() {
  form.value = emptyEventForm();
  editingEventId.value = null;
  venueSearchQuery.value = "";
  venueSearchFocused.value = false;
  formError.value = "";
  pendingFlyerFile.value = null;
  clearLocalFlyerPreview();
}

function clearLocalFlyerPreview() {
  if (localFlyerPreview.value) {
    URL.revokeObjectURL(localFlyerPreview.value);
    localFlyerPreview.value = null;
  }
}

function clearPendingFlyer() {
  pendingFlyerFile.value = null;
  clearLocalFlyerPreview();
}

function startCreate() {
  if (showForm.value && !editingEventId.value) {
    showForm.value = false;
    resetForm();
    return;
  }

  resetForm();
  showForm.value = true;
}

function startEdit(event: DjEvent) {
  editingEventId.value = event.id;
  pendingFlyerFile.value = null;
  clearLocalFlyerPreview();
  form.value = {
    name: event.name,
    description: event.description ?? "",
    startsAt: toDateTimeLocalValue(event.startsAt),
    endsAt: toDateTimeLocalValue(event.endsAt ?? ""),
    ticketUrl: event.ticketUrl ?? "",
    venue: {
      name: event.venue.name,
      address: event.venue.address,
      city: event.venue.city,
      state: event.venue.state ?? "",
      country: event.venue.country,
      latitude: event.venue.latitude ?? null,
      longitude: event.venue.longitude ?? null,
      placeId: event.venue.placeId ?? null,
      venueId: event.venue.id,
    },
  };
  venueSearchQuery.value = event.venue.name;
  showForm.value = true;
  formError.value = "";
}

function applyPlace(place: PlaceSearchResult) {
  form.value.venue = {
    name: place.name,
    address: place.address,
    city: place.city,
    state: place.state ?? "",
    country: place.country,
    latitude: place.latitude ?? null,
    longitude: place.longitude ?? null,
    placeId: place.source === "online" ? place.placeId : place.placeId.startsWith("db:") ? null : place.placeId,
    venueId: place.venueId ?? null,
  };
  venueSearchQuery.value = place.name;
  venueSearchFocused.value = false;
}

function clearSelectedVenueId() {
  form.value.venue.venueId = null;
}

function validateForm(): string | null {
  if (!form.value.name.trim()) {
    return "Show name is required.";
  }

  const startsAt = fromDateTimeLocalValue(form.value.startsAt);
  if (!startsAt) {
    return "Start date and time are required.";
  }

  if (form.value.endsAt) {
    const endsAt = fromDateTimeLocalValue(form.value.endsAt);
    if (!endsAt) {
      return "End date and time are invalid.";
    }
    if (new Date(endsAt).getTime() <= new Date(startsAt).getTime()) {
      return "End time must be after the start time.";
    }
  }

  if (!form.value.venue.name.trim() || !form.value.venue.address.trim() || !form.value.venue.city.trim()) {
    return "Venue name, address, and city are required.";
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

  const payload: EventFormInput = {
    ...form.value,
    startsAt: fromDateTimeLocalValue(form.value.startsAt) ?? "",
    endsAt: form.value.endsAt ? fromDateTimeLocalValue(form.value.endsAt) ?? "" : "",
  };

  try {
    const flyerFile = pendingFlyerFile.value;

    if (editingEventId.value) {
      await updateEvent(editingEventId.value, payload, flyerFile);
      if (flyerFile) {
        pendingFlyerFile.value = null;
        clearLocalFlyerPreview();
      }
    } else {
      const created = await createEvent(payload, flyerFile);
      editingEventId.value = created.id;
      pendingFlyerFile.value = null;
      clearLocalFlyerPreview();
    }
  } catch {
    formError.value = error.value || "Could not save show.";
  }
}

function handleFlyerChange(changeEvent: Event) {
  const input = changeEvent.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = "";

  if (!file) {
    return;
  }

  formError.value = "";
  pendingFlyerFile.value = file;
  clearLocalFlyerPreview();
  localFlyerPreview.value = URL.createObjectURL(file);
}

async function handleDelete(eventId: number) {
  if (!window.confirm("Remove this show from your calendar?")) {
    return;
  }

  try {
    await deleteEvent(eventId);
    if (editingEventId.value === eventId) {
      showForm.value = false;
      resetForm();
    }
  } catch {
    formError.value = error.value || "Could not delete show.";
  }
}

onBeforeUnmount(() => {
  if (venueSearchTimer) {
    clearTimeout(venueSearchTimer);
  }
  clearLocalFlyerPreview();
});
</script>

<style scoped>
.shows-form {
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

.form-grid-two,
.form-grid-three {
  display: grid;
  gap: 16px;
}

.form-grid-two {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.form-grid-three {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.place-search-status {
  font-size: 0.92rem;
}

.place-results {
  border: 1px solid var(--rqst-border);
  border-radius: var(--rqst-radius-sm);
  display: grid;
  gap: 0;
  list-style: none;
  margin: 0;
  overflow: hidden;
  padding: 0;
}

.place-result-button {
  background: rgba(255, 255, 255, 0.82);
  border: 0;
  border-bottom: 1px solid rgba(47, 36, 36, 0.06);
  display: grid;
  gap: 4px;
  padding: 12px 14px;
  text-align: left;
  width: 100%;
}

.place-result-button:last-child {
  border-bottom: 0;
}

.place-result-button:hover {
  background: rgba(171, 220, 207, 0.28);
}

.place-result-header {
  align-items: center;
  display: flex;
  gap: 8px;
  justify-content: space-between;
}

.place-result-name {
  font-weight: 800;
}

.place-result-source {
  border-radius: 999px;
  flex-shrink: 0;
  font-size: 0.68rem;
  font-weight: 800;
  letter-spacing: 0.04em;
  padding: 4px 8px;
  text-transform: uppercase;
}

.place-result-source-db {
  background: rgba(171, 220, 207, 0.45);
  color: #24564a;
}

.place-result-source-online {
  background: rgba(135, 168, 216, 0.28);
  color: var(--rqst-blue-dark);
}

.place-result-address {
  color: var(--rqst-ink-muted);
  font-size: 0.88rem;
}

.flyer-upload-row {
  align-items: flex-start;
  display: flex;
  gap: 16px;
}

.flyer-preview {
  border-radius: var(--rqst-radius-sm);
  flex-shrink: 0;
  height: 180px;
  overflow: hidden;
  width: 132px;
}

.flyer-preview img {
  height: 100%;
  object-fit: cover;
  width: 100%;
}

.flyer-upload-actions {
  display: grid;
  gap: 6px;
}

.flyer-upload-button {
  display: inline-flex;
  justify-content: center;
  position: relative;
}

.flyer-upload-input {
  cursor: pointer;
  inset: 0;
  opacity: 0;
  position: absolute;
}

.flyer-clear-button {
  justify-content: center;
  width: fit-content;
}

.shows-list {
  display: grid;
  gap: 16px;
}

.show-card-layout {
  display: grid;
  gap: 18px;
  grid-template-columns: auto minmax(0, 1fr);
}

.show-flyer {
  border-radius: var(--rqst-radius-sm);
  height: 180px;
  overflow: hidden;
  width: 132px;
}

.show-flyer img {
  height: 100%;
  object-fit: cover;
  width: 100%;
}

.show-card-header {
  align-items: flex-start;
  display: flex;
  gap: 16px;
  justify-content: space-between;
}

.show-date {
  color: var(--rqst-coral);
  font-size: 0.82rem;
  font-weight: 800;
  letter-spacing: 0.04em;
  margin-bottom: 6px;
  text-transform: uppercase;
}

.show-title {
  font-size: 1.5rem;
  margin: 0 0 6px;
}

.show-venue {
  font-size: 1.02rem;
  font-weight: 800;
}

.show-address,
.show-description {
  color: var(--rqst-ink-muted);
  margin-top: 8px;
}

.show-card-actions {
  display: flex;
  flex-shrink: 0;
  gap: 8px;
}

.show-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 14px;
}

.empty-state {
  display: grid;
  gap: 8px;
}

@media (max-width: 980px) {
  .form-grid-two,
  .form-grid-three,
  .show-card-layout {
    grid-template-columns: 1fr;
  }

  .show-card-header {
    flex-direction: column;
  }
}
</style>
