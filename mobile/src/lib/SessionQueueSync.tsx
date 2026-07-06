import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { SongRequestSummary } from "@rqst/contracts";

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

const RECONNECT_DELAY_MS = 3_000;
const INACTIVE_QUEUE_STATUSES = new Set(["cancelled", "rejected", "refunded"]);

function mergeMyRequest(existing: SongRequestSummary, updated: SongRequestSummary): SongRequestSummary {
  return {
    ...existing,
    status: updated.status,
    playedAt: updated.playedAt,
    confirmedByDjAt: updated.confirmedByDjAt,
    totalAmountCents: updated.totalAmountCents,
    totalPoolCents: updated.totalPoolCents,
    contributorCount: updated.contributorCount,
    songTitle: updated.songTitle ?? existing.songTitle,
    songArtist: updated.songArtist ?? existing.songArtist,
    songAlbumArtUrl: updated.songAlbumArtUrl ?? existing.songAlbumArtUrl,
  };
}

export function SessionQueueSync() {
  const queryClient = useQueryClient();
  const isSignedIn = useAuthStore((state) => state.status === "authenticated" && Boolean(state.accessToken));
  const showToast = useToastStore((state) => state.showToast);
  const { sessionId } = useActiveSession({ requireSelection: true });
  const seededPlayedIdsRef = useRef<Set<number>>(new Set());
  const hasSeededPlayedIdsRef = useRef(false);

  useEffect(() => {
    seededPlayedIdsRef.current.clear();
    hasSeededPlayedIdsRef.current = false;
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId) {
      return;
    }

    let socket: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;

    function applyQueueUpdate(rawRequests: unknown[]) {
      const requests = toCamelCase<SongRequestSummary[]>(rawRequests);
      queryClient.setQueryData(["sessionRequests", sessionId], requests);

      const myRequests = queryClient.getQueryData<SongRequestSummary[]>(["meRequests"]) ?? [];
      const myRequestsById = new Map(myRequests.map((request) => [request.id, request]));

      if (!hasSeededPlayedIdsRef.current) {
        for (const request of requests) {
          if (request.status === "played") {
            seededPlayedIdsRef.current.add(request.id);
          }
        }
        hasSeededPlayedIdsRef.current = true;
      } else {
        for (const request of requests) {
          if (request.status !== "played" || seededPlayedIdsRef.current.has(request.id)) {
            continue;
          }

          seededPlayedIdsRef.current.add(request.id);
          const myRequest = myRequestsById.get(request.id);
          if (isSignedIn && myRequest && myRequest.myContributionCents > 0) {
            showToast({
              title: "Your song was played",
              message: `${request.songTitle ?? "Your request"} · ${request.songArtist ?? "Unknown artist"}`,
            });
          }
        }
      }

      if (myRequests.length > 0) {
        queryClient.setQueryData<SongRequestSummary[]>(["meRequests"], (currentRequests = []) =>
          currentRequests
            .map((request) => {
              const updated = requests.find((item) => item.id === request.id);
              return updated ? mergeMyRequest(request, updated) : request;
            })
            .filter((request) => {
              const updated = requests.find((item) => item.id === request.id);
              if (updated) {
                return isActiveQueueStatus(updated.status);
              }

              if (request.sessionId === sessionId) {
                return false;
              }

              return isActiveQueueStatus(request.status);
            }),
        );
      }
    }

    function connect() {
      if (cancelled) {
        return;
      }

      socket = new WebSocket(`${wsBaseUrl}/ws/sessions/${sessionId}`);
      socket.onmessage = (event) => {
        try {
          const payload = JSON.parse(String(event.data)) as QueueUpdatedMessage;
          if (payload.type === "queue.updated" && payload.session_id === sessionId) {
            applyQueueUpdate(payload.requests);
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
  }, [isSignedIn, queryClient, sessionId, showToast]);

  return null;
}

export function isActiveQueueStatus(status: SongRequestSummary["status"]) {
  return status !== "played" && !INACTIVE_QUEUE_STATUSES.has(status);
}
