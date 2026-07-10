const TIMEZONE_SUFFIX_PATTERN = /(?:[zZ]|[+-]\d{2}:\d{2})$/;

export function parseApiDateTime(value: string): Date | null {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  const normalized = TIMEZONE_SUFFIX_PATTERN.test(trimmed) ? trimmed : `${trimmed}Z`;
  const date = new Date(normalized);

  return Number.isNaN(date.getTime()) ? null : date;
}

export function toDateTimeLocalValue(value: string | Date | null | undefined): string {
  const date = value instanceof Date ? value : parseApiDateTime(value ?? "");
  if (!date) {
    return "";
  }

  const pad = (part: number) => String(part).padStart(2, "0");
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
  ].join("-") + `T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function fromDateTimeLocalValue(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const date = new Date(trimmed);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function formatEventDateTime(value: string): string {
  const date = parseApiDateTime(value);
  if (!date) {
    return "Unknown date";
  }

  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function formatTimeAgo(value: string, nowMs = Date.now()): string {
  const date = parseApiDateTime(value);
  if (!date) {
    return "Unknown";
  }

  const seconds = Math.floor((nowMs - date.getTime()) / 1000);
  if (seconds < 60) {
    return "just now";
  }

  const totalMinutes = Math.floor(seconds / 60);
  if (totalMinutes < 60) {
    return totalMinutes === 1 ? "1 min ago" : `${totalMinutes} min ago`;
  }

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours < 24) {
    const hourLabel = hours === 1 ? "1 hr" : `${hours} hr`;
    if (minutes === 0) {
      return `${hourLabel} ago`;
    }
    return `${hourLabel} ${minutes} min ago`;
  }

  const days = Math.floor(hours / 24);
  if (days < 7) {
    return days === 1 ? "1 day ago" : `${days} days ago`;
  }

  const weeks = Math.floor(days / 7);
  return weeks === 1 ? "1 week ago" : `${weeks} weeks ago`;
}

export function formatDurationSeconds(totalSeconds: number | null | undefined): string | null {
  if (totalSeconds == null || totalSeconds < 0) {
    return null;
  }

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}
