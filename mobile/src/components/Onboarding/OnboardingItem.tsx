import { useRef } from "react";
import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, TextInput, useWindowDimensions, View } from "react-native";
import Animated, { Extrapolation, interpolate, SharedValue, useAnimatedStyle } from "react-native-reanimated";

import { UserAvatar } from "../UserAvatar";
import { premiumTheme } from "../premium-ui";
import { onboardingFieldTabIndex, type OnboardingData } from "../../data/onboarding";

type Props = {
  index: number;
  onFieldFocus: (slideIndex: number) => void;
  x: SharedValue<number>;
  item: OnboardingData;
  displayName: string;
  setDisplayName: (value: string) => void;
  password: string;
  setPassword: (value: string) => void;
  confirmPassword: string;
  setConfirmPassword: (value: string) => void;
  avatarUri: string | null;
  onPickAvatar: () => void;
  displayNameError: string | null;
  passwordError: string | null;
  confirmPasswordError: string | null;
};

export default function OnboardingItem({
  index,
  onFieldFocus,
  x,
  item,
  displayName,
  setDisplayName,
  password,
  setPassword,
  confirmPassword,
  setConfirmPassword,
  avatarUri,
  onPickAvatar,
  displayNameError,
  passwordError,
  confirmPasswordError,
}: Props) {
  const { width: screenWidth } = useWindowDimensions();
  const confirmPasswordRef = useRef<TextInput>(null);
  const handleFocus = () => onFieldFocus(index);

  const iconAnimationStyle = useAnimatedStyle(() => {
    const translateY = interpolate(
      x.value,
      [(index - 1) * screenWidth, index * screenWidth, (index + 1) * screenWidth],
      [120, 0, -120],
      Extrapolation.CLAMP,
    );

    return { transform: [{ translateY }] };
  });

  const circleAnimation = useAnimatedStyle(() => {
    const scale = interpolate(
      x.value,
      [(index - 1) * screenWidth, index * screenWidth, (index + 1) * screenWidth],
      [1, 4, 4],
      Extrapolation.CLAMP,
    );

    return { transform: [{ scale }] };
  });

  const renderInput = () => {
    switch (item.id) {
      case "name":
        return (
          <View style={styles.inputContainer}>
            <TextInput
              accessibilityLabel="Display name"
              autoCapitalize="words"
              autoComplete="name"
              autoCorrect={false}
              onChangeText={setDisplayName}
              onFocus={handleFocus}
              placeholder="Display name"
              placeholderTextColor="rgba(255,249,247,0.56)"
              returnKeyType="next"
              style={styles.input}
              tabIndex={onboardingFieldTabIndex.displayName}
              textContentType="name"
              value={displayName}
            />
            {displayNameError ? <Text style={styles.errorText}>{displayNameError}</Text> : null}
          </View>
        );
      case "password":
        return (
          <View style={styles.inputContainer}>
            <TextInput
              accessibilityLabel="Password"
              autoComplete="password-new"
              autoCorrect={false}
              onChangeText={setPassword}
              onFocus={handleFocus}
              onSubmitEditing={() => confirmPasswordRef.current?.focus()}
              placeholder="Password"
              placeholderTextColor="rgba(255,249,247,0.56)"
              returnKeyType="next"
              secureTextEntry
              style={styles.input}
              submitBehavior="submit"
              tabIndex={onboardingFieldTabIndex.password}
              textContentType="newPassword"
              value={password}
            />
            {passwordError ? <Text style={styles.errorText}>{passwordError}</Text> : null}
            <TextInput
              ref={confirmPasswordRef}
              accessibilityLabel="Confirm password"
              autoComplete="password-new"
              autoCorrect={false}
              onChangeText={setConfirmPassword}
              onFocus={handleFocus}
              placeholder="Confirm password"
              placeholderTextColor="rgba(255,249,247,0.56)"
              returnKeyType="done"
              secureTextEntry
              style={styles.input}
              tabIndex={onboardingFieldTabIndex.confirmPassword}
              textContentType="newPassword"
              value={confirmPassword}
            />
            {confirmPasswordError ? <Text style={styles.errorText}>{confirmPasswordError}</Text> : null}
          </View>
        );
      case "photo":
        return (
          <View style={styles.inputContainer}>
            <View style={styles.photoInputWrap}>
              <UserAvatar
                displayName={displayName}
                editable
                focusable
                imageUri={avatarUri}
                onFocus={handleFocus}
                onPress={onPickAvatar}
                size={128}
                tabIndex={onboardingFieldTabIndex.photo}
              />
            </View>
          </View>
        );
      default:
        return null;
    }
  };

  return (
    <View style={[styles.itemContainer, { width: screenWidth }]}>
      <View style={styles.circleContainer}>
        <Animated.View
          style={[
            {
              width: screenWidth,
              height: screenWidth,
              borderRadius: screenWidth / 2,
              backgroundColor: item.backgroundColor,
            },
            circleAnimation,
          ]}
        />
      </View>

      <Animated.View style={[styles.iconContainer, iconAnimationStyle]}>
        <View style={styles.iconBadge}>
          <Ionicons color={item.textColor} name={item.icon} size={72} />
        </View>
      </Animated.View>

      <View style={styles.copyContainer}>
        <Text style={[styles.itemText, { color: item.textColor }]}>{item.text}</Text>
        <Text style={[styles.itemDescription, { color: item.textColor }]}>{item.description}</Text>
      </View>

      {renderInput()}
    </View>
  );
}

const styles = StyleSheet.create({
  itemContainer: {
    alignItems: "center",
    flex: 1,
    justifyContent: "space-around",
    marginBottom: 120,
    paddingHorizontal: 24,
  },
  circleContainer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "flex-end",
  },
  iconContainer: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: 48,
  },
  iconBadge: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.16)",
    borderColor: "rgba(255,255,255,0.24)",
    borderRadius: 40,
    borderWidth: 1,
    height: 128,
    justifyContent: "center",
    width: 128,
  },
  copyContainer: {
    gap: 12,
    paddingHorizontal: 12,
  },
  itemText: {
    fontFamily: premiumTheme.fonts.display,
    fontSize: 36,
    fontWeight: "700",
    textAlign: "center",
  },
  itemDescription: {
    fontFamily: premiumTheme.fonts.body,
    fontSize: 16,
    lineHeight: 24,
    opacity: 0.82,
    textAlign: "center",
  },
  inputContainer: {
    width: "100%",
  },
  photoInputWrap: {
    alignItems: "center",
    marginTop: 12,
  },
  input: {
    backgroundColor: "rgba(30,23,23,0.72)",
    borderColor: "rgba(255,255,255,0.18)",
    borderRadius: 16,
    borderWidth: 1,
    color: premiumTheme.colors.text,
    fontSize: 16,
    height: 56,
    marginTop: 12,
    paddingHorizontal: 16,
  },
  errorText: {
    color: "#FFD0C8",
    fontSize: 13,
    marginTop: 8,
  },
});
