import { apiRouteBuilders, type DjEarningsDashboard } from "@rqst/contracts";

import { useDjAuth } from "~/composables/useDjAuth";

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

async function fetchJson<T>(url: string, accessToken: string): Promise<T> {
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Request failed with ${response.status}`);
  }

  return toCamelCase(await response.json()) as T;
}

async function postJson<T>(url: string, accessToken: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    let message = `Request failed with ${response.status}`;
    try {
      const payload = (await response.json()) as { detail?: string };
      if (payload.detail) {
        message = payload.detail;
      }
    } catch {
      // Ignore malformed error payloads.
    }
    throw new Error(message);
  }

  return toCamelCase(await response.json()) as T;
}

export function formatUsd(cents: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);
}

export function usePaymentsDashboard() {
  const config = useRuntimeConfig();
  const { ensureAuth } = useDjAuth();

  const dashboard = ref<DjEarningsDashboard | null>(null);
  const pending = ref(true);
  const error = ref("");
  const withdrawMessage = ref("");
  const withdrawing = ref(false);

  async function refresh() {
    pending.value = true;
    error.value = "";

    try {
      const accessToken = await ensureAuth();
      dashboard.value = await fetchJson<DjEarningsDashboard>(
        `${config.public.apiBaseUrl}${routePath(apiRouteBuilders.djEarnings)}`,
        accessToken,
      );
    } catch (loadError) {
      error.value = loadError instanceof Error ? loadError.message : "Could not load earnings.";
    } finally {
      pending.value = false;
    }
  }

  async function withdraw(amountCents: number) {
    withdrawing.value = true;
    withdrawMessage.value = "";

    try {
      const accessToken = await ensureAuth();
      const result = await postJson<{ message: string; polarConnected: boolean }>(
        `${config.public.apiBaseUrl}${routePath(apiRouteBuilders.djWithdraw)}`,
        accessToken,
        { amount_cents: amountCents },
      );
      withdrawMessage.value = result.message;
      await refresh();
    } catch (withdrawError) {
      withdrawMessage.value =
        withdrawError instanceof Error ? withdrawError.message : "Withdrawal could not be processed.";
    } finally {
      withdrawing.value = false;
    }
  }

  onMounted(() => {
    void refresh();
  });

  return {
    dashboard,
    pending,
    error,
    withdrawMessage,
    withdrawing,
    refresh,
    withdraw,
    formatUsd,
  };
}
