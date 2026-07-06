import type { SongRequestSummary } from "@rqst/contracts";

export const REQUEST_CANCEL_WINDOW_MS = 30_000;

const CANCELABLE_STATUSES = new Set<SongRequestSummary["status"]>(["pending_payment", "open"]);

export function getCancelRemainingMs(expiresAt: number, now = Date.now()) {
  return Math.max(0, expiresAt - now);
}

export function formatCancelCountdown(remainingMs: number) {
  const clampedMs = Math.min(Math.max(remainingMs, 0), REQUEST_CANCEL_WINDOW_MS);
  const totalSeconds = Math.ceil(clampedMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function getPendingCancelExpiresAt(
  requestId: number,
  pendingExpiresById: Record<number, number>,
) {
  const expiresAt = pendingExpiresById[requestId];
  if (expiresAt == null || !Number.isFinite(expiresAt)) {
    return null;
  }

  return expiresAt;
}

export function canCancelRequest(
  request: Pick<SongRequestSummary, "id" | "status" | "confirmedByDjAt" | "requestedByUserId">,
  currentUserId: number | null | undefined,
  pendingExpiresById: Record<number, number>,
  now = Date.now(),
) {
  if (currentUserId == null || Number(request.requestedByUserId) !== Number(currentUserId)) {
    return false;
  }

  if (!CANCELABLE_STATUSES.has(request.status)) {
    return false;
  }

  if (request.confirmedByDjAt) {
    return false;
  }

  const expiresAt = getPendingCancelExpiresAt(request.id, pendingExpiresById);
  if (expiresAt == null) {
    return false;
  }

  const remainingMs = getCancelRemainingMs(expiresAt, now);
  if (remainingMs <= 0 || remainingMs > REQUEST_CANCEL_WINDOW_MS) {
    return false;
  }

  return true;
}
