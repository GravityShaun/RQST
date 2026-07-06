import { Ionicons } from "@expo/vector-icons";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";

import { premiumTheme } from "./premium-ui";
import { getDisplayInitial, resolveAvatarUrl } from "../lib/avatar";

type Props = {
  displayName: string;
  imageUri?: string | null;
  size?: number;
  editable?: boolean;
  focusable?: boolean;
  onFocus?: () => void;
  onPress?: () => void;
  tabIndex?: number;
};

export function UserAvatar({
  displayName,
  imageUri,
  size = 128,
  editable = false,
  focusable,
  onFocus,
  onPress,
  tabIndex,
}: Props) {
  const resolvedUri = imageUri?.startsWith("file://") || imageUri?.startsWith("content://")
    ? imageUri
    : resolveAvatarUrl(imageUri);
  const initial = getDisplayInitial(displayName);
  const showInitial = initial !== "?";

  const content = resolvedUri ? (
    <Image
      accessibilityLabel="Profile photo"
      resizeMode="cover"
      source={{ uri: resolvedUri }}
      style={[styles.image, { width: size, height: size, borderRadius: size / 2 }]}
    />
  ) : (
    <View style={[styles.fallback, { width: size, height: size, borderRadius: size / 2 }]}>
      {showInitial ? (
        <Text style={[styles.initial, { fontSize: size * 0.38 }]}>{initial}</Text>
      ) : (
        <Ionicons color={premiumTheme.colors.text} name="person" size={size * 0.42} />
      )}
    </View>
  );

  if (!onPress) {
    return content;
  }

  return (
    <Pressable
      accessibilityHint={editable ? "Upload a profile photo" : undefined}
      accessibilityLabel={editable ? "Profile photo" : "Profile avatar"}
      accessibilityRole="button"
      focusable={focusable ?? !!onPress}
      onFocus={onFocus}
      onPress={onPress}
      style={({ pressed }) => [styles.pressable, pressed ? styles.pressed : null]}
      tabIndex={tabIndex}
    >
      {content}
      {editable ? (
        <View style={[styles.editBadge, { right: size * 0.04, bottom: size * 0.04 }]}>
          <Ionicons color={premiumTheme.colors.text} name="camera-outline" size={18} />
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressable: {
    position: "relative",
  },
  pressed: {
    opacity: 0.88,
  },
  image: {
    backgroundColor: premiumTheme.colors.surfaceMuted,
  },
  fallback: {
    alignItems: "center",
    backgroundColor: premiumTheme.colors.ink,
    borderColor: "rgba(255,255,255,0.18)",
    borderWidth: 1,
    justifyContent: "center",
  },
  initial: {
    color: premiumTheme.colors.text,
    fontFamily: premiumTheme.fonts.display,
    fontWeight: "700",
  },
  editBadge: {
    alignItems: "center",
    backgroundColor: premiumTheme.colors.coral,
    borderColor: "rgba(255,255,255,0.24)",
    borderRadius: 16,
    borderWidth: 1,
    height: 32,
    justifyContent: "center",
    position: "absolute",
    width: 32,
  },
});
