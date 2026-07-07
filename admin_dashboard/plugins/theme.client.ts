import { applyColorScheme, resolveColorScheme } from "~/lib/color-scheme";
import { loadAdminSettings } from "~/lib/admin-api";

export default defineNuxtPlugin(() => {
  const config = useRuntimeConfig();
  const settings = loadAdminSettings(config.public.apiBaseUrl);
  applyColorScheme(resolveColorScheme(settings.colorScheme));
});
