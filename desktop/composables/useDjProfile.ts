import { apiRoutes, type DjProfile, type UserProfile } from "@rqst/contracts";

import { useDjAuth } from "~/composables/useDjAuth";

export type DjProfileInput = {
  artistName: string;
  slug: string;
  bio: string;
  city: string;
  genres: string[];
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

export function slugifyArtistName(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

export function parseGenresInput(value: string): string[] {
  return value
    .split(",")
    .map((genre) => genre.trim())
    .filter(Boolean);
}

export function formatGenresInput(genres: string[]): string {
  return genres.join(", ");
}

export function resolveAvatarUrl(apiBaseUrl: string, avatarUrl?: string | null): string | null {
  if (!avatarUrl) {
    return null;
  }

  if (avatarUrl.startsWith("http://") || avatarUrl.startsWith("https://")) {
    return avatarUrl;
  }

  const assetBaseUrl = apiBaseUrl.replace(/\/api\/v1$/, "");
  return `${assetBaseUrl}${avatarUrl.startsWith("/") ? avatarUrl : `/${avatarUrl}`}`;
}

export function getDisplayInitial(displayName: string): string {
  const trimmed = displayName.trim();
  return trimmed ? trimmed[0]?.toUpperCase() ?? "?" : "?";
}

export function useDjProfile() {
  const config = useRuntimeConfig();
  const { ensureAuth } = useDjAuth();

  const user = ref<UserProfile | null>(null);
  const djProfile = ref<DjProfile | null>(null);
  const pending = ref(true);
  const saving = ref(false);
  const uploadingAvatar = ref(false);
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
      let message: string;

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

  async function loadUser() {
    user.value = await authFetch<UserProfile>(routePath(apiRoutes.me));
  }

  async function loadDjProfile() {
    try {
      djProfile.value = await authFetch<DjProfile>(routePath(apiRoutes.djProfile));
    } catch (loadError) {
      if (loadError instanceof Error && loadError.message === "DJ profile not found") {
        djProfile.value = null;
        return;
      }

      throw loadError;
    }
  }

  async function refresh() {
    pending.value = true;
    error.value = "";

    try {
      await loadUser();
      await loadDjProfile();
    } catch (loadError) {
      error.value = loadError instanceof Error ? loadError.message : "Could not load profile.";
    } finally {
      pending.value = false;
    }
  }

  async function saveDisplayName(displayName: string) {
    user.value = await authFetch<UserProfile>(routePath(apiRoutes.me), {
      method: "PATCH",
      body: JSON.stringify({ display_name: displayName.trim() }),
    });
  }

  async function uploadAvatar(file: File) {
    uploadingAvatar.value = true;
    error.value = "";

    try {
      const accessToken = await ensureAuth();
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(`${config.public.apiBaseUrl}${routePath(apiRoutes.meAvatar)}`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: formData,
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

      user.value = toCamelCase(await response.json()) as UserProfile;
    } finally {
      uploadingAvatar.value = false;
    }
  }

  async function saveDjProfile(payload: DjProfileInput) {
    const body = {
      artist_name: payload.artistName.trim(),
      slug: payload.slug.trim(),
      bio: payload.bio.trim() || null,
      city: payload.city.trim() || null,
      genres: payload.genres,
    };

    if (djProfile.value) {
      djProfile.value = await authFetch<DjProfile>(routePath(apiRoutes.djProfile), {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      return;
    }

    djProfile.value = await authFetch<DjProfile>(routePath(apiRoutes.djProfile), {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  async function saveProfile(payload: {
    displayName: string;
    djProfile: DjProfileInput;
  }) {
    saving.value = true;
    error.value = "";
    saveMessage.value = "";
    const isCreate = !djProfile.value;

    try {
      await saveDisplayName(payload.displayName);
      await saveDjProfile(payload.djProfile);
      saveMessage.value = isCreate ? "Profile created." : "Profile saved.";
    } catch (saveError) {
      error.value = saveError instanceof Error ? saveError.message : "Could not save profile.";
      throw saveError;
    } finally {
      saving.value = false;
    }
  }

  onMounted(() => {
    void refresh();
  });

  return {
    user,
    djProfile,
    pending,
    saving,
    uploadingAvatar,
    error,
    saveMessage,
    refresh,
    saveProfile,
    uploadAvatar,
    resolveAvatarUrl: (avatarUrl?: string | null) => resolveAvatarUrl(config.public.apiBaseUrl, avatarUrl),
    getDisplayInitial,
  };
}
