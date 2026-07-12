import { parseApiError } from "~/lib/auth-api";
import { useAuthStore } from "~/stores/auth";

type ApiErrorBody = {
  detail?: string | { msg?: string }[];
};

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

async function parseErrorResponse(response: Response): Promise<string> {
  let message: string;

  try {
    const body = (await response.json()) as ApiErrorBody;
    message = parseApiError(response.status, body);
  } catch {
    message = parseApiError(response.status, {});
  }

  return message;
}

export async function authenticatedFetch(
  apiBaseUrl: string,
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const authStore = useAuthStore();
  await authStore.bootstrap();

  if (!authStore.accessToken) {
    await navigateTo("/login");
    throw new Error("Not authenticated");
  }

  async function requestWithToken(accessToken: string) {
    const headers = new Headers(init.headers);
    headers.set("Accept", "application/json");
    headers.set("Authorization", `Bearer ${accessToken}`);

    if (init.body && !(init.body instanceof FormData) && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }

    return fetch(`${apiBaseUrl}${path}`, {
      ...init,
      headers,
    });
  }

  let response = await requestWithToken(authStore.accessToken);

  if (response.status === 401 && authStore.refreshToken) {
    const refreshed = await authStore.refreshSession();
    if (refreshed && authStore.accessToken) {
      response = await requestWithToken(authStore.accessToken);
    }
  }

  if (response.status === 401) {
    await authStore.signOut();
    await navigateTo("/login");
    throw new Error("Session expired. Please sign in again.");
  }

  return response;
}

export async function authenticatedJsonFetch<T>(
  apiBaseUrl: string,
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await authenticatedFetch(apiBaseUrl, path, init);

  if (!response.ok) {
    throw new Error(await parseErrorResponse(response));
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return toCamelCase(await response.json()) as T;
}
