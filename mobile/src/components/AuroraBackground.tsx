import { Canvas, Fill, Shader, Skia } from "@shopify/react-native-skia";
import { memo, useEffect, useMemo, useState } from "react";
import { StyleSheet, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from "react-native";

import { premiumTheme } from "./premium-ui";

const AURORA_SHADER = `
uniform float2 resolution;
uniform float time;
uniform vec3 color1;
uniform vec3 color2;
uniform vec3 color3;
uniform vec3 skyTop;
uniform vec3 skyBottom;
uniform float speed;
uniform float intensity;
uniform float2 waveDirection;

float hash(float n) {
  return fract(sin(n) * 43758.5453);
}

float noise(float2 p) {
  float2 i = floor(p);
  float2 f = fract(p);
  float a = 3.0;
  float2 u = f * f * (a - 2.0 * f);
  return mix(
    mix(hash(i.x + hash(i.y)), hash(i.x + 1.0 + hash(i.y)), u.x),
    mix(hash(i.x + hash(i.y + 1)), hash(i.x + 1.0 + hash(i.y + 1.0)), u.x),
    u.y
  );
}

vec3 auroraLayer(float2 uv, float layerSpeed, float layerIntensity, vec3 color) {
  float t = time * layerSpeed * speed;
  float2 p = uv * 2.0 + t * waveDirection;
  float n = noise(p + noise(color.xy + p + t));
  float aurora = (n - uv.y * 0.5);
  return color * aurora * layerIntensity * intensity * 2.0;
}

half4 main(float2 fragCoord) {
  float2 uv = fragCoord / resolution;
  uv.x *= resolution.x / resolution.y;
  vec3 color = vec3(0.0);
  color += auroraLayer(uv, 0.05, 0.3, color1);
  color += auroraLayer(uv, 0.1, 0.4, color2);
  color += auroraLayer(uv, 0.15, 0.2, color3);
  color += auroraLayer(uv, 0.25, 0.3, color1 * 0.5 + color3 * 0.2);

  color += skyTop * (1.0 - smoothstep(0.4, 1.0, uv.y));
  color += skyBottom * (1.0 - smoothstep(0.5, 0.9, uv.y));

  return half4(color, 1.0);
}
`;

const SKY_TOP = premiumTheme.colors.background;
const SKY_BOTTOM = premiumTheme.colors.backgroundSecondary;
const WAVE_DIRECTION: [number, number] = [9, -9];
const AURORA_EFFECT = Skia.RuntimeEffect.Make(AURORA_SHADER);

export type AuroraProps = {
  amplitude?: number;
  blend?: number;
  colorStops?: [string, string, string];
  speed?: number;
  style?: StyleProp<ViewStyle>;
};

function hexToRgb(hex: string): [number, number, number] {
  const normalized = hex.replace("#", "");
  const value =
    normalized.length === 3
      ? normalized
          .split("")
          .map((char) => char + char)
          .join("")
      : normalized;

  return [
    parseInt(value.slice(0, 2), 16) / 255,
    parseInt(value.slice(2, 4), 16) / 255,
    parseInt(value.slice(4, 6), 16) / 255,
  ];
}

export const Aurora = memo(function Aurora({
  amplitude = 1,
  blend = 0.5,
  colorStops = ["#5227FF", "#7cff67", "#5227FF"],
  speed = 1,
  style,
}: AuroraProps) {
  const [layout, setLayout] = useState({ height: 0, width: 0 });
  const [time, setTime] = useState(0);

  const intensity = amplitude * (0.7 + blend * 0.45);
  const shaderSpeed = speed * 0.55;
  const color1 = useMemo(() => hexToRgb(colorStops[0]), [colorStops]);
  const color2 = useMemo(() => hexToRgb(colorStops[1]), [colorStops]);
  const color3 = useMemo(() => hexToRgb(colorStops[2]), [colorStops]);
  const skyTop = useMemo(() => hexToRgb(SKY_TOP), []);
  const skyBottom = useMemo(() => hexToRgb(SKY_BOTTOM), []);

  useEffect(() => {
    if (layout.width <= 0 || layout.height <= 0) {
      return undefined;
    }

    let frameId = 0;
    let lastTimestamp = 0;

    const tick = (timestamp: number) => {
      if (lastTimestamp > 0) {
        const deltaSeconds = (timestamp - lastTimestamp) / 1000;
        setTime((current) => current + deltaSeconds);
      }
      lastTimestamp = timestamp;
      frameId = requestAnimationFrame(tick);
    };

    frameId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frameId);
    };
  }, [layout.height, layout.width]);

  const uniforms = useMemo(
    () => ({
      color1,
      color2,
      color3,
      intensity,
      resolution: [layout.width, layout.height] as [number, number],
      skyBottom,
      skyTop,
      speed: shaderSpeed,
      time,
      waveDirection: WAVE_DIRECTION,
    }),
    [color1, color2, color3, intensity, layout.height, layout.width, shaderSpeed, skyBottom, skyTop, time],
  );

  const onLayout = (event: LayoutChangeEvent) => {
    const { height, width } = event.nativeEvent.layout;
    setLayout({ height, width });
  };

  return (
    <View pointerEvents="none" onLayout={onLayout} style={[styles.container, style]}>
      {layout.width > 0 && layout.height > 0 && AURORA_EFFECT ? (
        <Canvas style={{ height: layout.height, width: layout.width }}>
          <Fill>
            <Shader source={AURORA_EFFECT} uniforms={uniforms} />
          </Fill>
        </Canvas>
      ) : (
        <View style={styles.placeholder} />
      )}
    </View>
  );
});

export const AuroraBackground = Aurora;

const styles = StyleSheet.create({
  container: {
    overflow: "hidden",
  },
  placeholder: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: SKY_TOP,
  },
});
