import { StyleSheet, useWindowDimensions, TouchableOpacity } from 'react-native';
import React from 'react';
import Animated, {
  Extrapolation,
  SharedValue,
  interpolate,
  interpolateColor,
  useAnimatedStyle,
} from 'react-native-reanimated';

type Props = {
  index: number;
  x: SharedValue<number>;
  onPress?: () => void;
};

function Dot({ index, x, onPress }: Props) {
  const { width: SCREEN_WIDTH } = useWindowDimensions();

  const animatedDotStyle = useAnimatedStyle(() => {
    const widthAnimation = interpolate(
      x.value,
      [
        (index - 1) * SCREEN_WIDTH,
        index * SCREEN_WIDTH,
        (index + 1) * SCREEN_WIDTH,
      ],
      [10, 20, 10],
      Extrapolation.CLAMP,
    );

    const opacityAnimation = interpolate(
      x.value,
      [
        (index - 1) * SCREEN_WIDTH,
        index * SCREEN_WIDTH,
        (index + 1) * SCREEN_WIDTH,
      ],
      [0.5, 1, 0.5],
      Extrapolation.CLAMP,
    );
    return {
      width: widthAnimation,
      opacity: opacityAnimation,
    };
  });

  const animatedColor = useAnimatedStyle(() => {
    const backgroundColor = interpolateColor(
      x.value,
      [0, SCREEN_WIDTH, 2 * SCREEN_WIDTH, 3 * SCREEN_WIDTH, 4 * SCREEN_WIDTH],
      ['#0086ff', '#c90076', '#0086ff', '#c90076', '#0086ff'],
    );
  
    return {
      backgroundColor,
    };
  });

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
      <Animated.View style={[styles.dots, animatedDotStyle, animatedColor]} />
    </TouchableOpacity>
  );
}

export default Dot;

const styles = StyleSheet.create({
  dots: {
    height: 10,
    marginHorizontal: 10,
    borderRadius: 5,
  },
});