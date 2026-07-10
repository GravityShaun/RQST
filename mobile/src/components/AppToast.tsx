import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Animated, Easing, PanResponder, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { ConfettiOverlay } from "./ConfettiOverlay";
import { premiumTheme } from "./premium-ui";
import { useToastStore } from "../store/toast";

const DEFAULT_TOAST_DURATION_MS = 8_000;
const SWIPE_DISMISS_THRESHOLD = 48;
const SWIPE_VELOCITY_THRESHOLD = 0.75;

export function AppToast() {
  const insets = useSafeAreaInsets();
  const toast = useToastStore((state) => state.toast);
  const dismissToast = useToastStore((state) => state.dismissToast);
  const translateY = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  const [isActionPending, setIsActionPending] = useState(false);

  useEffect(() => {
    if (!toast) {
      setIsActionPending(false);
      return;
    }

    translateY.setValue(0);
    opacity.setValue(1);

    const timer = setTimeout(() => {
      dismissToast();
    }, toast.durationMs ?? DEFAULT_TOAST_DURATION_MS);

    return () => {
      clearTimeout(timer);
    };
  }, [dismissToast, opacity, toast, translateY]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gestureState) =>
          gestureState.dy < -6 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx),
        onPanResponderMove: (_, gestureState) => {
          const offset = Math.min(gestureState.dy, 0);
          translateY.setValue(offset);
          opacity.setValue(Math.max(0.35, 1 + offset / 120));
        },
        onPanResponderRelease: (_, gestureState) => {
          if (gestureState.dy < -SWIPE_DISMISS_THRESHOLD || gestureState.vy < -SWIPE_VELOCITY_THRESHOLD) {
            Animated.parallel([
              Animated.timing(translateY, {
                duration: 180,
                easing: Easing.out(Easing.cubic),
                toValue: -120,
                useNativeDriver: true,
              }),
              Animated.timing(opacity, {
                duration: 180,
                toValue: 0,
                useNativeDriver: true,
              }),
            ]).start(() => dismissToast());
            return;
          }

          Animated.parallel([
            Animated.spring(translateY, {
              damping: 24,
              stiffness: 260,
              toValue: 0,
              useNativeDriver: true,
            }),
            Animated.spring(opacity, {
              damping: 24,
              stiffness: 260,
              toValue: 1,
              useNativeDriver: true,
            }),
          ]).start();
        },
      }),
    [dismissToast, opacity, translateY],
  );

  async function handleActionPress() {
    if (!toast?.onAction || isActionPending) {
      return;
    }

    setIsActionPending(true);
    try {
      await toast.onAction();
      dismissToast();
    } finally {
      setIsActionPending(false);
    }
  }

  if (!toast) {
    return null;
  }

  return (
    <>
      {toast.showConfetti ? (
        <ConfettiOverlay burstKey={toast.id} emoji={toast.confettiEmoji} />
      ) : null}
      <View pointerEvents="box-none" style={[styles.container, { top: insets.top + 12 }]}>
      <Animated.View style={{ opacity, transform: [{ translateY }] }} {...panResponder.panHandlers}>
        <View accessibilityRole="alert" style={styles.toast}>
          <View style={styles.iconWrap}>
            <Ionicons color={premiumTheme.colors.coral} name="musical-notes" size={18} />
          </View>
          <View style={styles.copy}>
            <Text style={styles.title}>{toast.title}</Text>
            <Text style={styles.message}>{toast.message}</Text>
          </View>
          {toast.actionLabel && toast.onAction ? (
            <Pressable
              accessibilityLabel={toast.actionLabel}
              disabled={isActionPending}
              onPress={() => {
                void handleActionPress();
              }}
              style={[styles.actionButton, isActionPending && styles.actionButtonDisabled]}
            >
              {isActionPending ? (
                <ActivityIndicator color={premiumTheme.colors.coral} size="small" />
              ) : (
                <Text style={styles.actionButtonText}>{toast.actionLabel}</Text>
              )}
            </Pressable>
          ) : (
            <Pressable accessibilityLabel="Dismiss notification" onPress={dismissToast} style={styles.dismissButton}>
              <Ionicons color={premiumTheme.colors.inkMuted} name="close" size={16} />
            </Pressable>
          )}
        </View>
      </Animated.View>
    </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    left: 16,
    position: "absolute",
    right: 16,
    zIndex: 200,
  },
  toast: {
    alignItems: "center",
    backgroundColor: premiumTheme.colors.surfaceElevated,
    borderColor: premiumTheme.colors.border,
    borderRadius: premiumTheme.radii.md,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
  },
  iconWrap: {
    alignItems: "center",
    backgroundColor: "rgba(224, 90, 71, 0.12)",
    borderRadius: 999,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  copy: {
    flex: 1,
    gap: 2,
  },
  title: {
    color: premiumTheme.colors.ink,
    fontFamily: premiumTheme.fonts.display,
    fontSize: 15,
    fontWeight: "700",
  },
  message: {
    color: premiumTheme.colors.inkMuted,
    fontFamily: premiumTheme.fonts.body,
    fontSize: 13,
  },
  actionButton: {
    alignItems: "center",
    backgroundColor: "rgba(224, 90, 71, 0.1)",
    borderColor: premiumTheme.colors.coral,
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 34,
    minWidth: 64,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  actionButtonDisabled: {
    opacity: 0.7,
  },
  actionButtonText: {
    color: premiumTheme.colors.coral,
    fontFamily: premiumTheme.fonts.body,
    fontSize: 13,
    fontWeight: "800",
  },
  dismissButton: {
    alignItems: "center",
    height: 28,
    justifyContent: "center",
    width: 28,
  },
});
