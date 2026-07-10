import { useEffect, useMemo, useState } from "react";
import { Dimensions, StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";

import { premiumTheme } from "./premium-ui";

const CONFETTI_COLORS = [
  "#00C805",
  "#FFD700",
  "#FF4757",
  "#5352ED",
  "#FF6B81",
  "#1DD1A1",
  "#FF9F43",
  "#A29BFE",
  premiumTheme.colors.coral,
  premiumTheme.colors.gold,
  premiumTheme.colors.mint,
  "#FFFFFF",
];
const ANIMATION_DURATION_MS = 2_400;
const MAX_PIECE_DELAY_MS = 320;
const CLEANUP_BUFFER_MS = 300;

type PieceShape = "circle" | "rect" | "strip" | "emoji";

type BurstConfig = {
  burstDelayMs: number;
  originXRatio: number;
  originYRatio: number;
  pieceCount: number;
  sizeScale: number;
  spreadScale: number;
  velocityScale: number;
};

const BURST_CONFIGS: BurstConfig[] = [
  { originXRatio: 0.5, originYRatio: 0.32, burstDelayMs: 0, pieceCount: 95, sizeScale: 1.15, spreadScale: 0.72, velocityScale: 1.1 },
  { originXRatio: 0.14, originYRatio: 0.52, burstDelayMs: 220, pieceCount: 85, sizeScale: 0.82, spreadScale: 0.58, velocityScale: 0.95 },
  { originXRatio: 0.86, originYRatio: 0.44, burstDelayMs: 440, pieceCount: 90, sizeScale: 1.25, spreadScale: 0.68, velocityScale: 1.15 },
  { originXRatio: 0.28, originYRatio: 0.7, burstDelayMs: 660, pieceCount: 80, sizeScale: 0.9, spreadScale: 0.8, velocityScale: 0.88 },
  { originXRatio: 0.74, originYRatio: 0.24, burstDelayMs: 880, pieceCount: 88, sizeScale: 1.05, spreadScale: 0.64, velocityScale: 1.2 },
];

type ConfettiPieceConfig = {
  burstDelayMs: number;
  color: string;
  delayMs: number;
  emoji?: string;
  gravity: number;
  height: number;
  shape: PieceShape;
  spin: number;
  spreadScale: number;
  velocityScale: number;
  velocityX: number;
  velocityY: number;
  width: number;
  wobbleAmp: number;
};

function seededValue(seed: number, multiplier: number, offset: number) {
  const value = Math.sin(seed * multiplier + offset) * 10_000;
  return value - Math.floor(value);
}

function buildPieceConfig(
  burstIndex: number,
  pieceIndex: number,
  burst: BurstConfig,
  emoji?: string,
): ConfettiPieceConfig {
  const seed = burstIndex * 1_000 + pieceIndex + 1;
  const angle = seededValue(seed, 12.9898, 0.357) * Math.PI * 2;
  const speed = 0.55 + seededValue(seed, 78.233, 1.113) * 0.95;
  const shapeRoll = seededValue(seed, 43.758, 2.417);
  let shape: PieceShape = shapeRoll < 0.34 ? "circle" : shapeRoll < 0.67 ? "strip" : "rect";

  // Mostly emoji pieces, with a smaller share of classic confetti shapes mixed in.
  if (emoji && shapeRoll < 0.72) {
    shape = "emoji";
  }

  let width = 5;
  let height = 5;
  if (shape === "emoji") {
    const size = (16 + seededValue(seed, 19.19, 3.14) * 14) * burst.sizeScale;
    width = size;
    height = size;
  } else if (shape === "circle") {
    const size = (5 + seededValue(seed, 19.19, 3.14) * 7) * burst.sizeScale;
    width = size;
    height = size;
  } else if (shape === "strip") {
    width = (10 + seededValue(seed, 31.4159, 4.2) * 10) * burst.sizeScale;
    height = (3 + seededValue(seed, 9.876, 5.5) * 3) * burst.sizeScale;
  } else {
    width = (5 + seededValue(seed, 6.283, 6.6) * 6) * burst.sizeScale;
    height = (5 + seededValue(seed, 2.718, 7.1) * 6) * burst.sizeScale;
  }

  return {
    burstDelayMs: burst.burstDelayMs,
    color: CONFETTI_COLORS[(burstIndex * 17 + pieceIndex) % CONFETTI_COLORS.length],
    delayMs: seededValue(seed, 55.555, 1.9) * MAX_PIECE_DELAY_MS,
    emoji: shape === "emoji" ? emoji : undefined,
    gravity: 1.6 + seededValue(seed, 22.22, 8.3) * 1.1,
    height,
    shape,
    spin: (seededValue(seed, 41.41, 9.9) - 0.5) * 1_440,
    spreadScale: burst.spreadScale,
    velocityScale: burst.velocityScale,
    velocityX: Math.cos(angle) * speed,
    velocityY: 0.65 + seededValue(seed, 33.33, 2.8) * 1.35,
    width,
    wobbleAmp: seededValue(seed, 77.77, 4.4) * 18,
  };
}

function getPieceShapeStyle(shape: PieceShape, width: number, height: number) {
  if (shape === "emoji") {
    return { height, width };
  }
  if (shape === "circle") {
    return { borderRadius: width / 2, height, width };
  }
  if (shape === "strip") {
    return { borderRadius: 2, height, width };
  }
  return { borderRadius: 1, height, width };
}

function ConfettiPiece({
  config,
  originX,
  originY,
  screenHeight,
  screenWidth,
}: {
  config: ConfettiPieceConfig;
  originX: number;
  originY: number;
  screenHeight: number;
  screenWidth: number;
}) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(
      config.burstDelayMs + config.delayMs,
      withTiming(1, {
        duration: ANIMATION_DURATION_MS,
        easing: Easing.out(Easing.quad),
      }),
    );
  }, [config.burstDelayMs, config.delayMs, progress]);

  const animatedStyle = useAnimatedStyle(() => {
    const p = progress.value;
    const spread = config.spreadScale * config.velocityScale;
    const x = config.velocityX * p * screenWidth * 0.62 * spread;
    const y = -(config.velocityY * p - config.gravity * p * p) * screenHeight * 0.5 * config.velocityScale;
    const wobble = Math.sin(p * Math.PI * 6) * config.wobbleAmp * (1 - p * 0.6);
    const popScale = p < 0.08 ? 0.3 + (p / 0.08) * 0.7 : 1;
    const fadeStart = 0.78;

    return {
      opacity: p < fadeStart ? 1 : Math.max(0, 1 - (p - fadeStart) / (1 - fadeStart)),
      transform: [
        { translateX: x + wobble },
        { translateY: y },
        { rotate: `${config.spin * p}deg` },
        { scale: popScale },
      ],
    };
  });

  if (config.shape === "emoji" && config.emoji) {
    return (
      <Animated.View
        pointerEvents="none"
        style={[
          styles.piece,
          {
            left: originX - config.width / 2,
            top: originY,
            height: config.height,
            width: config.width,
          },
          animatedStyle,
        ]}
      >
        <Text style={{ fontSize: config.width * 0.85, lineHeight: config.height, textAlign: "center" }}>
          {config.emoji}
        </Text>
      </Animated.View>
    );
  }

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.piece,
        {
          backgroundColor: config.color,
          left: originX - config.width / 2,
          top: originY,
          ...getPieceShapeStyle(config.shape, config.width, config.height),
        },
        animatedStyle,
      ]}
    />
  );
}

