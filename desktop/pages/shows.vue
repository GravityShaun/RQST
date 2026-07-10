<template>
  <div class="page-stack">
    <section class="card">
      <div class="section-heading">
        <div>
          <div class="eyebrow">Tour calendar</div>
          <h1 style="margin: 0 0 8px; font-size: 2.4rem">Shows & events</h1>
          <p class="muted" style="margin: 0">
            Manage upcoming and past gigs with venue details, dates, ticket links, and flyers. Fans will see these on your profile.
          </p>
        </div>
        <button class="btn btn-primary add-show-btn" type="button" @click="startCreate">
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
            <span class="form-label">Show name (optional)</span>
            <input v-model="form.name" class="form-input" maxlength="255" placeholder="Leave blank to use date only" type="text" />
          </label>

          <label class="form-field">
            <span class="form-label">Description</span>
            <textarea v-model="form.description" class="form-textarea" maxlength="1000" rows="3" />
          </label>

          <div class="form-grid-two">
            <label class="form-field">
              <span class="form-label">Start time</span>
              <div class="start-time-input-wrap">
                <input
                  v-model="form.startsAt"
                  class="form-input start-time-input"
                  required
                  type="datetime-local"
                />
                <button class="start-now-btn" type="button" @click="startNow">Start now</button>
              </div>
            </label>

            <label class="form-field">
              <span class="form-label">Duration</span>
              <select v-model.number="form.durationMinutes" class="form-input" required>
                <option v-for="option in showDurationOptions" :key="option.value" :value="option.value">
                  {{ option.label }}
                </option>
              </select>
              <p v-if="computedEndPreview" class="form-help">Ends {{ computedEndPreview }}</p>
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
          <button class="btn btn-secondary" type="button" @click="closeForm">Cancel</button>
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

    <div v-if="!pending" class="segment-tabs cols-3 shows-filter-tabs" role="group" aria-label="Show filters">
      <button
        v-for="tab in showFilterTabs"
        :key="tab.id"
        class="segment-tab"
        :class="{ 'is-selected': activeShowFilter === tab.id }"
        type="button"
        @click="activeShowFilter = tab.id"
      >
        {{ tab.label }}
      </button>
    </div>

    <section v-if="!pending" class="shows-list">
      <div v-if="filteredEvents.length === 0" class="card empty-state">
        <div class="section-title">{{ emptyStateTitle }}</div>
        <p class="muted" style="margin: 0">{{ emptyStateMessage }}</p>
      </div>

      <article
        v-for="event in filteredEvents"
        :key="event.id"
        class="show-card"
        :class="{
          'show-card--ended': getEventStatus(event) === 'ended',
          'show-card--live': getEventStatus(event) === 'live',
          'show-card--upcoming': getEventStatus(event) === 'upcoming',
        }"
      >
        <div class="show-card-media">
          <img
            v-if="resolveAssetUrl(event.flyerUrl)"
            class="show-flyer-image"
            :src="resolveAssetUrl(event.flyerUrl)!"
            :alt="`${event.name || 'Show'} flyer`"
          />
          <div v-else class="show-flyer-fallback" aria-hidden="true">
            <span class="show-flyer-month">{{ formatShowMonth(event.startsAt) }}</span>
            <span class="show-flyer-day">{{ formatShowDay(event.startsAt) }}</span>
          </div>
          <span class="show-status-pill" :class="statusPillClass(event)">{{ statusLabel(event) }}</span>
        </div>

        <div class="show-card-content">
          <div class="show-card-copy">
            <time class="show-date">{{ formatEventDateTime(event.startsAt) }}</time>
            <h2 class="show-title">{{ event.name || formatEventDateTime(event.startsAt) }}</h2>
            <div class="show-venue">{{ event.venue.name }}</div>
            <div class="show-address">
              {{ event.venue.city
              }}<template v-if="event.venue.state">, {{ event.venue.state }}</template>
            </div>
            <p v-if="event.description" class="show-description">{{ event.description }}</p>
          </div>

          <div class="show-card-footer">
            <div class="show-meta">
              <span v-if="getEventStatus(event) === 'ended'" class="show-meta-chip show-meta-chip--ended">
                Ended {{ formatEventDateTime(getEventEffectiveEnd(event)!.toISOString()) }}
              </span>
              <span v-else-if="getEventStatus(event) === 'live'" class="show-meta-chip show-meta-chip--live">
                Ends {{ formatEventDateTime(getEventEffectiveEnd(event)!.toISOString()) }}
              </span>
              <a
                v-if="event.ticketUrl"
                class="show-meta-chip show-meta-chip--ticket"
                :href="event.ticketUrl"
                rel="noopener noreferrer"
                target="_blank"
              >
                Tickets
              </a>
            </div>

            <div v-if="getEventStatus(event) !== 'ended'" class="show-action-bar">
              <button class="show-action show-action--edit" type="button" @click="startEdit(event)">
                Edit
              </button>
              <button
                class="show-action show-action--complimentary"
                :disabled="saving || isIssuingCode(event.id)"
                type="button"
                @click="handleIssueComplimentaryCode(event)"
              >
                {{ complimentaryActionLabel(event.id) }}
              </button>
              <button
                class="show-action show-action--delete"
                :disabled="saving"
                type="button"
                @click="handleDelete(event.id)"
              >
                Delete
              </button>
            </div>
            <div
              v-if="complimentaryByEventId[event.id]?.code"
              class="complimentary-codes-panel"
            >
              <div class="complimentary-codes-header">
                Free song code
                <span class="muted">
                  {{ complimentaryByEventId[event.id].usedCount }}/{{
                    complimentaryByEventId[event.id].maxUses
                  }}
                  used
                </span>
              </div>
              <div class="complimentary-code-row">
                <code class="complimentary-code-value">{{ complimentaryByEventId[event.id].code?.code }}</code>
                <span class="complimentary-code-status">
                  {{ complimentaryByEventId[event.id].remainingUses }} remaining
                </span>
                <button
                  class="show-action show-action--copy"
                  type="button"
                  @click="copyComplimentaryCode(complimentaryByEventId[event.id].code!.code)"
                >
                  Copy
                </button>
              </div>
              <label class="complimentary-multi-use">
                <input
                  type="checkbox"
                  :checked="Boolean(complimentaryByEventId[event.id].code?.allowMultipleUsesPerUser)"
                  :disabled="saving || isUpdatingCode(event.id)"
                  @change="handleToggleMultipleUses(event, ($event.target as HTMLInputElement).checked)"
                />
                <span>Allow the same person to use this code more than once</span>
              </label>
            </div>
          </div>
        </div>
      </article>
    </section>
  </div>
