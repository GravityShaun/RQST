import { Ionicons } from "@expo/vector-icons";
import { FlatList, Pressable, StyleSheet } from "react-native";
import Animated, {
  AnimatedRef,
  interpolate,
  SharedValue,
  useAnimatedStyle,
  useDerivedValue,
  withTiming,
} from "react-native-reanimated";

import { premiumTheme } from "../premium-ui";
import type { OnboardingData } from "../../data/onboarding";

type Props = {
  dataLength: number;
  flatListIndex: SharedValue<number>;
  flatListRef: AnimatedRef<FlatList<OnboardingData>>;
  isSubmitting: boolean;
  onFinish: () => void;
  onSlideChange: (index: number) => void;
  tabIndex: number;
  validateStep: (index: number) => string | null;
};

export default function CustomButton({
  flatListRef,
  flatListIndex,
  dataLength,
  isSubmitting,
  onFinish,
  onSlideChange,
  tabIndex,
  validateStep,
}: Props) {
  const progress = useDerivedValue(() =>
    withTiming(flatListIndex.value === dataLength - 1 ? 1 : 0, { duration: 250 }),
  );

  const buttonAnimationStyle = useAnimatedStyle(() => ({
    height: 60,
    width: interpolate(progress.value, [0, 1], [60, 148]),
  }));

  const arrowAnimationStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 1], [1, 0]),
    transform: [{ translateX: interpolate(progress.value, [0, 1], [0, 100]) }],
  }));

  const textAnimationStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateX: interpolate(progress.value, [0, 1], [-100, 0]) }],
  }));

  const handlePress = () => {
    if (isSubmitting) {
      return;
    }

    const validationError = validateStep(flatListIndex.value);
    if (validationError) {
      alert(validationError);
      return;
    }

    if (flatListIndex.value < dataLength - 1) {
      const nextIndex = flatListIndex.value + 1;
      onSlideChange(nextIndex);
      flatListRef.current?.scrollToIndex({ index: nextIndex });
      return;
    }

    onFinish();
  };

  return (
    <Pressable
      accessibilityRole="button"
      disabled={isSubmitting}
      focusable
      onPress={handlePress}
      tabIndex={tabIndex}
    >
      <Animated.View style={[styles.button, buttonAnimationStyle]}>
        <Animated.Text style={[styles.textButton, textAnimationStyle]}>
          {isSubmitting ? "Creating..." : "Get started"}
        </Animated.Text>
        <Animated.View style={arrowAnimationStyle}>
          <Ionicons color={premiumTheme.colors.text} name="arrow-forward" size={24} />
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: "center",
    backgroundColor: premiumTheme.colors.ink,
    borderColor: "rgba(255,255,255,0.12)",
    borderRadius: 100,
    borderWidth: 1,
    justifyContent: "center",
    overflow: "hidden",
    padding: 10,
  },
  textButton: {
    color: premiumTheme.colors.text,
    fontSize: 16,
    fontWeight: "700",
    position: "absolute",
  },
});