type ConfettiBurstProps = {
  burst: BurstConfig;
  burstIndex: number;
  burstKey: number;
  emoji?: string;
  screenHeight: number;
  screenWidth: number;
};

function ConfettiBurst({ burst, burstIndex, burstKey, emoji, screenHeight, screenWidth }: ConfettiBurstProps) {
  const pieces = useMemo(
    () =>
      Array.from({ length: burst.pieceCount }, (_, pieceIndex) =>
        buildPieceConfig(burstIndex, pieceIndex, burst, emoji),
      ),
    [burst, burstIndex, emoji],
  );
  const originX = screenWidth * burst.originXRatio;
  const originY = screenHeight * burst.originYRatio;

  return (
    <>
      {pieces.map((config, pieceIndex) => (
        <ConfettiPiece
          key={`${burstKey}-${burstIndex}-${pieceIndex}`}
          config={config}
          originX={originX}
          originY={originY}
          screenHeight={screenHeight}
          screenWidth={screenWidth}
        />
      ))}
    </>
  );
}

type ConfettiOverlayProps = {
  burstKey: number;
  emoji?: string;
};

export function ConfettiOverlay({ burstKey, emoji }: ConfettiOverlayProps) {
  const [isVisible, setIsVisible] = useState(true);
  const { height: screenHeight, width: screenWidth } = Dimensions.get("window");
  const lastBurstDelayMs = Math.max(...BURST_CONFIGS.map((burst) => burst.burstDelayMs));

  useEffect(() => {
    setIsVisible(true);

    const hideTimer = setTimeout(() => {
      setIsVisible(false);
    }, lastBurstDelayMs + ANIMATION_DURATION_MS + MAX_PIECE_DELAY_MS + CLEANUP_BUFFER_MS);

    return () => {
      clearTimeout(hideTimer);
    };
  }, [burstKey, lastBurstDelayMs]);

  if (!isVisible) {
    return null;
  }

  return (
    <View key={burstKey} pointerEvents="none" style={styles.container}>
      {BURST_CONFIGS.map((burst, burstIndex) => (
        <ConfettiBurst
          key={`${burstKey}-burst-${burstIndex}`}
          burst={burst}
          burstIndex={burstIndex}
          burstKey={burstKey}
          emoji={emoji}
          screenHeight={screenHeight}
          screenWidth={screenWidth}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden",
    zIndex: 199,
  },
  piece: {
    position: "absolute",
  },
});
