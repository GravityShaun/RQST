import {
  apiRouteBuilders,
  apiRoutes,
  type DjEvent,
  type PlaceSearchResult,
} from "@rqst/contracts";

import { useDjAuth } from "~/composables/useDjAuth";
import { authenticatedJsonFetch } from "~/lib/authenticated-fetch";
import { computeShowEndIso, DEFAULT_SHOW_DURATION_MINUTES } from "~/utils/shows";

export type VenueFormInput = {
  name: string;
  address: string;
  city: string;
  state: string;
  country: string;
  latitude?: number | null;
  longitude?: number | null;
  placeId?: string | null;
  venueId?: number | null;
};

export type EventFormInput = {
  name: string;
  description: string;
  startsAt: string;
  durationMinutes: number;
  ticketUrl: string;
  venue: VenueFormInput;
};

function routePath(route: string) {
  return route.replace("/api/v1", "");
}

export function resolveAssetUrl(apiBaseUrl: string, assetUrl?: string | null): string | null {
  if (!assetUrl) {
    return null;
  }

  if (assetUrl.startsWith("http://") || assetUrl.startsWith("https://")) {
    return assetUrl;
  }

  const assetBaseUrl = apiBaseUrl.replace(/\/api\/v1$/, "");
  return `${assetBaseUrl}${assetUrl.startsWith("/") ? assetUrl : `/${assetUrl}`}`;
}

export function emptyVenueForm(): VenueFormInput {
  return {
    name: "",
    address: "",
    city: "",
    state: "",
    country: "US",
    latitude: null,
    longitude: null,
    placeId: null,
    venueId: null,
  };
}

export function emptyEventForm(): EventFormInput {
  return {
    name: "",
    description: "",
    startsAt: "",
    durationMinutes: DEFAULT_SHOW_DURATION_MINUTES,
    ticketUrl: "",
    venue: emptyVenueForm(),
  };
}

