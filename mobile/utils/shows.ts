export function hasShowStarted(eventStartsAt?: string | null, nowMs = Date.now()): boolean {
  if (!eventStartsAt) {
    return true;
  }

  const startsAtMs = new Date(eventStartsAt).getTime();
  if (Number.isNaN(startsAtMs)) {
    return true;
  }

  return startsAtMs <= nowMs;
}

export function formatShowDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatShowLabel(eventName?: string | null, eventStartsAt?: string | null): string | null {
  const trimmedName = eventName?.trim();
  if (trimmedName) {
    return trimmedName;
  }

  if (!eventStartsAt) {
    return null;
  }

  const formatted = formatShowDateTime(eventStartsAt);
  return formatted || null;
}