</template>

<script setup lang="ts">
import type { ComplimentaryCodeSummary, DjEvent, PlaceSearchResult } from "@rqst/contracts";

import {
  emptyEventForm,
  useDjEvents,
  type EventFormInput,
} from "~/composables/useDjEvents";
import {
  formatEventDateTime,
  fromDateTimeLocalValue,
  parseApiDateTime,
  toDateTimeLocalValue,
} from "~/utils/datetime";
import {
  computeShowEndIso,
  deriveShowDurationMinutes,
  getShowEffectiveEnd,
  getShowStatus,
  isShowPast,
  isShowUpcoming,
  SHOW_DURATION_OPTIONS,
  type ShowFilter,
  type ShowStatus,
} from "~/utils/shows";

const showFilterTabs: { id: ShowFilter; label: string }[] = [
  { id: "all", label: "All shows" },
  { id: "upcoming", label: "Upcoming" },
  { id: "past", label: "Past shows" },
];

const showDurationOptions = SHOW_DURATION_OPTIONS;

const activeShowFilter = ref<ShowFilter>("all");
const nowMs = ref(Date.now());
let showStatusTimer: ReturnType<typeof setInterval> | null = null;

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
  listComplimentaryCodes,
  issueComplimentaryCode,
  updateComplimentaryCode,
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
const complimentaryByEventId = ref<Record<number, ComplimentaryCodeSummary>>({});
const issuingCodeEventId = ref<number | null>(null);
const updatingCodeEventId = ref<number | null>(null);
let venueSearchTimer: ReturnType<typeof setTimeout> | null = null;

