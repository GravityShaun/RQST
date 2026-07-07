import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRoutes } from "@rqst/contracts";

import { activeSession as mockActiveSession } from "../features/rqst/mock-data";
import { useAppStore } from "../store/app";
import { rqstApi } from "./rqst-api";
import { formatShowLabel, hasShowStarted } from "../../utils/shows";

export const NEARBY_SESSIONS_QUERY_KEY = ["nearbySessions"] as const;

type NearbySession = {
  id: number;
  eventId?: number | null;
  minimumRequestAmountCents: number;
  acceptingRequests: boolean;
  status: string;
  eventName?: string | null;
  eventStartsAt?: string | null;
};

type ActiveSessionOptions = {
  requireSelection?: boolean;
};

function isJoinableNearbySession(session: NearbySession): boolean {
  return session.status === "live" && session.acceptingRequests;
}

export function useActiveSession(options?: ActiveSessionOptions) {
  const requireSelection = options?.requireSelection ?? false;
  const queryClient = useQueryClient();
  const selectedSession = useAppStore((state) => state.selectedSession);
  const setSelectedSession = useAppStore((state) => state.setSelectedSession);

  const nearbySessionsQuery = useQuery({
    queryKey: NEARBY_SESSIONS_QUERY_KEY,
    queryFn: () => rqstApi<NearbySession[]>(apiRoutes.sessionsNearby.replace("/api/v1", ""), { auth: false }),
    refetchInterval: 30_000,
    retry: false,
  });

  const matchedNearbySession = selectedSession?.sessionId
    ? nearbySessionsQuery.data?.find((session) => session.id === selectedSession.sessionId)
    : undefined;
  const fallbackNearbySession = nearbySessionsQuery.data?.[0];
  const nearbySession = matchedNearbySession ?? (requireSelection ? undefined : fallbackNearbySession);
  const isAwaitingNearbySync =
    Boolean(selectedSession?.sessionId) &&
    (nearbySessionsQuery.isLoading || nearbySessionsQuery.isFetching || nearbySessionsQuery.data == null);

  const sessionId = requireSelection
    ? (selectedSession?.sessionId ?? null)
    : (selectedSession?.sessionId ?? nearbySession?.id ?? mockActiveSession.id);
  const requestFloorCents =
    matchedNearbySession?.minimumRequestAmountCents ??
    nearbySession?.minimumRequestAmountCents ??
    (requireSelection ? null : mockActiveSession.requestFloorCents);
  const djName = selectedSession?.djName ?? (requireSelection ? null : mockActiveSession.djName);
  const venueName = selectedSession?.venueName ?? (requireSelection ? null : mockActiveSession.venue);
  const djSlug = selectedSession?.slug ?? null;
  const isSessionLive = matchedNearbySession
    ? Boolean(matchedNearbySession.acceptingRequests)
    : Boolean(selectedSession?.sessionId);
  const showHasStarted = matchedNearbySession
    ? hasShowStarted(matchedNearbySession.eventStartsAt)
    : selectedSession?.sessionId
      ? true
      : hasShowStarted(nearbySession?.eventStartsAt);
  const canViewSet = isSessionLive && showHasStarted;
  const hasSelectedSession = Boolean(selectedSession?.sessionId);
  const hasSession = requireSelection
    ? hasSelectedSession &&
      (isAwaitingNearbySync ||
        (matchedNearbySession != null && isJoinableNearbySession(matchedNearbySession)))
    : sessionId != null;
  const showLabel = formatShowLabel(
    matchedNearbySession?.eventName ?? nearbySession?.eventName,
    matchedNearbySession?.eventStartsAt ?? nearbySession?.eventStartsAt,
  );
  const activeEventId = matchedNearbySession?.eventId ?? nearbySession?.eventId ?? null;

  useEffect(() => {
    if (!selectedSession?.sessionId) {
      return;
    }

    void queryClient.invalidateQueries({ queryKey: NEARBY_SESSIONS_QUERY_KEY });
  }, [queryClient, selectedSession?.sessionId]);

  useEffect(() => {
    if (!requireSelection || !selectedSession?.sessionId) {
      return;
    }

    if (nearbySessionsQuery.isLoading || nearbySessionsQuery.isFetching) {
      return;
    }

    if (nearbySessionsQuery.data == null) {
      return;
    }

    const matched = nearbySessionsQuery.data.find((session) => session.id === selectedSession.sessionId);
    if (!matched || !isJoinableNearbySession(matched)) {
      const endedSessionId = selectedSession.sessionId;
      setSelectedSession(null);
      queryClient.removeQueries({ queryKey: ["sessionRequests", endedSessionId] });
    }
  }, [
    nearbySessionsQuery.data,
    nearbySessionsQuery.isFetching,
    nearbySessionsQuery.isLoading,
    queryClient,
    requireSelection,
    selectedSession?.sessionId,
    setSelectedSession,
  ]);

  return {
    sessionId: hasSession ? sessionId : null,
    requestFloorCents,
    djName,
    venueName,
    djSlug,
    hasSession,
    isSessionLive,
    canViewSet,
    showHasStarted,
    showLabel,
    activeEventId,
    nearbySession,
    isLoading: nearbySessionsQuery.isLoading,
  };
}
