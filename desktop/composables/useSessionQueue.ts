import { apiRouteBuilders, apiRoutes } from "@rqst/contracts";

import { useDjAuth } from "~/composables/useDjAuth";
import { useSessionStore } from "~/stores/session";

export type SessionRequest = {
  id: number;
  status: string;
  original_amount_cents: number;
  total_amount_cents: number;
  created_at: string;
  song_title?: string | null;
  song_artist?: string | null;
  contributor_count?: number | null;
  contributors?: Array<{ user_id: number }> | null;
};

type QueueUpdatedMessage = {
  type: "queue.updated";
  session_id: number;
  requests: SessionRequest[];
};

type DjSession = {
  id: number;
  status: string;
  accepting_requests: boolean;
};

const POLL_INTERVAL_MS = 30_000;
const RECONNECT_DELAY_MS = 3_000;

async function fetchJson<T>(url: string, accessToken?: string | null): Promise<T> {
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
  });

  if (!response.ok) {
    throw new Error(`Request failed with ${response.status}`);
  }

  return (await response.json()) as T;
}

async function postJson<T>(url: string, accessToken: string): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Request failed with ${response.status}`);
  }

  return (await response.json()) as T;
}

export function useSessionQueue() {
  const config = useRuntimeConfig();
  const sessionStore = useSessionStore();
  const { ensureAuth, clearAuth } = useDjAuth();

  const requests = ref<SessionRequest[]>([]);
  const pending = ref(true);
  const error = ref(false);
  const sessionId = ref<number | null>(null);

  let socket: WebSocket | null = null;
  let pollTimer: ReturnType<typeof setInterval> | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  async function resolveSessionId(): Promise<number> {
    const accessToken = await ensureAuth();
    const currentSession = await fetchJson<DjSession | null>(
      `${config.public.apiBaseUrl}${apiRoutes.currentDjSession.replace("/api/v1", "")}`,
      accessToken,
    );

    if (currentSession?.id) {
      sessionStore.setCurrentSessionId(currentSession.id);
      return currentSession.id;
    }

    if (sessionStore.currentSessionId) {
      return sessionStore.currentSessionId;
    }

    throw new Error("No DJ session found");
  }

  async function fetchRequests(activeSessionId: number) {
    const data = await fetchJson<SessionRequest[]>(
      `${config.public.apiBaseUrl}/sessions/${activeSessionId}/requests`,
    );
    requests.value = data;
    error.value = false;
  }

  function applyQueueUpdate(payload: QueueUpdatedMessage) {
    if (payload.session_id !== sessionId.value) {
      return;
    }
    requests.value = payload.requests;
    error.value = false;
  }

  function connectWebSocket(activeSessionId: number) {
    if (socket) {
      socket.close();
      socket = null;
    }

    socket = new WebSocket(`${config.public.wsBaseUrl}/ws/sessions/${activeSessionId}`);
    socket.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data) as QueueUpdatedMessage;
        if (payload.type === "queue.updated") {
          applyQueueUpdate(payload);
        }
      } catch {
        // Ignore malformed websocket payloads.
      }
    };
    socket.onclose = () => {
      socket = null;
      if (sessionId.value !== activeSessionId) {
        return;
      }
      reconnectTimer = setTimeout(() => connectWebSocket(activeSessionId), RECONNECT_DELAY_MS);
    };
  }

  async function refreshQueue() {
    try {
      const activeSessionId = await resolveSessionId();
      const previousSessionId = sessionId.value;
      sessionId.value = activeSessionId;
      await fetchRequests(activeSessionId);
      if (previousSessionId !== activeSessionId || !socket || socket.readyState === WebSocket.CLOSED) {
        connectWebSocket(activeSessionId);
      }
    } catch {
      error.value = true;
    }
  }

  async function markRequestPlayed(requestId: number, status: string) {
    async function performMark(accessToken: string) {
      const normalizedStatus = status.toLowerCase();

      if (normalizedStatus === "open" || normalizedStatus === "locked") {
        await postJson(
          `${config.public.apiBaseUrl}${apiRouteBuilders.confirmRequest(requestId).replace("/api/v1", "")}`,
          accessToken,
        );
      }

      await postJson(
        `${config.public.apiBaseUrl}${apiRouteBuilders.markRequestPlayed(requestId).replace("/api/v1", "")}`,
        accessToken,
      );
    }

    try {
      await performMark(await ensureAuth());
    } catch (error) {
      if (!(error instanceof Error) || !error.message.includes("401")) {
        throw error;
      }

      await clearAuth();
      await performMark(await ensureAuth());
    }

    await refreshQueue();
  }

  onMounted(async () => {
    await refreshQueue();
    pollTimer = setInterval(() => {
      void refreshQueue();
    }, POLL_INTERVAL_MS);
    pending.value = false;
  });

  onBeforeUnmount(() => {
    if (pollTimer) {
      clearInterval(pollTimer);
    }
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
    }
    if (socket) {
      socket.close();
    }
  });

  return {
    requests,
    pending,
    error,
    sessionId,
    refreshQueue,
    markRequestPlayed,
  };
}
