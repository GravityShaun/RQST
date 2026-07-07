import type { DjEvent } from "@rqst/contracts";

import { parseApiDateTime } from "~/utils/datetime";

export const SHOW_MAX_DURATION_HOURS = 8;
export const SHOW_MAX_DURATION_MS = SHOW_MAX_DURATION_HOURS * 60 * 60 * 1000;
export const DEFAULT_SHOW_DURATION_MINUTES = 120;

export const SHOW_DURATION_OPTIONS = [
  { value: 60, label: "1 hour" },
  { value: 120, label: "2 hours" },
  { value: 180, label: "3 hours" },
  { value: 240, label: "4 hours" },
  { value: 300, label: "5 hours" },
  { value: 360, label: "6 hours" },
  { value: 480, label: "8 hours" },
] as const;

export const SHOW_EXTEND_OPTIONS = [
  { value: 15, label: "15 min" },
  { value: 30, label: "30 min" },
  { value: 60, label: "1 hour" },
] as const;

export type ShowDurationOption = (typeof SHOW_DURATION_OPTIONS)[number];

export type ShowStatus = "upcoming" | "live" | "ended";

export type ShowFilter = "all" | "upcoming" | "past";

export function computeShowEndIso(startsAtIso: string, durationMinutes: number): string | null {
  const startsAt = parseApiDateTime(startsAtIso);
  if (!startsAt) {
    return null;
  }

  const durationMs = Math.min(durationMinutes * 60 * 1000, SHOW_MAX_DURATION_MS);
  return new Date(startsAt.getTime() + durationMs).toISOString();
}

export function deriveShowDurationMinutes(event: DjEvent): number {
  const startsAt = parseApiDateTime(event.startsAt);
  if (!startsAt) {
    return DEFAULT_SHOW_DURATION_MINUTES;
  }

  if (event.endsAt) {
    const endsAt = parseApiDateTime(event.endsAt);
    if (endsAt) {
      const diffMinutes = Math.round((endsAt.getTime() - startsAt.getTime()) / (60 * 1000));
      if (diffMinutes > 0) {
        return snapToShowDurationMinutes(diffMinutes);
      }
    }
  }

  return DEFAULT_SHOW_DURATION_MINUTES;
}

export function snapToShowDurationMinutes(minutes: number): number {
  const maxMinutes = SHOW_MAX_DURATION_HOURS * 60;
  const clamped = Math.min(Math.max(minutes, SHOW_DURATION_OPTIONS[0].value), maxMinutes);
  return SHOW_DURATION_OPTIONS.reduce((closest, option) =>
    Math.abs(option.value - clamped) < Math.abs(closest - clamped) ? option.value : closest,
  );
}

export function getShowEffectiveEnd(event: DjEvent): Date | null {
  const startsAt = parseApiDateTime(event.startsAt);
  if (!startsAt) {
    return null;
  }

  if (event.endsAt) {
    const endsAt = parseApiDateTime(event.endsAt);
    if (endsAt) {
      return endsAt;
    }
  }

  return new Date(startsAt.getTime() + SHOW_MAX_DURATION_MS);
}

function getExtendBaseEndMs(event: DjEvent, nowMs = Date.now()): number | null {
  const startsAt = parseApiDateTime(event.startsAt);
  if (!startsAt) {
    return null;
  }

  const maxEndMs = startsAt.getTime() + SHOW_MAX_DURATION_MS;

  if (event.endsAt) {
    const endsAt = parseApiDateTime(event.endsAt);
    if (endsAt) {
      return Math.min(Math.max(endsAt.getTime(), nowMs), maxEndMs);
    }
  }

  return Math.min(Math.max(startsAt.getTime(), nowMs), maxEndMs);
}

export function getShowStatus(event: DjEvent, nowMs = Date.now()): ShowStatus {
  const startsAt = parseApiDateTime(event.startsAt);
  const effectiveEnd = getShowEffectiveEnd(event);

  if (!startsAt || !effectiveEnd) {
    return "ended";
  }

  if (nowMs < startsAt.getTime()) {
    return "upcoming";
  }

  if (nowMs >= effectiveEnd.getTime()) {
    return "ended";
  }

  return "live";
}

export function isShowUpcoming(event: DjEvent, nowMs = Date.now()): boolean {
  return getShowStatus(event, nowMs) === "upcoming";
}

export function isShowPast(event: DjEvent, nowMs = Date.now()): boolean {
  return getShowStatus(event, nowMs) === "ended";
}

export function formatShowDurationLabel(minutes: number): string {
  const option = SHOW_DURATION_OPTIONS.find((entry) => entry.value === minutes);
  return option?.label ?? `${minutes} min`;
}

export function formatShowCountdown(remainingMs: number): string {
  if (remainingMs <= 0) {
    return "0:00";
  }

  const totalSeconds = Math.ceil(remainingMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function getShowRemainingMs(event: DjEvent, nowMs = Date.now()): number {
  const effectiveEnd = getShowEffectiveEnd(event);
  if (!effectiveEnd) {
    return 0;
  }

  return Math.max(0, effectiveEnd.getTime() - nowMs);
}

export function canExtendShow(event: DjEvent, extendMinutes: number, nowMs = Date.now()): boolean {
  const startsAt = parseApiDateTime(event.startsAt);
  const baseEndMs = getExtendBaseEndMs(event, nowMs);
  if (!startsAt || baseEndMs === null) {
    return false;
  }

  const maxEndMs = startsAt.getTime() + SHOW_MAX_DURATION_MS;
  if (baseEndMs >= maxEndMs) {
    return false;
  }

  return baseEndMs + extendMinutes * 60 * 1000 <= maxEndMs;
}

export function canExtendShowByAnyOption(event: DjEvent, nowMs = Date.now()): boolean {
  return SHOW_EXTEND_OPTIONS.some((option) => canExtendShow(event, option.value, nowMs));
}

export function computeExtendedShowEndIso(
  event: DjEvent,
  extendMinutes: number,
  nowMs = Date.now(),
): string | null {
  const baseEndMs = getExtendBaseEndMs(event, nowMs);
  const startsAt = parseApiDateTime(event.startsAt);
  if (baseEndMs === null || !startsAt) {
    return null;
  }

  const maxEndMs = startsAt.getTime() + SHOW_MAX_DURATION_MS;
  const nextEndMs = Math.min(baseEndMs + extendMinutes * 60 * 1000, maxEndMs);

  if (nextEndMs <= baseEndMs) {
    return null;
  }

  return new Date(nextEndMs).toISOString();
}
