import { LinearGradient } from "expo-linear-gradient";
import { memo, useMemo, useState } from "react";
import {
  Canvas,
  Skia,
  Fill,
  Shader,
  type SkRuntimeEffect,
} from "@shopify/react-native-skia";
import {
  StyleSheet,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import { GRAINY_GRADIENT_SHADER } from "./conf";
import { hexToRgba } from "./helper";
import type { IGrainyGradient } from "./types";
import { useGrainyAnimationTime } from "./useGrainyAnimationTime";

const METAL_MAX_TEXTURE_SIZE = 8192;

/** Dark palette for the request tab animated background. */
export const requestDarkGradientColors = ["#6B1018", "#141830", "#082E6B"] as const;

const requestDarkBackground = "#050818";

export type DarkGrainyGradientProps = IGrainyGradient;

export const DarkGrainyGradient = memo(function DarkGrainyGradient({
  width: paramsWidth,
  height: paramsHeight,
  colors,
  speed = 0.1,
  animated = false,
  intensity = 0.015,
  size = 4.5,
  enabled = true,
  amplitude = 0.005,
  brightness = 0.4,
  grainColor,
  style,
}: DarkGrainyGradientProps) {
  const resolvedColors = colors ?? [...requestDarkGradientColors];
  const resolvedGrainColor = grainColor ?? requestDarkBackground;
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const [layout, setLayout] = useState({ height: 0, width: 0 });
  const time = useGrainyAnimationTime(animated, speed);
  const width = Math.min(
    paramsWidth ?? (layout.width > 0 ? layout.width : screenWidth),
    METAL_MAX_TEXTURE_SIZE,
  );
  const height = Math.min(
    paramsHeight ?? (layout.height > 0 ? layout.height : screenHeight),
    METAL_MAX_TEXTURE_SIZE,
  );
  const shader = useMemo<SkRuntimeEffect | null>(
    () => Skia.RuntimeEffect.Make(GRAINY_GRADIENT_SHADER),
    [],
  );

  const parsedColors = useMemo(() => {
    const result: [number, number, number, number][] = [];
    for (let i = 0; i < 5; i++) {
      result.push(i < resolvedColors.length ? hexToRgba(resolvedColors[i]!) : [0, 0, 0, 1]);
    }
    return result;
  }, [resolvedColors]);

  const parsedGrainColor = useMemo(() => hexToRgba(resolvedGrainColor), [resolvedGrainColor]);

  const uniforms = useMemo(
    () => ({
      iResolution: [width, height],
      iTime: time,
      uColor0: parsedColors[0],
      uColor1: parsedColors[1],
      uColor2: parsedColors[2],
      uColor3: parsedColors[3],
      uColor4: parsedColors[4],
      uColorCount: Math.min(resolvedColors.length, 5),
      uAmplitude: amplitude,
      uGrainIntensity: intensity,
      uGrainSize: size,
      uGrainEnabled: enabled ? 1 : 0,
      uBrightness: brightness,
      uGrainColor: parsedGrainColor,
    }),
    [
      amplitude,
      brightness,
      enabled,
      height,
      intensity,
      parsedColors,
      parsedGrainColor,
      resolvedColors.length,
      size,
      time,
      width,
    ],
  );

  const onLayout = (event: LayoutChangeEvent) => {
    if (paramsWidth && paramsHeight) {
      return;
    }

    const { height: nextHeight, width: nextWidth } = event.nativeEvent.layout;
    setLayout({ height: nextHeight, width: nextWidth });
  };

  if (!animated) {
    const gradientColors = (
      resolvedColors.filter(Boolean).length >= 2
        ? resolvedColors.filter(Boolean)
        : [resolvedColors[0] ?? requestDarkGradientColors[0], requestDarkGradientColors[2]]
    ) as [string, string, ...string[]];

    return (
      <View pointerEvents="none" onLayout={onLayout} style={[styles.container, style]}>
        <LinearGradient
          colors={gradientColors}
          end={{ x: 1, y: 1 }}
          start={{ x: 0, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
      </View>
    );
  }

  if (!shader) {
    return (
      <View
        pointerEvents="none"
        onLayout={onLayout}
        style={[styles.container, style, { backgroundColor: requestDarkBackground }]}
      />
    );
  }

  return (
    <View pointerEvents="none" onLayout={onLayout} style={[styles.container, style]}>
      {width > 0 && height > 0 ? (
        <Canvas style={{ height, width }}>
          <Fill>
            <Shader source={shader} uniforms={uniforms} />
          </Fill>
        </Canvas>
      ) : (
        <View style={{ ...StyleSheet.absoluteFillObject, backgroundColor: requestDarkBackground }} />
      )}
    </View>
  );
});

export type DarkGrainyGradientBackgroundProps = Omit<DarkGrainyGradientProps, "width" | "height"> & {
  style?: StyleProp<ViewStyle>;
};

export const DarkGrainyGradientBackground = memo(function DarkGrainyGradientBackground({
  style,
  colors = [...requestDarkGradientColors],
  ...props
}: DarkGrainyGradientBackgroundProps) {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const width = Math.min(screenWidth + 240, METAL_MAX_TEXTURE_SIZE);
  const height = Math.min(screenHeight + 300, METAL_MAX_TEXTURE_SIZE);

  return (
    <DarkGrainyGradient
      {...props}
      colors={colors}
      width={width}
      height={height}
      style={[styles.background, { backgroundColor: requestDarkBackground }, style]}
    />
  );
});

const styles = StyleSheet.create({
  background: {
    bottom: -180,
    left: -120,
    position: "absolute",
    right: -120,
    top: -120,
  },
  container: {
    overflow: "hidden",
  },
});
