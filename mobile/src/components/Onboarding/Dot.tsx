import { StyleSheet, TouchableOpacity, useWindowDimensions } from "react-native";
import Animated, {
  Extrapolation,
  interpolate,
  SharedValue,
  useAnimatedStyle,
} from "react-native-reanimated";

import { premiumTheme } from "../premium-ui";

const SITE_BLUE = "#87A8D8";
const SITE_RED = premiumTheme.colors.coral;

type Props = {
  index: number;
  x: SharedValue<number>;
};

export default function Dot({ index, x }: Props) {
  const { width: screenWidth } = useWindowDimensions();

  const animatedDotStyle = useAnimatedStyle(() => {
    const widthAnimation = interpolate(
      x.value,
      [(index - 1) * screenWidth, index * screenWidth, (index + 1) * screenWidth],
      [10, 22, 10],
      Extrapolation.CLAMP,
    );

    const opacityAnimation = interpolate(
      x.value,
      [(index - 1) * screenWidth, index * screenWidth, (index + 1) * screenWidth],
      [0.45, 1, 0.45],
      Extrapolation.CLAMP,
    );

    const currentIndex = Math.round(x.value / screenWidth);
    const dotColor = currentIndex === 0 ? SITE_BLUE : SITE_RED;

    return {
      backgroundColor: dotColor,
      opacity: opacityAnimation,
      width: widthAnimation,
    };
  });

  return (
    <TouchableOpacity activeOpacity={0.7}>
      <Animated.View style={[styles.dot, animatedDotStyle]} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  dot: {
    borderRadius: 5,
    height: 10,
    marginHorizontal: 8,
  },
});
