import * as SecureStore from "expo-secure-store";
import type { ColorSchemeMode } from "@rqst/shared-config";

const COLOR_SCHEME_KEY = "rqst_color_scheme";

export async function loadColorScheme(): Promise<ColorSchemeMode> {
  const stored = await SecureStore.getItemAsync(COLOR_SCHEME_KEY);
  if (stored === "light" || stored === "dark" || stored === "system") {
    return stored;
  }
  return "system";
}

export async function saveColorScheme(mode: ColorSchemeMode): Promise<void> {
  await SecureStore.setItemAsync(COLOR_SCHEME_KEY, mode);
}
