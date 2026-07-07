import type { ColorSchemeMode } from "@rqst/shared-config";

export type DesktopSettings = {
  soundAlerts: boolean;
  desktopNotifications: boolean;
  confirmBeforePlay: boolean;
  colorScheme: ColorSchemeMode;
};

const STORAGE_KEY = "rqst-desktop-settings";

const DEFAULTS: DesktopSettings = {
  soundAlerts: true,
  desktopNotifications: true,
  confirmBeforePlay: true,
  colorScheme: "system",
};

export function loadDesktopSettings(): DesktopSettings {
  if (typeof window === "undefined") {
    return { ...DEFAULTS };
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { ...DEFAULTS };
    }

    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveDesktopSettings(settings: DesktopSettings) {
  if (typeof window === "undefined") {
    return;
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}
