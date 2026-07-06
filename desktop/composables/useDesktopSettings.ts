import { loadDesktopSettings, saveDesktopSettings, type DesktopSettings } from "~/lib/settings-storage";

export function useDesktopSettings() {
  const settings = reactive<DesktopSettings>(loadDesktopSettings());

  watch(
    settings,
    (value) => {
      saveDesktopSettings({ ...value });
    },
    { deep: true },
  );

  return { settings };
}
