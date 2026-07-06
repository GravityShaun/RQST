import { useQuery } from "@tanstack/react-query";
import { apiRoutes } from "@rqst/contracts";

import { activeSession as mockActiveSession } from "../features/rqst/mock-data";
import { useAppStore } from "../store/app";
import { rqstApi } from "./rqst-api";

type NearbySession = {
  id: number;
  minimumRequestAmountCents: number;
  acceptingRequests: boolean;
  status: string;
};

type ActiveSessionOptions = {
  requireSelection?: boolean;
};

export function useActiveSession(options?: ActiveSessionOptions) {
  const requireSelection = options?.requireSelection ?? false;
  const selectedSession = useAppStore((state) => state.selectedSession);

  const nearbySessionsQuery = useQuery({
    queryKey: ["nearbySessions"],
    queryFn: () => rqstApi<NearbySession[]>(apiRoutes.sessionsNearby.replace("/api/v1", ""), { auth: false }),
    retry: false,
  });

  const matchedNearbySession = selectedSession?.sessionId
    ? nearbySessionsQuery.data?.find((session) => session.id === selectedSession.sessionId)
    : undefined;
  const fallbackNearbySession = nearbySessionsQuery.data?.[0];
  const nearbySession = matchedNearbySession ?? (requireSelection ? undefined : fallbackNearbySession);

  const sessionId = requireSelection
    ? (selectedSession?.sessionId ?? null)
    : (selectedSession?.sessionId ?? nearbySession?.id ?? mockActiveSession.id);
  const requestFloorCents =
    nearbySession?.minimumRequestAmountCents ??
    (requireSelection ? null : mockActiveSession.requestFloorCents);
  const djName = selectedSession?.djName ?? (requireSelection ? null : mockActiveSession.djName);
  const venueName = selectedSession?.venueName ?? (requireSelection ? null : mockActiveSession.venue);
  const djSlug = selectedSession?.slug ?? null;
  const hasSession = sessionId != null;

  return {
    sessionId,
    requestFloorCents,
    djName,
    venueName,
    djSlug,
    hasSession,
    nearbySession,
    isLoading: nearbySessionsQuery.isLoading,
  };
}
