import { apiRouteBuilders, apiRoutes, type DjEvent } from "@rqst/contracts";

import { authenticatedJsonFetch } from "~/lib/authenticated-fetch";
import {
  canExtendShow,
  canExtendShowByAnyOption,
  formatShowCountdown,
  getShowEffectiveEnd,
  getShowRemainingMs,
  getShowStatus,
  SHOW_EXTEND_OPTIONS,
} from "~/utils/shows";

const EVENTS_POLL_INTERVAL_MS = 15_000;

function routePath(route: string) {
  return route.replace("/api/v1", "");
}

export function useLiveShow() {
  const config = useRuntimeConfig();
  const { upsertEvent } = useDjEvents();

  const liveEvent = useState<DjEvent | null>("live-show-event", () => null);
  const nowMs = useState("live-show-now-ms", () => Date.now());
  const acting = useState("live-show-acting", () => false);
  const actionError = useState<string>("live-show-action-error", () => "");

  let countdownTimer: ReturnType<typeof setInterval> | null = null;
  let pollTimer: ReturnType<typeof setInterval> | null = null;

  const isLive = computed(() => liveEvent.value !== null);

  const remainingMs = computed(() =>
    liveEvent.value ? getShowRemainingMs(liveEvent.value, nowMs.value) : 0,
  );

  const countdownLabel = computed(() => formatShowCountdown(remainingMs.value));

  const canExtend = computed(() =>
    liveEvent.value ? canExtendShowByAnyOption(liveEvent.value, nowMs.value) : false,
  );

  function canExtendBy(minutes: number): boolean {
    return liveEvent.value ? canExtendShow(liveEvent.value, minutes, nowMs.value) : false;
  }

  function applyUpdatedEvent(updated: DjEvent) {
    upsertEvent(updated);
    liveEvent.value = getShowStatus(updated, Date.now()) === "live" ? updated : null;
    nowMs.value = Date.now();
  }

  async function loadLiveEvent() {
    if (acting.value) {
      return;
    }

    const events = await authenticatedJsonFetch<DjEvent[]>(
      config.public.apiBaseUrl,
      routePath(apiRoutes.djEvents),
    );

    const current = Date.now();
    liveEvent.value =
      events.find((event) => getShowStatus(event, current) === "live") ?? null;
  }

  async function refresh() {
    if (acting.value) {
      return;
    }

    actionError.value = "";

    try {
      await loadLiveEvent();
    } catch (error) {
      actionError.value = error instanceof Error ? error.message : "Could not refresh live show.";
    }
  }

  function clearActionError() {
    actionError.value = "";
  }

  async function endShow() {
    if (!liveEvent.value) {
      return;
    }

    acting.value = true;
    actionError.value = "";

    try {
      const updated = await authenticatedJsonFetch<DjEvent>(
        config.public.apiBaseUrl,
        routePath(apiRouteBuilders.djEventEnd(liveEvent.value.id)),
        {
          method: "POST",
        },
      );

      upsertEvent(updated);
      liveEvent.value = null;
      nowMs.value = Date.now();
    } catch (error) {
      actionError.value = error instanceof Error ? error.message : "Could not end show.";
      throw error;
    } finally {
      acting.value = false;
    }
  }

  async function extendShow(extendMinutes: number) {
    if (!liveEvent.value) {
      return;
    }

    if (!canExtendShow(liveEvent.value, extendMinutes, Date.now())) {
      actionError.value = "This show is already at the maximum duration.";
      return;
    }

    const previousEndMs = getShowEffectiveEnd(liveEvent.value)?.getTime() ?? 0;
    acting.value = true;
    actionError.value = "";

    try {
      const updated = await authenticatedJsonFetch<DjEvent>(
        config.public.apiBaseUrl,
        routePath(apiRouteBuilders.djEventExtend(liveEvent.value.id)),
        {
          method: "POST",
          body: JSON.stringify({ minutes: extendMinutes }),
        },
      );

      const updatedEndMs = getShowEffectiveEnd(updated)?.getTime() ?? 0;
      if (updatedEndMs <= previousEndMs) {
        throw new Error("Show end time did not increase. Please try again.");
      }

      applyUpdatedEvent(updated);
    } catch (error) {
      actionError.value = error instanceof Error ? error.message : "Could not extend show.";
      throw error;
    } finally {
      acting.value = false;
    }
  }

  function startTimers() {
    if (countdownTimer || pollTimer) {
      return;
    }

    void refresh();

    countdownTimer = setInterval(() => {
      nowMs.value = Date.now();

      if (liveEvent.value && getShowStatus(liveEvent.value, nowMs.value) !== "live") {
        liveEvent.value = null;
      }
    }, 1000);

    pollTimer = setInterval(() => {
      void refresh();
    }, EVENTS_POLL_INTERVAL_MS);
  }

  function stopTimers() {
    if (countdownTimer) {
      clearInterval(countdownTimer);
      countdownTimer = null;
    }

    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  }

  onMounted(startTimers);
  onBeforeUnmount(stopTimers);

  return {
    liveEvent,
    isLive,
    remainingMs,
    countdownLabel,
    canExtend,
    canExtendBy,
    extendOptions: SHOW_EXTEND_OPTIONS,
    acting,
    actionError,
    refresh,
    clearActionError,
    endShow,
    extendShow,
  };
}
