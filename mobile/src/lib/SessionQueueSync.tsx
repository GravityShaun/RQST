import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { apiRouteBuilders, type SongRequestSummary } from "@rqst/contracts";

import { wsBaseUrl } from "./api-config";
import { toCamelCase } from "./json";
import { useActiveSession } from "./use-active-session";
import { rqstApi } from "./rqst-api";
import { useAuthStore } from "../store/auth";
import { useToastStore } from "../store/toast";

type QueueUpdatedMessage = {
  type: "queue.updated";
  session_id: number;
  requests: unknown[];
};

type TipThankedMessage = {
  type: "tip.thanked";
  session_id: number;
  tip_id: number;
  user_id: number;
};

type SessionSocketMessage = QueueUpdatedMessage | TipThankedMessage;

const RECONNECT_DELAY_MS = 3_000;
const SELECTED_TOAST_DURATION_MS = 12_000;
const INACTIVE_QUEUE_STATUSES = new Set(["cancelled", "rejected", "refunded", "expired"]);
const SELECTED_NOTIFICATION_STATUSES = new Set<SongRequestSummary["status"]>(["confirmed_by_dj", "played"]);

function filterActiveQueueRequests(requests: SongRequestSummary[]): SongRequestSummary[] {
  return requests.filter((request) => isActiveQueueStatus(request.status));
}

async function syncExpiredRequestsFromApi(sessionId: number) {
  return rqstApi<SongRequestSummary[]>(
    apiRouteBuilders.sessionExpiredRequests(sessionId).replace("/api/v1", ""),
    { auth: false },
  );
}

function syncExpiredRequestsCache(
  queryClient: ReturnType<typeof useQueryClient>,
  sessionId: number,
  cancelled: () => boolean,
  onSynced?: () => void,
) {
  void syncExpiredRequestsFromApi(sessionId)
    .then((expiredRequests) => {
      if (cancelled()) {
        return;
      }

      queryClient.setQueryData(["sessionExpiredRequests", sessionId], expiredRequests);
      onSynced?.();
    })
    .catch(() => {
      // Keep queue sync alive even if expired requests fail to load.
    });
}

async function syncPlayedRequestsFromApi(sessionId: number) {
  return rqstApi<SongRequestSummary[]>(
    apiRouteBuilders.sessionPlayedRequests(sessionId).replace("/api/v1", ""),
    { auth: false },
  );
}

function syncPlayedRequestsCache(
  queryClient: ReturnType<typeof useQueryClient>,
  sessionId: number,
  cancelled: () => boolean,
  onSynced?: () => void,
) {
  void syncPlayedRequestsFromApi(sessionId)
    .then((playedRequests) => {
      if (cancelled()) {
        return;
      }

      queryClient.setQueryData(["sessionPlayedRequests", sessionId], playedRequests);
      onSynced?.();
    })
    .catch(() => {
      // Keep queue sync alive even if played requests fail to load.
    });
}

function mergeMyRequest(existing: SongRequestSummary, updated: SongRequestSummary): SongRequestSummary {
  return {
    ...existing,
    status: updated.status,
    playedAt: updated.playedAt,
    confirmedByDjAt: updated.confirmedByDjAt,
    expiredAt: updated.expiredAt ?? existing.expiredAt,
    playDeadlineExpiresAt: updated.playDeadlineExpiresAt ?? existing.playDeadlineExpiresAt,
    playDeadlineMinutes: updated.playDeadlineMinutes ?? existing.playDeadlineMinutes,
    playDeadlineAmountCents: updated.playDeadlineAmountCents ?? existing.playDeadlineAmountCents,
    playDeadlineRemainingSeconds:
      updated.playDeadlineRemainingSeconds ?? existing.playDeadlineRemainingSeconds,
    playDeadlineElapsedSeconds: updated.playDeadlineElapsedSeconds ?? existing.playDeadlineElapsedSeconds,
    totalAmountCents: updated.totalAmountCents,
    totalPoolCents: updated.totalPoolCents,
    contributorCount: updated.contributorCount,
    songTitle: updated.songTitle ?? existing.songTitle,
    songArtist: updated.songArtist ?? existing.songArtist,
    songAlbumArtUrl: updated.songAlbumArtUrl ?? existing.songAlbumArtUrl,
  };
}