export function useDjEvents() {
  const config = useRuntimeConfig();
  const { ensureAuth } = useDjAuth();

  const events = useState<DjEvent[]>("dj-events", () => []);
  const pending = ref(true);
  const saving = ref(false);
  const uploadingFlyer = ref(false);
  const searchingPlaces = ref(false);
  const placeResults = ref<PlaceSearchResult[]>([]);
  const error = ref("");
  const saveMessage = ref("");

  async function authFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
    return authenticatedJsonFetch<T>(config.public.apiBaseUrl, path, init);
  }

  async function loadEvents() {
    events.value = await authFetch<DjEvent[]>(routePath(apiRoutes.djEvents));
  }

  function upsertEvent(updated: DjEvent) {
    const nextEvents = events.value.some((event) => event.id === updated.id)
      ? events.value.map((event) => (event.id === updated.id ? updated : event))
      : [...events.value, updated];

    events.value = nextEvents.sort(
      (left, right) => new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime(),
    );
  }

  async function refresh() {
    pending.value = true;
    error.value = "";

    try {
      await loadEvents();
    } catch (loadError) {
      error.value = loadError instanceof Error ? loadError.message : "Could not load shows.";
    } finally {
      pending.value = false;
    }
  }

  async function searchPlaces(query: string) {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      placeResults.value = [];
      return [];
    }

    searchingPlaces.value = true;
    error.value = "";

    try {
      const params = new URLSearchParams({ q: trimmed });
      const results = await authFetch<PlaceSearchResult[]>(
        `${routePath(apiRoutes.venuePlacesSearch)}?${params.toString()}`,
      );
      placeResults.value = results;
      return results;
    } catch (searchError) {
      error.value = searchError instanceof Error ? searchError.message : "Venue search failed.";
      placeResults.value = [];
      return [];
    } finally {
      searchingPlaces.value = false;
    }
  }

  function buildVenuePayload(venue: VenueFormInput) {
    return {
      name: venue.name.trim(),
      address: venue.address.trim(),
      city: venue.city.trim(),
      state: venue.state.trim() || null,
      country: venue.country.trim() || "US",
      latitude: venue.latitude ?? null,
      longitude: venue.longitude ?? null,
      place_id: venue.placeId ?? null,
    };
  }

  function buildEventBody(payload: EventFormInput) {
    const body: Record<string, unknown> = {
      name: payload.name.trim() || null,
      description: payload.description.trim() || null,
      starts_at: payload.startsAt,
      ends_at: computeShowEndIso(payload.startsAt, payload.durationMinutes),
      ticket_url: payload.ticketUrl.trim() || null,
    };

    if (payload.venue.venueId) {
      body.venue_id = payload.venue.venueId;
    } else {
      body.venue = buildVenuePayload(payload.venue);
    }

    return body;
  }

  async function uploadFlyerFile(eventId: number, file: File): Promise<DjEvent> {
    await ensureAuth();
    const formData = new FormData();
    formData.append("file", file);

    const updated = await authenticatedJsonFetch<DjEvent>(
      config.public.apiBaseUrl,
      routePath(apiRouteBuilders.djEventFlyer(eventId)),
      {
        method: "POST",
        body: formData,
      },
    );

    events.value = events.value.map((event) => (event.id === updated.id ? updated : event));
    return updated;
  }

  async function createEvent(payload: EventFormInput, flyerFile?: File | null) {
    saving.value = true;
    error.value = "";
    saveMessage.value = "";

    try {
      const created = await authFetch<DjEvent>(routePath(apiRoutes.djEvents), {
        method: "POST",
        body: JSON.stringify(buildEventBody(payload)),
      });

      let result = created;
      if (flyerFile) {
        result = await uploadFlyerFile(created.id, flyerFile);
      }

      events.value = [...events.value, result].sort(
        (left, right) => new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime(),
      );
      saveMessage.value = flyerFile ? "Show created with flyer." : "Show saved.";
      void useLiveShow().refresh();
      return result;
    } catch (saveError) {
      error.value = saveError instanceof Error ? saveError.message : "Could not save show.";
      throw saveError;
    } finally {
      saving.value = false;
    }
  }

  async function updateEvent(eventId: number, payload: EventFormInput, flyerFile?: File | null) {
    saving.value = true;
    error.value = "";
    saveMessage.value = "";

    try {
      let result = await authFetch<DjEvent>(routePath(apiRouteBuilders.djEvent(eventId)), {
        method: "PATCH",
        body: JSON.stringify(buildEventBody(payload)),
      });

      if (flyerFile) {
        result = await uploadFlyerFile(eventId, flyerFile);
      }

      events.value = events.value
        .map((event) => (event.id === result.id ? result : event))
        .sort((left, right) => new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime());
      saveMessage.value = flyerFile ? "Show updated with flyer." : "Show updated.";
      void useLiveShow().refresh();
      return result;
    } catch (saveError) {
      error.value = saveError instanceof Error ? saveError.message : "Could not update show.";
      throw saveError;
    } finally {
      saving.value = false;
    }
  }

  async function deleteEvent(eventId: number) {
    saving.value = true;
    error.value = "";
    saveMessage.value = "";

    try {
      await authFetch<unknown>(routePath(apiRouteBuilders.djEvent(eventId)), {
        method: "DELETE",
      });
      events.value = events.value.filter((event) => event.id !== eventId);
      saveMessage.value = "Show removed.";
      void useLiveShow().refresh();
    } catch (deleteError) {
      error.value = deleteError instanceof Error ? deleteError.message : "Could not delete show.";
      throw deleteError;
    } finally {
      saving.value = false;
    }
  }

  async function uploadFlyer(eventId: number, file: File) {
    uploadingFlyer.value = true;
    error.value = "";

    try {
      const updated = await uploadFlyerFile(eventId, file);
      saveMessage.value = "Flyer uploaded.";
      return updated;
    } catch (uploadError) {
      error.value = uploadError instanceof Error ? uploadError.message : "Could not upload flyer.";
      throw uploadError;
    } finally {
      uploadingFlyer.value = false;
    }
  }

  onMounted(() => {
    void refresh();
  });

  return {
    events,
    pending,
    saving,
    uploadingFlyer,
    searchingPlaces,
    placeResults,
    error,
    saveMessage,
    refresh,
    searchPlaces,
    createEvent,
    updateEvent,
    deleteEvent,
    uploadFlyer,
    upsertEvent,
    resolveAssetUrl: (assetUrl?: string | null) => resolveAssetUrl(config.public.apiBaseUrl, assetUrl),
  };
}
