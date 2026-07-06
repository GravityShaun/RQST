import {
  apiRouteBuilders,
  apiRoutes,
  type DjEvent,
  type PlaceSearchResult,
} from "@rqst/contracts";

import { useDjAuth } from "~/composables/useDjAuth";

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
  endsAt: string;
  ticketUrl: string;
  venue: VenueFormInput;
};

type ApiErrorBody = {
  detail?: string | { msg?: string }[];
};

function routePath(route: string) {
  return route.replace("/api/v1", "");
}

function toCamelCase(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(toCamelCase);
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase()),
      toCamelCase(item),
    ]),
  );
}

function parseApiError(status: number, body: ApiErrorBody): string {
  if (typeof body.detail === "string") {
    return body.detail;
  }

  if (Array.isArray(body.detail) && body.detail[0]?.msg) {
    return body.detail[0].msg;
  }

  return `Request failed with status ${status}.`;
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
    endsAt: "",
    ticketUrl: "",
    venue: emptyVenueForm(),
  };
}

export function useDjEvents() {
  const config = useRuntimeConfig();
  const { ensureAuth } = useDjAuth();

  const events = ref<DjEvent[]>([]);
  const pending = ref(true);
  const saving = ref(false);
  const uploadingFlyer = ref(false);
  const searchingPlaces = ref(false);
  const placeResults = ref<PlaceSearchResult[]>([]);
  const error = ref("");
  const saveMessage = ref("");

  async function authFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
    const accessToken = await ensureAuth();
    const headers = new Headers(init.headers);
    headers.set("Accept", "application/json");

    if (init.body && !(init.body instanceof FormData) && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }

    headers.set("Authorization", `Bearer ${accessToken}`);

    const response = await fetch(`${config.public.apiBaseUrl}${path}`, {
      ...init,
      headers,
    });

    if (!response.ok) {
      let message = `Request failed with status ${response.status}.`;

      try {
        const body = (await response.json()) as ApiErrorBody;
        message = parseApiError(response.status, body);
      } catch {
        message = parseApiError(response.status, {});
      }

      throw new Error(message);
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return toCamelCase(await response.json()) as T;
  }

  async function loadEvents() {
    events.value = await authFetch<DjEvent[]>(routePath(apiRoutes.djEvents));
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
      name: payload.name.trim(),
      description: payload.description.trim() || null,
      starts_at: payload.startsAt,
      ends_at: payload.endsAt || null,
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
    const accessToken = await ensureAuth();
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch(
      `${config.public.apiBaseUrl}${routePath(apiRouteBuilders.djEventFlyer(eventId))}`,
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: formData,
      },
    );

    if (!response.ok) {
      let message = `Request failed with status ${response.status}.`;

      try {
        const body = (await response.json()) as ApiErrorBody;
        message = parseApiError(response.status, body);
      } catch {
        message = parseApiError(response.status, {});
      }

      throw new Error(message);
    }

    const updated = toCamelCase(await response.json()) as DjEvent;
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
      await authFetch<void>(routePath(apiRouteBuilders.djEvent(eventId)), {
        method: "DELETE",
      });
      events.value = events.value.filter((event) => event.id !== eventId);
      saveMessage.value = "Show removed.";
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
    resolveAssetUrl: (assetUrl?: string | null) => resolveAssetUrl(config.public.apiBaseUrl, assetUrl),
  };
}
