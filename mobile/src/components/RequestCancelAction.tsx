import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { premiumTheme } from "./premium-ui";
import { formatCancelCountdown, getCancelRemainingMs, REQUEST_CANCEL_WINDOW_MS } from "../lib/request-cancel";

type RequestCancelActionProps = {
  expiresAt: number;
  requestId: number;
  onCancel: (requestId: number) => Promise<void>;
  onExpired?: () => void;
  variant?: "banner" | "inline";
};

export function RequestCancelAction({
  expiresAt,
  requestId,
  onCancel,
  onExpired,
  variant = "banner",
}: RequestCancelActionProps) {
  const [remainingMs, setRemainingMs] = useState(() => getCancelRemainingMs(expiresAt));
  const [isPending, setIsPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const onExpiredRef = useRef(onExpired);

  useEffect(() => {
    onExpiredRef.current = onExpired;
  }, [onExpired]);

  useEffect(() => {
    function syncRemaining() {
      const nextRemainingMs = getCancelRemainingMs(expiresAt);
      setRemainingMs(nextRemainingMs);

      if (nextRemainingMs <= 0) {
        onExpiredRef.current?.();
      }

      return nextRemainingMs;
    }

    syncRemaining();
    const interval = setInterval(() => {
      const nextRemainingMs = syncRemaining();
      if (nextRemainingMs <= 0) {
        clearInterval(interval);
      }
    }, 250);

    return () => clearInterval(interval);
  }, [expiresAt]);

  if (remainingMs <= 0 || remainingMs > REQUEST_CANCEL_WINDOW_MS) {
    return null;
  }

  const countdown = formatCancelCountdown(remainingMs);

  async function handlePress() {
    if (isPending) {
      return;
    }

    setErrorMessage("");
    setIsPending(true);
    try {
      await onCancel(requestId);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Could not cancel this request.");
    } finally {
      setIsPending(false);
    }
  }

  if (variant === "inline") {
    return (
      <View style={styles.inlineWrap}>
        <Pressable
          accessibilityLabel={`Cancel request, ${countdown} remaining`}
          accessibilityRole="button"
          disabled={isPending}
          onPress={() => {
            void handlePress();
          }}
          style={[styles.inlineButton, isPending && styles.buttonDisabled]}
        >
          {isPending ? (
            <ActivityIndicator color="#C95A52" size="small" />
          ) : (
            <Text style={styles.inlineButtonText}>{`Cancel · ${countdown}`}</Text>
          )}
        </Pressable>
        {errorMessage ? <Text style={styles.inlineError}>{errorMessage}</Text> : null}
      </View>
    );
  }

  return (
    <View style={styles.banner}>
      <View style={styles.bannerCopy}>
        <Text style={styles.bannerTitle}>Request sent</Text>
        <Text style={styles.bannerSubtitle}>Cancel within {countdown} if this was a mistake</Text>
      </View>
      <Pressable
        accessibilityLabel={`Cancel request, ${countdown} remaining`}
        accessibilityRole="button"
        disabled={isPending}
        onPress={() => {
          void handlePress();
        }}
        style={[styles.bannerButton, isPending && styles.buttonDisabled]}
      >
        {isPending ? (
          <ActivityIndicator color="#C95A52" size="small" />
        ) : (
          <Text style={styles.bannerButtonText}>Cancel</Text>
        )}
      </Pressable>
      {errorMessage ? <Text style={styles.bannerError}>{errorMessage}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    alignItems: "center",
    backgroundColor: "rgba(201, 90, 82, 0.08)",
    borderColor: "rgba(201, 90, 82, 0.18)",
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  bannerButton: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderColor: "rgba(201, 90, 82, 0.28)",
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: "center",
    minWidth: 72,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  bannerButtonText: {
    color: "#C95A52",
    fontFamily: premiumTheme.fonts.display,
    fontSize: 13,
    fontWeight: "800",
  },
  bannerCopy: {
    flex: 1,
    gap: 2,
  },
  bannerError: {
    bottom: -18,
    color: "#C95A52",
    fontFamily: premiumTheme.fonts.body,
    fontSize: 11,
    fontWeight: "700",
    left: 12,
    position: "absolute",
  },
  bannerSubtitle: {
    color: premiumTheme.colors.inkMuted,
    fontFamily: premiumTheme.fonts.body,
    fontSize: 12,
    fontWeight: "600",
  },
  bannerTitle: {
    color: premiumTheme.colors.ink,
    fontFamily: premiumTheme.fonts.display,
    fontSize: 13,
    fontWeight: "800",
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  inlineButton: {
    alignSelf: "flex-start",
    marginTop: 4,
  },
  inlineButtonText: {
    color: "#C95A52",
    fontFamily: premiumTheme.fonts.body,
    fontSize: 12,
    fontWeight: "800",
  },
  inlineError: {
    color: "#C95A52",
    fontFamily: premiumTheme.fonts.body,
    fontSize: 11,
    fontWeight: "700",
    marginTop: 2,
  },
  inlineWrap: {
    marginTop: 2,
  },
});