function isActiveMyRequestStatus(status: SongRequestSummary["status"]) {
  return (
    status === "pending_payment" ||
    status === "open" ||
    status === "locked" ||
    status === "confirmed_by_dj"
  );
}

function reconcileMyRequestsAfterQueueUpdate(
  queryClient: ReturnType<typeof useQueryClient>,
  sessionId: number,
  activeRequests: SongRequestSummary[],
) {
  const expiredRequests =
    queryClient.getQueryData<SongRequestSummary[]>(["sessionExpiredRequests", sessionId]) ?? [];
  const playedRequests =
    queryClient.getQueryData<SongRequestSummary[]>(["sessionPlayedRequests", sessionId]) ?? [];
  const expiredById = new Map(expiredRequests.map((request) => [request.id, request]));
  const playedById = new Map(playedRequests.map((request) => [request.id, request]));
  const activeById = new Map(activeRequests.map((request) => [request.id, request]));

  queryClient.setQueryData<SongRequestSummary[]>(["meRequests"], (currentRequests = []) =>
    currentRequests.map((request) => {
      if (request.sessionId !== sessionId) {
        return request;
      }

      const active = activeById.get(request.id);
      if (active) {
        return mergeMyRequest(request, active);
      }

      const expired = expiredById.get(request.id);
      if (expired) {
        return mergeMyRequest(request, {
          ...expired,
          status: "expired",
          expiredAt: expired.expiredAt ?? new Date().toISOString(),
        });
      }

      const played = playedById.get(request.id);
      if (played) {
        return mergeMyRequest(request, {
          ...played,
          status: "played",
          playedAt: played.playedAt ?? new Date().toISOString(),
        });
      }

      if (isActiveMyRequestStatus(request.status)) {
        // Request left the live queue before played/expired caches refreshed.
        // Prefer expired when a deadline was set; otherwise mark played.
        if ((request.playDeadlineAmountCents ?? 0) > 0 || request.playDeadlineExpiresAt) {
          return {
            ...request,
            status: "expired" as const,
            expiredAt: request.expiredAt ?? new Date().toISOString(),
          };
        }

        return {
          ...request,
          status: "played" as const,
          playedAt: request.playedAt ?? new Date().toISOString(),
        };
      }

      return request;
    }),
  );
}