const sortedEvents = computed(() =>
  [...events.value].sort(
    (left, right) => new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime(),
  ),
);

const filteredEvents = computed(() => {
  const current = nowMs.value;
  const items = sortedEvents.value.filter((event) => {
    if (activeShowFilter.value === "upcoming") {
      return isShowUpcoming(event, current);
    }

    if (activeShowFilter.value === "past") {
      return isShowPast(event, current);
    }

    return true;
  });

  if (activeShowFilter.value === "past") {
    return [...items].sort(
      (left, right) => new Date(right.startsAt).getTime() - new Date(left.startsAt).getTime(),
    );
  }

  return items;
});

const emptyStateTitle = computed(() => {
  if (events.value.length === 0) {
    return "No shows yet";
  }

  if (activeShowFilter.value === "upcoming") {
    return "No upcoming shows";
  }

  if (activeShowFilter.value === "past") {
    return "No past shows";
  }

  return "No shows yet";
});

const emptyStateMessage = computed(() => {
  if (events.value.length === 0) {
    return "Add your first gig so fans know where to find you.";
  }

  if (activeShowFilter.value === "upcoming") {
    return "Add a new show to fill your calendar.";
  }

  if (activeShowFilter.value === "past") {
    return "Past shows appear here after they end.";
  }

  return "Add your first gig so fans know where to find you.";
});

function getEventStatus(event: DjEvent): ShowStatus {
  return getShowStatus(event, nowMs.value);
}

function getEventEffectiveEnd(event: DjEvent) {
  return getShowEffectiveEnd(event);
}

function statusLabel(event: DjEvent): string {
  const status = getEventStatus(event);
  if (status === "live") {
    return "Live now";
  }

  if (status === "ended") {
    return "Ended";
  }

  return "Upcoming";
}

function statusPillClass(event: DjEvent): string {
  const status = getEventStatus(event);
  if (status === "live") {
    return "show-status-pill--live";
  }

  if (status === "ended") {
    return "show-status-pill--ended";
  }

  return "show-status-pill--upcoming";
}

function formatShowMonth(value: string): string {
  const date = parseApiDateTime(value);
  if (!date) {
    return "---";
  }

  return new Intl.DateTimeFormat(undefined, { month: "short" }).format(date).toUpperCase();
}

function formatShowDay(value: string): string {
  const date = parseApiDateTime(value);
  if (!date) {
    return "--";
  }

  return String(date.getDate());
}

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

