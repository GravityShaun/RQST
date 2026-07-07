import { applyColorScheme, resolveColorScheme } from "~/lib/color-scheme";
import { loadDesktopSettings } from "~/lib/settings-storage";

export default defineNuxtPlugin(() => {
  const settings = loadDesktopSettings();
  applyColorScheme(resolveColorScheme(settings.colorScheme));
});
