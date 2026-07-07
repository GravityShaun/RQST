import { Platform } from "react-native";

export type PremiumTheme = {
  colors: {
    background: string;
    backgroundSecondary: string;
    surface: string;
    surfaceElevated: string;
    surfaceMuted: string;
    border: string;
    text: string;
    muted: string;
    ink: string;
    inkMuted: string;
    gold: string;
    mint: string;
    coral: string;
    slate: string;
    ringPink: string;
    ringGold: string;
    metricTile: string;
    featureTile: string;
    queueCard: string;
    venueCard: string;
    rankBadge: string;
    searchField: string;
    toggleThumb: string;
    shadow: string;
    textureNoise: string;
    textureCrosshatch: string;
  };
  radii: {
    sm: number;
    md: number;
    lg: number;
    xl: number;
  };
  fonts: {
    display: string;
    body: string;
  };
};

const fonts = {
  display: Platform.select({
    ios: "Avenir Next",
    android: "sans-serif-medium",
    default: "System",
  }) as string,
  body: Platform.select({
    ios: "Avenir Next",
    android: "sans-serif",
    default: "System",
  }) as string,
};

const radii = {
  sm: 16,
  md: 24,
  lg: 32,
  xl: 40,
} as const;

export const lightPremiumTheme: PremiumTheme = {
  colors: {
    background: "#D7DBDE",
    backgroundSecondary: "#E8EAEC",
    surface: "#F1F1F0",
    surfaceElevated: "#FFFFFF",
    surfaceMuted: "#D3D0CC",
    border: "rgba(47, 36, 36, 0.08)",
    text: "#FFF9F7",
    muted: "rgba(255,249,247,0.74)",
    ink: "#1E1717",
    inkMuted: "rgba(30,23,23,0.56)",
    gold: "#F3C6A6",
    mint: "#ABDCCF",
    coral: "#E05A47",
    slate: "#E5A4A4",
    ringPink: "#D84646",
    ringGold: "#F2B9A8",
    metricTile: "#F6E3DD",
    featureTile: "#FFB79A",
    queueCard: "#F2EFEC",
    venueCard: "#F4EFED",
    rankBadge: "#EFE2DE",
    searchField: "#FFFFFF",
    toggleThumb: "#FFFFFF",
    shadow: "#768190",
    textureNoise: "rgba(255,255,255,0.32)",
    textureCrosshatch: "rgba(255,255,255,0.30)",
  },
  radii,
  fonts,
};

export const darkPremiumTheme: PremiumTheme = {
  colors: {
    background: "#0B1118",
    backgroundSecondary: "#101A26",
    surface: "#152030",
    surfaceElevated: "#1C2A3D",
    surfaceMuted: "#243247",
    border: "rgba(186, 210, 240, 0.12)",
    text: "#F0F6FC",
    muted: "rgba(186, 206, 230, 0.72)",
    ink: "#E8F0FA",
    inkMuted: "rgba(186, 206, 230, 0.62)",
    gold: "#C9A07A",
    mint: "#7AB8A8",
    coral: "#E05A47",
    slate: "#7A9BB8",
    ringPink: "#D84646",
    ringGold: "#C9A07A",
    metricTile: "#1C2A3D",
    featureTile: "#2A3440",
    queueCard: "#152030",
    venueCard: "#152030",
    rankBadge: "#243247",
    searchField: "#1C2A3D",
    toggleThumb: "#F0F6FC",
    shadow: "#000000",
    textureNoise: "rgba(107, 159, 212, 0.10)",
    textureCrosshatch: "rgba(186, 210, 240, 0.12)",
  },
  radii,
  fonts,
};

/** @deprecated Use `usePremiumTheme()` for reactive theming. */
export const premiumTheme = lightPremiumTheme;
