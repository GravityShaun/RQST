import { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

const TIMEZONE_SUFFIX_PATTERN = /(?:[zZ]|[+-]\d{2}:\d{2})$/;

export function parseDeadlineDateTime(value: string): number {
  if (!value) {
    return Number.NaN;
  }

  const trimmed = value.trim();
  const normalized = TIMEZONE_SUFFIX_PATTERN.test(trimmed) ? trimmed : `${trimmed}Z`;
  return Date.parse(normalized);
}

function formatCountdown(remainingMs: number) {
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

type DeadlineCountdownProps = {
  expiresAt: string;
  variant?: "inline" | "badge";
  expiredLabel?: string;
  onExpired?: () => void;
};

export function DeadlineCountdown({
  expiresAt,
  variant = "inline",
  expiredLabel = "Timed out",
  onExpired,
}: DeadlineCountdownProps) {
  const [now, setNow] = useState(() => Date.now());
  const hasNotifiedExpiredRef = useRef(false);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const expiresAtMs = parseDeadlineDateTime(expiresAt);
  const remainingMs = Number.isNaN(expiresAtMs) ? 0 : expiresAtMs - now;
  const isExpired = remainingMs <= 0;

  useEffect(() => {
    if (!isExpired || !onExpired || hasNotifiedExpiredRef.current) {
      return;
    }

    hasNotifiedExpiredRef.current = true;
    onExpired();
  }, [isExpired, onExpired]);

  useEffect(() => {
    hasNotifiedExpiredRef.current = false;
  }, [expiresAt]);

  if (variant === "badge") {
    return (
      <View style={[styles.badge, isExpired && styles.badgeExpired]}>
        <Ionicons color={isExpired ? "#B42318" : "#E05A47"} name={isExpired ? "timer-outline" : "hourglass-outline"} size={12} />
        <Text style={[styles.badgeText, isExpired && styles.badgeTextExpired]}>
          {isExpired ? expiredLabel : formatCountdown(remainingMs)}
        </Text>
      </View>
    );
  }

  return (
    <Text style={[styles.inlineText, isExpired && styles.inlineTextExpired]}>
      {isExpired ? expiredLabel : `Deadline ${formatCountdown(remainingMs)}`}
    </Text>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: "rgba(224, 90, 71, 0.12)",
    borderRadius: 999,
    flexDirection: "row",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  badgeExpired: {
    backgroundColor: "rgba(180, 35, 24, 0.1)",
  },
  badgeText: {
    color: "#E05A47",
    fontSize: 11,
    fontWeight: "800",
  },
  badgeTextExpired: {
    color: "#B42318",
  },
  inlineText: {
    color: "#E05A47",
    fontSize: 11,
    fontWeight: "700",
    marginTop: 2,
  },
  inlineTextExpired: {
    color: "#B42318",
  },
});

export const PLAY_DEADLINE_OPTIONS = [
  { minutes: 60, amountCents: 500, label: "1 hour" },
  { minutes: 30, amountCents: 1000, label: "30 min" },
  { minutes: 15, amountCents: 2000, label: "15 min" },
  { minutes: 5, amountCents: 5000, label: "5 min" },
] as const;

export function getPlayDeadlineAmountCents(minutes: number | null | undefined) {
  return PLAY_DEADLINE_OPTIONS.find((option) => option.minutes === minutes)?.amountCents ?? 0;
}

export function formatPlayDeadlinePrice(amountCents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amountCents / 100);
}

export function formatPlayDeadlineLabel(minutes: number | null | undefined) {
  return PLAY_DEADLINE_OPTIONS.find((option) => option.minutes === minutes)?.label ?? null;
}
