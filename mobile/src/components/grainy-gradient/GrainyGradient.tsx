import { LinearGradient } from "expo-linear-gradient";
import { memo, useEffect, useMemo, useState } from "react";
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

import { usePremiumTheme } from "../../store/theme";
import { GRAINY_GRADIENT_SHADER } from "./conf";
import { hexToRgba } from "./helper";
import type { IGrainyGradient } from "./types";

const METAL_MAX_TEXTURE_SIZE = 8192;

export type GrainyGradientProps = IGrainyGradient;

export const GrainyGradient = memo(function GrainyGradient({
  width: paramsWidth,
  height: paramsHeight,
  colors,
  speed = 0.1,
  animated = false,
  intensity = 0.015,
  size = 4.5,
  enabled = true,
  amplitude = 0.005,
  brightness = 0.5,
  grainColor,
  style,
}: GrainyGradientProps) {
  const theme = usePremiumTheme();
  const resolvedColors = colors ?? [theme.colors.background, theme.colors.backgroundSecondary];
  const resolvedGrainColor = grainColor ?? theme.colors.background;
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const [layout, setLayout] = useState({ height: 0, width: 0 });
  const [time, setTime] = useState(0);
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

  useEffect(() => {
    if (!animated || width <= 0 || height <= 0) {
      return undefined;
    }

    let frameId = 0;
    let lastTimestamp = 0;

    const tick = (timestamp: number) => {
      if (lastTimestamp > 0) {
        const deltaSeconds = (timestamp - lastTimestamp) / 1000;
        setTime((current) => current + deltaSeconds * speed);
      }
      lastTimestamp = timestamp;
      frameId = requestAnimationFrame(tick);
    };

    frameId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frameId);
    };
  }, [animated, height, speed, width]);

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
        : [resolvedColors[0] ?? theme.colors.background, theme.colors.backgroundSecondary]
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
        style={[styles.container, style, { backgroundColor: theme.colors.background }]}
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
        <View style={{ ...StyleSheet.absoluteFillObject, backgroundColor: theme.colors.background }} />
      )}
    </View>
  );
});

export type GrainyGradientBackgroundProps = Omit<GrainyGradientProps, "width" | "height"> & {
  style?: StyleProp<ViewStyle>;
};

export const GrainyGradientBackground = memo(function GrainyGradientBackground({
  style,
  ...props
}: GrainyGradientBackgroundProps) {
  const theme = usePremiumTheme();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const width = Math.min(screenWidth + 240, METAL_MAX_TEXTURE_SIZE);
  const height = Math.min(screenHeight + 300, METAL_MAX_TEXTURE_SIZE);

  return (
    <GrainyGradient
      {...props}
      width={width}
      height={height}
      style={[styles.background, { backgroundColor: theme.colors.background }, style]}
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
