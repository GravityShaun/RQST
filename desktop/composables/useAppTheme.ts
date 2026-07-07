import { useDesktopSettings } from "~/composables/useDesktopSettings";

export function useAppTheme() {
  const { settings } = useDesktopSettings();

  return {
    colorScheme: computed(() => settings.colorScheme),
    resolved: computed(() => {
      if (import.meta.server) {
        return settings.colorScheme === "dark" ? "dark" : "light";
      }

      return settings.colorScheme === "system"
        ? window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light"
        : settings.colorScheme;
    }),
  };
}
