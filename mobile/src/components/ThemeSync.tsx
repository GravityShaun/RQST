import { useEffect } from "react";
import { StatusBar, useColorScheme } from "react-native";

import { useResolvedColorScheme, useThemeStore } from "../store/theme";

export function ThemeSync() {
  const systemScheme = useColorScheme();
  const setSystemScheme = useThemeStore((state) => state.setSystemScheme);
  const bootstrap = useThemeStore((state) => state.bootstrap);
  const resolved = useResolvedColorScheme();

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  useEffect(() => {
    setSystemScheme(systemScheme === "dark" ? "dark" : "light");
  }, [setSystemScheme, systemScheme]);

  return <StatusBar barStyle={resolved === "dark" ? "light-content" : "dark-content"} />;
}