export function SessionQueueSync() {
  const queryClient = useQueryClient();
  const isSignedIn = useAuthStore((state) => state.status === "authenticated" && Boolean(state.accessToken));
  const currentUserId = useAuthStore((state) => state.user?.id ?? null);
  const showToast = useToastStore((state) => state.showToast);
  const { sessionId } = useActiveSession({ requireSelection: true });
  const seededNotifiedIdsRef = useRef<Set<number>>(new Set());
  const hasSeededNotifiedIdsRef = useRef(false);
  const thankedTipIdsRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    seededNotifiedIdsRef.current.clear();
    hasSeededNotifiedIdsRef.current = false;
    thankedTipIdsRef.current.clear();
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId) {
      return;
    }

    let socket: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;

    function applyQueueUpdate(rawRequests: unknown[]) {
      const requests = filterActiveQueueRequests(toCamelCase<SongRequestSummary[]>(rawRequests));
      queryClient.setQueryData(["sessionRequests", sessionId], requests);

      const reconcileMyRequests = () => {
        reconcileMyRequestsAfterQueueUpdate(queryClient, sessionId, requests);
        if (isSignedIn) {
          void queryClient.invalidateQueries({ queryKey: ["meRequests"] });
        }
      };

      syncPlayedRequestsCache(queryClient, sessionId, () => cancelled, reconcileMyRequests);
      syncExpiredRequestsCache(queryClient, sessionId, () => cancelled, reconcileMyRequests);

      const myRequests = queryClient.getQueryData<SongRequestSummary[]>(["meRequests"]) ?? [];
      const myRequestsById = new Map(myRequests.map((request) => [request.id, request]));

      if (!hasSeededNotifiedIdsRef.current) {
        for (const request of requests) {
          if (SELECTED_NOTIFICATION_STATUSES.has(request.status)) {
            seededNotifiedIdsRef.current.add(request.id);
          }
        }
        hasSeededNotifiedIdsRef.current = true;
      } else {
        for (const request of requests) {
          if (!SELECTED_NOTIFICATION_STATUSES.has(request.status) || seededNotifiedIdsRef.current.has(request.id)) {
            continue;
          }

          seededNotifiedIdsRef.current.add(request.id);
          const myRequest = myRequestsById.get(request.id);
          if (isSignedIn && myRequest && myRequest.myContributionCents > 0) {
            showToast({
              title: "Your song was selected and will play soon",
              message: `${request.songTitle ?? "Your request"} · ${request.songArtist ?? "Unknown artist"}`,
              durationMs: SELECTED_TOAST_DURATION_MS,
              showConfetti: true,
            });
          }
        }
      }

      // Optimistic local reconcile while played/expired caches refresh.
      reconcileMyRequestsAfterQueueUpdate(queryClient, sessionId, requests);
    }

    async function syncQueueFromApi() {
      try {
        const requests = filterActiveQueueRequests(
          await rqstApi<SongRequestSummary[]>(
            apiRouteBuilders.sessionRequests(sessionId).replace("/api/v1", ""),
            { auth: false },
          ),
        );
        if (cancelled) {
          return;
        }
        queryClient.setQueryData(["sessionRequests", sessionId], requests);
        syncPlayedRequestsCache(queryClient, sessionId, () => cancelled);
        syncExpiredRequestsCache(queryClient, sessionId, () => cancelled);
      } catch {
        // Keep the websocket subscription alive even if the initial fetch fails.
      }
    }

    void syncQueueFromApi();

    function connect() {
      if (cancelled) {
        return;
      }

      socket = new WebSocket(`${wsBaseUrl}/ws/sessions/${sessionId}`);
      socket.onmessage = (event) => {
        try {
          const payload = JSON.parse(String(event.data)) as SessionSocketMessage;
          if (payload.type === "queue.updated" && payload.session_id === sessionId) {
            applyQueueUpdate(payload.requests);
            return;
          }

          if (
            payload.type === "tip.thanked" &&
            payload.session_id === sessionId &&
            isSignedIn &&
            currentUserId != null &&
            payload.user_id === currentUserId &&
            !thankedTipIdsRef.current.has(payload.tip_id)
          ) {
            thankedTipIdsRef.current.add(payload.tip_id);
            void queryClient.invalidateQueries({ queryKey: ["meTips"] });
            showToast({
              title: "Thank you",
              message: "The DJ appreciated your tip.",
              durationMs: SELECTED_TOAST_DURATION_MS,
              showConfetti: true,
              confettiEmoji: "🙏🏼",
            });
          }
        } catch {
          // Ignore malformed websocket payloads.
        }
      };
      socket.onclose = () => {
        socket = null;
        if (cancelled) {
          return;
        }
        reconnectTimer = setTimeout(connect, RECONNECT_DELAY_MS);
      };
    }

    connect();

    return () => {
      cancelled = true;
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
      }
      socket?.close();
    };
  }, [currentUserId, isSignedIn, queryClient, sessionId, showToast]);

  return null;
}

export function isActiveQueueStatus(status: SongRequestSummary["status"]) {
  return status !== "played" && !INACTIVE_QUEUE_STATUSES.has(status);
}

export function isPlayedQueueStatus(status: SongRequestSummary["status"]) {
  return status === "played";
}

export function isExpiredQueueStatus(status: SongRequestSummary["status"]) {
  return status === "expired";
}
