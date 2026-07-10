import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRoutes } from "@rqst/contracts";

import { useAppStore } from "../store/app";
import { rqstApi } from "./rqst-api";
import { NEARBY_SESSIONS_QUERY_KEY } from "./use-active-session";

type NearbySession = {
  id: number;
  acceptingRequests: boolean;
  status: string;
};

function isJoinableNearbySession(session: NearbySession): boolean {
  return session.status === "live" && session.acceptingRequests;
}

/** Runs session sync side effects once for the whole app. */
export function ActiveSessionLifecycle() {
  const queryClient = useQueryClient();
  const selectedSession = useAppStore((state) => state.selectedSession);
  const setSelectedSession = useAppStore((state) => state.setSelectedSession);

  const nearbySessionsQuery = useQuery({
    queryKey: NEARBY_SESSIONS_QUERY_KEY,
    queryFn: () => rqstApi<NearbySession[]>(apiRoutes.sessionsNearby.replace("/api/v1", ""), { auth: false }),
    refetchInterval: 30_000,
    retry: false,
  });

  useEffect(() => {
    if (!selectedSession?.sessionId) {
      return;
    }

    void queryClient.invalidateQueries({ queryKey: NEARBY_SESSIONS_QUERY_KEY });
  }, [queryClient, selectedSession?.sessionId]);

  useEffect(() => {
    if (!selectedSession?.sessionId) {
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
      queryClient.removeQueries({ queryKey: ["sessionPlayedRequests", endedSessionId] });
      queryClient.removeQueries({ queryKey: ["sessionExpiredRequests", endedSessionId] });
    }
  }, [
    nearbySessionsQuery.data,
    nearbySessionsQuery.isFetching,
    nearbySessionsQuery.isLoading,
    queryClient,
    selectedSession?.sessionId,
    setSelectedSession,
  ]);

  return null;
}
