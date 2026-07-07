import { applyColorScheme, resolveColorScheme } from "~/lib/color-scheme";
import { loadDesktopSettings, saveDesktopSettings, type DesktopSettings } from "~/lib/settings-storage";

const settings = reactive<DesktopSettings>(loadDesktopSettings());
let persistenceWatchStarted = false;
let clientHydrated = false;
let systemMediaQuery: MediaQueryList | null = null;

function syncTheme() {
  applyColorScheme(resolveColorScheme(settings.colorScheme));
}

function handleSystemThemeChange() {
  if (settings.colorScheme === "system") {
    syncTheme();
  }
}

function updateSystemThemeListener(mode: DesktopSettings["colorScheme"]) {
  systemMediaQuery?.removeEventListener("change", handleSystemThemeChange);
  systemMediaQuery = null;

  if (mode === "system") {
    systemMediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    systemMediaQuery.addEventListener("change", handleSystemThemeChange);
  }
}

function ensurePersistenceWatch() {
  if (persistenceWatchStarted || import.meta.server) {
    return;
  }

  persistenceWatchStarted = true;
  syncTheme();
  updateSystemThemeListener(settings.colorScheme);

  watch(
    settings,
    (value) => {
      saveDesktopSettings({ ...value });
      syncTheme();
    },
    { deep: true },
  );

  watch(
    () => settings.colorScheme,
    (mode) => {
      updateSystemThemeListener(mode);
      syncTheme();
    },
  );
}

export function useDesktopSettings() {
  if (import.meta.client) {
    if (!clientHydrated) {
      clientHydrated = true;
      Object.assign(settings, loadDesktopSettings());
    }
    ensurePersistenceWatch();
  }

  return { settings };
}
