import { useMemo } from "react";
import type { StyleSheet } from "react-native";
import { create } from "zustand";
import type { ColorSchemeMode } from "@rqst/shared-config";

import { darkPremiumTheme, lightPremiumTheme, type PremiumTheme } from "../lib/theme";
import { loadColorScheme, saveColorScheme } from "../lib/settings-storage";

type ResolvedColorScheme = "light" | "dark";

type ThemeState = {
  colorScheme: ColorSchemeMode;
  systemScheme: ResolvedColorScheme;
  hydrated: boolean;
  bootstrap: () => Promise<void>;
  setColorScheme: (mode: ColorSchemeMode) => Promise<void>;
  setSystemScheme: (scheme: ResolvedColorScheme) => void;
};

export const useThemeStore = create<ThemeState>((set) => ({
  colorScheme: "system",
  systemScheme: "light",
  hydrated: false,
  bootstrap: async () => {
    const colorScheme = await loadColorScheme();
    set((state) =>
      state.hydrated && state.colorScheme === colorScheme ? state : { colorScheme, hydrated: true },
    );
  },
  setColorScheme: async (colorScheme) => {
    set((state) => (state.colorScheme === colorScheme ? state : { colorScheme }));
    await saveColorScheme(colorScheme);
  },
  setSystemScheme: (systemScheme) =>
    set((state) => (state.systemScheme === systemScheme ? state : { systemScheme })),
}));

function resolveScheme(colorScheme: ColorSchemeMode, systemScheme: ResolvedColorScheme): ResolvedColorScheme {
  return colorScheme === "system" ? systemScheme : colorScheme;
}

export function useResolvedColorScheme(): ResolvedColorScheme {
  const colorScheme = useThemeStore((state) => state.colorScheme);
  const systemScheme = useThemeStore((state) => state.systemScheme);
  return resolveScheme(colorScheme, systemScheme);
}

export function usePremiumTheme(): PremiumTheme {
  const resolved = useResolvedColorScheme();
  return resolved === "dark" ? darkPremiumTheme : lightPremiumTheme;
}

export function useThemedStyles<T extends StyleSheet.NamedStyles<T>>(factory: (theme: PremiumTheme) => T): T {
  const theme = usePremiumTheme();
  return useMemo(() => factory(theme), [theme]);
}
