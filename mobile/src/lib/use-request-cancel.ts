import { apiRouteBuilders } from "@rqst/contracts";
import type { SongRequestSummary } from "@rqst/contracts";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { rqstApi } from "./rqst-api";
import { usePendingCancelStore } from "../store/pending-cancel";

type CancelMutationContext = {
  previousMeRequests?: SongRequestSummary[];
  previousSessionRequests: Array<[readonly unknown[], SongRequestSummary[] | undefined]>;
};

function removeRequestFromCaches(
  queryClient: ReturnType<typeof useQueryClient>,
  requestId: number,
  clearPendingCancel: (id: number) => void,
) {
  clearPendingCancel(requestId);

  queryClient.setQueryData<SongRequestSummary[]>(["meRequests"], (currentRequests = []) =>
    currentRequests.filter((request) => request.id !== requestId),
  );

  queryClient.setQueriesData<SongRequestSummary[]>(
    { queryKey: ["sessionRequests"] },
    (currentRequests = []) => currentRequests.filter((request) => request.id !== requestId),
  );
}

export function useRequestCancel() {
  const queryClient = useQueryClient();
  const clearPendingCancel = usePendingCancelStore((state) => state.clear);

  const cancelMutation = useMutation({
    mutationFn: async (requestId: number) => {
      await rqstApi(apiRouteBuilders.undoRequest(requestId).replace("/api/v1", ""), {
        method: "POST",
      });
    },
    onMutate: async (requestId): Promise<CancelMutationContext> => {
      await queryClient.cancelQueries({ queryKey: ["meRequests"] });
      await queryClient.cancelQueries({ queryKey: ["sessionRequests"] });

      const previousMeRequests = queryClient.getQueryData<SongRequestSummary[]>(["meRequests"]);
      const previousSessionRequests = queryClient.getQueriesData<SongRequestSummary[]>({
        queryKey: ["sessionRequests"],
      });

      removeRequestFromCaches(queryClient, requestId, clearPendingCancel);

      return { previousMeRequests, previousSessionRequests };
    },
    onError: (_error, _requestId, context) => {
      if (!context) {
        return;
      }

      if (context.previousMeRequests) {
        queryClient.setQueryData(["meRequests"], context.previousMeRequests);
      }

      for (const [queryKey, data] of context.previousSessionRequests) {
        queryClient.setQueryData(queryKey, data);
      }
    },
    retry: false,
  });

  return {
    cancelRequest: cancelMutation.mutateAsync,
    isCancelling: cancelMutation.isPending,
  };
}
