export type ColorSchemeMode = "light" | "dark" | "system";
export type ResolvedColorScheme = "light" | "dark";

export function resolveColorScheme(mode: ColorSchemeMode): ResolvedColorScheme {
  if (mode !== "system") {
    return mode;
  }

  if (typeof window === "undefined") {
    return "light";
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function applyColorScheme(resolved: ResolvedColorScheme) {
  if (typeof document === "undefined") {
    return;
  }

  document.documentElement.dataset.theme = resolved;
  document.documentElement.style.colorScheme = resolved;

  const topBarColor = resolved === "dark" ? "#243247" : "#e8eaec";
  let themeColorMeta = document.querySelector('meta[name="theme-color"]');

  if (!themeColorMeta) {
    themeColorMeta = document.createElement("meta");
    themeColorMeta.setAttribute("name", "theme-color");
    document.head.appendChild(themeColorMeta);
  }

  themeColorMeta.setAttribute("content", topBarColor);
}
