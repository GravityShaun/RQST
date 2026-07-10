import { apiRouteBuilders, apiRoutes } from "@rqst/contracts";

import { useDjAuth } from "~/composables/useDjAuth";
import { useSessionStore } from "~/stores/session";

export type SessionRequest = {
  id: number;
  status: string;
  original_amount_cents: number;
  total_amount_cents: number;
  created_at: string;
  played_at?: string | null;
  song_title?: string | null;
  song_artist?: string | null;
  contributor_count?: number | null;
  contributors?: Array<{ user_id: number }> | null;
  note?: string | null;
  shoutout_amount_cents?: number;
  shoutout_fulfilled?: boolean | null;
  play_deadline_minutes?: number | null;
  play_deadline_amount_cents?: number;
  play_deadline_expires_at?: string | null;
  play_deadline_remaining_seconds?: number | null;
  play_deadline_elapsed_seconds?: number | null;
  expired_at?: string | null;
  is_complimentary?: boolean;
};

type QueueUpdatedMessage = {
  type: "queue.updated";
  session_id: number;
  requests: SessionRequest[];
};

type TipsUpdatedMessage = {
  type: "tips.updated";
  session_id: number;
  tips: SessionTip[];
};

type SessionSocketMessage = QueueUpdatedMessage | TipsUpdatedMessage;

export type SessionTip = {
  id: number;
  session_id: number;
  dj_profile_id: number;
  user_id: number;
  sender_display_name: string;
  sender_avatar_url?: string | null;
  amount_cents: number;
  currency: string;
  status: string;
  payment_id?: number | null;
  thanked_at?: string | null;
  created_at: string;
  updated_at: string;
};

type DjSession = {
  id: number;
  status: string;
  accepting_requests: boolean;
};

const INACTIVE_QUEUE_STATUSES = new Set(["cancelled", "rejected", "refunded", "expired"]);

function isActiveQueueStatus(rawStatus: string) {
  const normalizedStatus = rawStatus.toLowerCase();
  return normalizedStatus !== "played" && !INACTIVE_QUEUE_STATUSES.has(normalizedStatus);
}

export { isActiveQueueStatus };

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

async function postJson<T>(url: string, accessToken: string, body?: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
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
  const playedRequests = ref<SessionRequest[]>([]);
  const expiredRequests = ref<SessionRequest[]>([]);
  const tips = ref<SessionTip[]>([]);
  const thankedTips = ref<SessionTip[]>([]);
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
    const accessToken = await ensureAuth();
    const data = await fetchJson<SessionRequest[]>(
      `${config.public.apiBaseUrl}${apiRouteBuilders.currentDjRequests.replace("/api/v1", "")}`,
      accessToken,
    );
    requests.value = data.filter((request) => isActiveQueueStatus(request.status));
    error.value = false;
  }

  async function fetchPlayedRequests() {
    const accessToken = await ensureAuth();
    playedRequests.value = await fetchJson<SessionRequest[]>(
      `${config.public.apiBaseUrl}${apiRouteBuilders.currentDjPlayedRequests.replace("/api/v1", "")}`,
      accessToken,
    );
  }

  async function fetchExpiredRequests() {
    const accessToken = await ensureAuth();
    expiredRequests.value = await fetchJson<SessionRequest[]>(
      `${config.public.apiBaseUrl}${apiRouteBuilders.currentDjExpiredRequests.replace("/api/v1", "")}`,
      accessToken,
    );
  }

  async function fetchTips() {
    const accessToken = await ensureAuth();
    tips.value = await fetchJson<SessionTip[]>(
      `${config.public.apiBaseUrl}${apiRouteBuilders.currentDjTips.replace("/api/v1", "")}`,
      accessToken,
    );
  }

  async function fetchThankedTips() {
    const accessToken = await ensureAuth();
    thankedTips.value = await fetchJson<SessionTip[]>(
      `${config.public.apiBaseUrl}${apiRouteBuilders.currentDjThankedTips.replace("/api/v1", "")}`,
      accessToken,
    );
  }

  function applyQueueUpdate(_payload: QueueUpdatedMessage) {
    if (sessionId.value === null) {
      return;
    }
    void fetchRequests(sessionId.value);
    void fetchExpiredRequests();
  }

  function applyTipsUpdate(payload: TipsUpdatedMessage) {
    if (sessionId.value === null || payload.session_id !== sessionId.value) {
      return;
    }
    tips.value = payload.tips;
    void fetchThankedTips();
  }

  function connectWebSocket(activeSessionId: number) {
    if (socket) {
      socket.close();
      socket = null;
    }

    socket = new WebSocket(`${config.public.wsBaseUrl}/ws/sessions/${activeSessionId}`);
    socket.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data) as SessionSocketMessage;
        if (payload.type === "queue.updated") {
          applyQueueUpdate(payload);
        } else if (payload.type === "tips.updated") {
          applyTipsUpdate(payload);
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
      if (previousSessionId !== activeSessionId) {
        requests.value = [];
        playedRequests.value = [];
        expiredRequests.value = [];
        tips.value = [];
        thankedTips.value = [];
      }
      sessionId.value = activeSessionId;
      await Promise.all([
        fetchRequests(activeSessionId),
        fetchPlayedRequests(),
        fetchExpiredRequests(),
        fetchTips(),
        fetchThankedTips(),
      ]);
      if (previousSessionId !== activeSessionId || !socket || socket.readyState === WebSocket.CLOSED) {
        connectWebSocket(activeSessionId);
      }
    } catch {
      error.value = true;
    }
  }

  async function markRequestPlayed(requestId: number, status: string, includeShoutout = false) {
    const playedRequest = requests.value.find((request) => request.id === requestId);

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
        { include_shoutout: includeShoutout },
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

    if (playedRequest) {
      playedRequests.value = [
        {
          ...playedRequest,
          status: "played",
          played_at: new Date().toISOString(),
        },
        ...playedRequests.value.filter((request) => request.id !== requestId),
      ];
    }

    await refreshQueue();
  }

  async function thankTip(tipId: number) {
    async function performThank(accessToken: string) {
      await postJson(
        `${config.public.apiBaseUrl}${apiRouteBuilders.thankTip(tipId).replace("/api/v1", "")}`,
        accessToken,
      );
    }

    try {
      await performThank(await ensureAuth());
    } catch (error) {
      if (!(error instanceof Error) || !error.message.includes("401")) {
        throw error;
      }

      await clearAuth();
      await performThank(await ensureAuth());
    }

    tips.value = tips.value.filter((tip) => tip.id !== tipId);
    await Promise.all([fetchTips(), fetchThankedTips()]);
  }

  async function resetQueue() {
    const accessToken = await ensureAuth();
    await postJson(
      `${config.public.apiBaseUrl}${apiRoutes.resetCurrentDjQueue.replace("/api/v1", "")}`,
      accessToken,
    );
    playedRequests.value = [];
    expiredRequests.value = [];
    tips.value = [];
    thankedTips.value = [];
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
    playedRequests,
    expiredRequests,
    tips,
    thankedTips,
    pending,
    error,
    sessionId,
    refreshQueue,
    markRequestPlayed,
    thankTip,
    resetQueue,
  };
}
