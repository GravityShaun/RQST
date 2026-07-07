import { applyColorScheme, resolveColorScheme, type ColorSchemeMode } from "~/lib/color-scheme";

export function useAdminTheme() {
  const admin = useAdminConsole();

  const colorScheme = computed<ColorSchemeMode>(() => admin.state.value.settings?.colorScheme || "system");
  const resolved = computed(() => {
    if (import.meta.server) {
      return colorScheme.value === "dark" ? "dark" : "light";
    }

    return resolveColorScheme(colorScheme.value);
  });

  function setColorScheme(nextScheme: ColorSchemeMode) {
    if (!admin.state.value.settings) {
      return;
    }

    admin.updateSettings({
      ...admin.state.value.settings,
      colorScheme: nextScheme,
    });
  }

  watch(resolved, (nextResolved) => applyColorScheme(nextResolved), { immediate: true });

  return {
    colorScheme,
    resolved,
    setColorScheme,
  };
}