const computedEndPreview = computed(() => {
  const startsAt = fromDateTimeLocalValue(form.value.startsAt);
  if (!startsAt) {
    return "";
  }

  const endsAt = computeShowEndIso(startsAt, form.value.durationMinutes);
  return endsAt ? formatEventDateTime(endsAt) : "";
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

function closeForm() {
  showForm.value = false;
  resetForm();
}

function startCreate() {
  if (showForm.value) {
    closeForm();
    return;
  }

  resetForm();
  showForm.value = true;
}

function startNow() {
  form.value.startsAt = toDateTimeLocalValue(new Date());
}

function startEdit(event: DjEvent) {
  editingEventId.value = event.id;
  pendingFlyerFile.value = null;
  clearLocalFlyerPreview();
  form.value = {
    name: event.name ?? "",
    description: event.description ?? "",
    startsAt: toDateTimeLocalValue(event.startsAt),
    durationMinutes: deriveShowDurationMinutes(event),
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
  const startsAt = fromDateTimeLocalValue(form.value.startsAt);
  if (!startsAt) {
    return "Start date and time are required.";
  }

  if (!form.value.durationMinutes || form.value.durationMinutes <= 0) {
    return "Duration is required.";
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
    const nextCodes = { ...complimentaryByEventId.value };
    delete nextCodes[eventId];
    complimentaryByEventId.value = nextCodes;
    if (editingEventId.value === eventId) {
      showForm.value = false;
      resetForm();
    }
  } catch {
    formError.value = error.value || "Could not delete show.";
  }
}

function isIssuingCode(eventId: number) {
  return issuingCodeEventId.value === eventId;
}

function isUpdatingCode(eventId: number) {
  return updatingCodeEventId.value === eventId;
}

function complimentaryActionLabel(eventId: number) {
  if (isIssuingCode(eventId)) {
    return "Issuing...";
  }
  const summary = complimentaryByEventId.value[eventId];
  if (summary?.code) {
    return "Show free code";
  }
  return "Free song code";
}

async function refreshComplimentaryCodes(eventId: number) {
  try {
    complimentaryByEventId.value = {
      ...complimentaryByEventId.value,
      [eventId]: await listComplimentaryCodes(eventId),
    };
  } catch {
    // Keep the shows page usable if code history fails to load.
  }
}

async function handleIssueComplimentaryCode(event: DjEvent) {
  const existing = complimentaryByEventId.value[event.id];
  if (existing?.code) {
    await copyComplimentaryCode(existing.code.code);
    return;
  }

  issuingCodeEventId.value = event.id;
  formError.value = "";
  try {
    const issued = await issueComplimentaryCode(event.id);
    complimentaryByEventId.value = {
      ...complimentaryByEventId.value,
      [event.id]: {
        eventId: event.id,
        usedCount: issued.usedCount,
        maxUses: issued.maxUses,
        remainingUses: issued.remainingUses,
        code: issued,
      },
    };
    await copyComplimentaryCode(issued.code);
  } catch {
    formError.value = error.value || "Could not issue complimentary code.";
  } finally {
    issuingCodeEventId.value = null;
  }
}

async function handleToggleMultipleUses(event: DjEvent, allowMultipleUsesPerUser: boolean) {
  const summary = complimentaryByEventId.value[event.id];
  if (!summary?.code) {
    return;
  }

  const previous = Boolean(summary.code.allowMultipleUsesPerUser);
  complimentaryByEventId.value = {
    ...complimentaryByEventId.value,
    [event.id]: {
      ...summary,
      code: {
        ...summary.code,
        allowMultipleUsesPerUser,
      },
    },
  };

  updatingCodeEventId.value = event.id;
  formError.value = "";
  try {
    const updated = await updateComplimentaryCode(event.id, { allowMultipleUsesPerUser });
    complimentaryByEventId.value = {
      ...complimentaryByEventId.value,
      [event.id]: {
        eventId: event.id,
        usedCount: updated.usedCount,
        maxUses: updated.maxUses,
        remainingUses: updated.remainingUses,
        code: updated,
      },
    };
  } catch {
    complimentaryByEventId.value = {
      ...complimentaryByEventId.value,
      [event.id]: {
        ...summary,
        code: {
          ...summary.code,
          allowMultipleUsesPerUser: previous,
        },
      },
    };
    formError.value = error.value || "Could not update free code settings.";
  } finally {
    updatingCodeEventId.value = null;
  }
}

async function copyComplimentaryCode(code: string) {
  try {
    await navigator.clipboard.writeText(code);
  } catch {
    // Clipboard may be unavailable; the code remains visible on the card.
  }
}

watch(
  events,
  (nextEvents) => {
    for (const event of nextEvents) {
      if (!complimentaryByEventId.value[event.id]) {
        void refreshComplimentaryCodes(event.id);
      }
    }
  },
  { immediate: true },
);

onMounted(() => {
  showStatusTimer = setInterval(() => {
    nowMs.value = Date.now();
  }, 30_000);
});

onBeforeUnmount(() => {
  if (venueSearchTimer) {
    clearTimeout(venueSearchTimer);
  }
  if (showStatusTimer) {
    clearInterval(showStatusTimer);
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
  border-top: 1px solid var(--rqst-border);
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

.start-time-input-wrap {
  position: relative;
}

.start-time-input {
  padding-right: 96px;
}

.start-now-btn {
  background: var(--rqst-coral);
  border: 0;
  border-radius: 999px;
  color: #fff9f7;
  cursor: pointer;
  font: inherit;
  font-size: 0.68rem;
  font-weight: 800;
  letter-spacing: 0.02em;
  line-height: 1;
  padding: 6px 10px;
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  transition:
    background 0.18s ease,
    transform 0.18s ease;
  white-space: nowrap;
}

.start-now-btn:hover {
  background: color-mix(in srgb, var(--rqst-coral) 88%, #000 12%);
  transform: translateY(calc(-50% - 1px));
}

.place-search-status {
  font-size: 0.92rem;
}

.place-results {
  background: var(--rqst-surface-elevated);
  border: 1px solid var(--rqst-border);
  border-radius: var(--rqst-radius-sm);
  box-shadow: var(--rqst-shadow-soft);
  display: grid;
  gap: 0;
  list-style: none;
  margin: 0;
  overflow: hidden;
  padding: 0;
}

.place-result-button {
  background: var(--rqst-input-bg);
  border: 0;
  border-bottom: 1px solid var(--rqst-border);
  color: var(--rqst-ink);
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
  background: color-mix(in srgb, var(--rqst-mint) 18%, var(--rqst-input-bg));
}

.place-result-header {
  align-items: center;
  display: flex;
  gap: 8px;
  justify-content: space-between;
}

.place-result-name {
  color: var(--rqst-ink);
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
  background: color-mix(in srgb, var(--rqst-mint) 42%, transparent);
  color: #24564a;
}

.place-result-source-online {
  background: color-mix(in srgb, var(--rqst-blue) 28%, transparent);
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

.shows-filter-tabs {
  width: fit-content;
}

.add-show-btn {
  border-radius: 999px;
  flex-shrink: 0;
  font-size: 0.84rem;
  line-height: 1.1;
  min-height: 0;
  padding: 7px 18px;
}

.shows-list {
  display: grid;
  gap: 16px;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
}

.show-card {
  background: var(--rqst-surface-elevated);
  border: 1.5px solid var(--rqst-border);
  border-radius: 20px;
  box-shadow: var(--rqst-shadow-soft);
  display: flex;
  flex-direction: column;
  min-height: 100%;
  overflow: hidden;
  transition:
    border-color 0.18s ease,
    box-shadow 0.18s ease,
    transform 0.18s ease;
}

.show-card:hover {
  box-shadow: var(--rqst-shadow);
  transform: translateY(-2px);
}

.show-card--live {
  border-color: rgba(224, 90, 71, 0.34);
  box-shadow: 0 12px 28px rgba(224, 90, 71, 0.12);
}

.show-card--upcoming {
  border-color: rgba(169, 217, 207, 0.28);
}

.show-card--ended {
  background: color-mix(in srgb, var(--rqst-surface-elevated) 82%, var(--rqst-surface-muted));
  border-color: color-mix(in srgb, var(--rqst-border) 70%, var(--rqst-slate) 30%);
}

.show-card--ended:hover {
  transform: none;
}

.show-card-media {
  background:
    linear-gradient(135deg, rgba(76, 95, 125, 0.18), rgba(135, 168, 216, 0.22)),
    var(--rqst-surface-muted);
  flex-shrink: 0;
  height: 88px;
  overflow: hidden;
  position: relative;
}

.show-flyer-image {
  height: 100%;
  object-fit: cover;
  width: 100%;
}

.show-flyer-fallback {
  align-items: center;
  color: var(--rqst-ink);
  display: flex;
  flex-direction: row;
  gap: 8px;
  height: 100%;
  justify-content: center;
  line-height: 1;
}

.show-flyer-month {
  color: var(--rqst-coral);
  font-size: 0.68rem;
  font-weight: 800;
  letter-spacing: 0.08em;
}

.show-flyer-day {
  font-size: 1.5rem;
  font-weight: 800;
}

.show-status-pill {
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.28);
  border-radius: 999px;
  font-size: 0.68rem;
  font-weight: 800;
  left: 12px;
  letter-spacing: 0.05em;
  padding: 5px 10px;
  position: absolute;
  text-transform: uppercase;
  top: 12px;
}

.show-status-pill--upcoming {
  background: rgba(169, 217, 207, 0.88);
  border-color: rgba(34, 92, 77, 0.18);
  color: #1f5f50;
}

.show-status-pill--live {
  background: rgba(224, 90, 71, 0.92);
  border-color: rgba(255, 255, 255, 0.24);
  color: #fff9f7;
}

.show-status-pill--ended {
  background: rgba(76, 95, 125, 0.82);
  border-color: rgba(186, 210, 240, 0.28);
  color: #eef4fc;
}

.show-card-content {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 14px;
  padding: 16px;
}

.show-card-copy {
  display: grid;
  gap: 6px;
}

.show-date {
  color: var(--rqst-coral);
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.show-title {
  font-size: 1.12rem;
  line-height: 1.25;
  margin: 0;
}

.show-venue {
  font-size: 0.92rem;
  font-weight: 800;
}

.show-address {
  color: var(--rqst-ink-muted);
  font-size: 0.84rem;
}

.show-description {
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  color: var(--rqst-ink-muted);
  display: -webkit-box;
  font-size: 0.82rem;
  line-height: 1.4;
  margin: 2px 0 0;
  overflow: hidden;
}

.show-card-footer {
  display: grid;
  gap: 12px;
  margin-top: auto;
}

.show-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.show-meta-chip {
  align-items: center;
  border: 1px solid transparent;
  border-radius: 999px;
  display: inline-flex;
  font-size: 0.72rem;
  font-weight: 700;
  padding: 5px 10px;
}

.show-meta-chip--live {
  background: rgba(169, 217, 207, 0.18);
  border-color: rgba(169, 217, 207, 0.34);
  color: #225c4d;
}

.show-meta-chip--ended {
  background: rgba(76, 95, 125, 0.14);
  border-color: rgba(76, 95, 125, 0.28);
  color: #4c5f7d;
}

.show-meta-chip--ticket {
  background: rgba(224, 90, 71, 0.12);
  border-color: rgba(224, 90, 71, 0.28);
  color: #b73524;
  transition:
    background 0.18s ease,
    transform 0.18s ease;
}

.show-meta-chip--ticket:hover {
  background: rgba(224, 90, 71, 0.2);
  transform: translateY(-1px);
}

.show-action-bar {
  border-top: 1px solid var(--rqst-border);
  display: grid;
  gap: 8px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  padding-top: 12px;
}

.show-action {
  background: var(--rqst-btn-secondary-bg);
  border: 1px solid var(--rqst-border);
  border-radius: 12px;
  color: var(--rqst-ink);
  font-size: 0.78rem;
  font-weight: 700;
  padding: 9px 12px;
  transition:
    background 0.18s ease,
    border-color 0.18s ease,
    color 0.18s ease,
    transform 0.18s ease;
}

.show-action:hover:not(:disabled) {
  transform: translateY(-1px);
}

.show-action--edit:hover:not(:disabled) {
  background: color-mix(in srgb, var(--rqst-mint) 18%, var(--rqst-btn-secondary-bg));
  border-color: color-mix(in srgb, var(--rqst-mint) 40%, var(--rqst-border));
}

.show-action--complimentary:hover:not(:disabled) {
  background: color-mix(in srgb, #7c3aed 14%, var(--rqst-btn-secondary-bg));
  border-color: color-mix(in srgb, #7c3aed 36%, var(--rqst-border));
  color: #6d28d9;
}

.show-action--copy {
  font-size: 0.72rem;
  padding: 6px 10px;
}

.complimentary-codes-panel {
  border-top: 1px solid var(--rqst-border);
  display: grid;
  gap: 10px;
  margin-top: 12px;
  padding-top: 12px;
}

.complimentary-codes-header {
  align-items: baseline;
  display: flex;
  gap: 8px;
  font-size: 0.86rem;
  font-weight: 700;
}

.complimentary-code-list {
  display: grid;
  gap: 8px;
  list-style: none;
  margin: 0;
  padding: 0;
}

.complimentary-code-row {
  align-items: center;
  display: flex;
  gap: 10px;
}

.complimentary-code-value {
  background: color-mix(in srgb, #7c3aed 10%, var(--rqst-surface));
  border: 1px solid color-mix(in srgb, #7c3aed 24%, var(--rqst-border));
  border-radius: 8px;
  color: #6d28d9;
  font-size: 0.9rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  padding: 6px 10px;
}

.complimentary-code-status {
  color: var(--rqst-ink-muted);
  flex: 1;
  font-size: 0.78rem;
  font-weight: 600;
}

.complimentary-multi-use {
  align-items: flex-start;
  color: var(--rqst-ink-muted);
  cursor: pointer;
  display: flex;
  font-size: 0.78rem;
  font-weight: 600;
  gap: 8px;
  line-height: 1.35;
}

.complimentary-multi-use input {
  accent-color: #7c3aed;
  margin-top: 2px;
}

.show-action--delete {
  color: #b73524;
}

.show-action--delete:hover:not(:disabled) {
  background: rgba(224, 90, 71, 0.1);
  border-color: rgba(224, 90, 71, 0.28);
}

.show-action:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.empty-state {
  display: grid;
  gap: 8px;
  grid-column: 1 / -1;
}

:global([data-theme="dark"]) .show-card--ended {
  background: color-mix(in srgb, var(--rqst-surface-elevated) 72%, #243247);
  border-color: rgba(155, 184, 220, 0.22);
}

:global([data-theme="dark"]) .show-status-pill--ended {
  background: rgba(107, 159, 212, 0.78);
  border-color: rgba(186, 210, 240, 0.34);
  color: #f0f6fc;
}

:global([data-theme="dark"]) .show-meta-chip--ended {
  background: rgba(107, 159, 212, 0.16);
  border-color: rgba(155, 184, 220, 0.34);
  color: #c8daf0;
}

:global([data-theme="dark"]) .show-meta-chip--live {
  background: rgba(122, 184, 168, 0.16);
  border-color: rgba(122, 184, 168, 0.34);
  color: #9ed9c8;
}

:global([data-theme="dark"]) .show-status-pill--upcoming {
  background: rgba(122, 184, 168, 0.88);
  border-color: rgba(34, 92, 77, 0.24);
  color: #0f3f34;
}

:global([data-theme="dark"]) .show-action--delete {
  color: #ff8f82;
}

:global([data-theme="dark"]) .show-action--delete:hover:not(:disabled) {
  background: rgba(224, 90, 71, 0.18);
  border-color: rgba(255, 143, 130, 0.34);
}

:global([data-theme="dark"]) .show-meta-chip--ticket {
  background: rgba(224, 90, 71, 0.18);
  border-color: rgba(255, 143, 130, 0.28);
  color: #ff9f92;
}

:global([data-theme="dark"]) .show-card--ended .show-title,
:global([data-theme="dark"]) .show-card--ended .show-venue {
  color: #d8e6f4;
}

:global([data-theme="dark"]) .show-card--ended .show-date {
  color: #ff9f92;
}

:global([data-theme="dark"]) .show-card--ended .show-address,
:global([data-theme="dark"]) .show-card--ended .show-description {
  color: rgba(200, 218, 240, 0.72);
}

:global([data-theme="dark"]) .show-flyer-fallback {
  color: #d8e6f4;
}

:global([data-theme="dark"]) .place-result-source-db {
  background: rgba(122, 184, 168, 0.22);
  color: #9ed9c8;
}

:global([data-theme="dark"]) .place-result-source-online {
  background: rgba(107, 159, 212, 0.22);
  color: #c8daf0;
}

:global([data-theme="dark"]) .place-result-button:hover {
  background: color-mix(in srgb, var(--rqst-blue) 16%, var(--rqst-input-bg));
}

@media (max-width: 980px) {
  .form-grid-two,
  .form-grid-three {
    grid-template-columns: 1fr;
  }

  .shows-filter-tabs,
  .shows-list {
    width: 100%;
  }

  .shows-list {
    grid-template-columns: 1fr;
  }
}
</style>
