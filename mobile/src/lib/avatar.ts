import { apiBaseUrl } from "./api-config";

export function resolveAvatarUrl(avatarUrl?: string | null): string | null {
  if (!avatarUrl) {
    return null;
  }

  if (avatarUrl.startsWith("http://") || avatarUrl.startsWith("https://")) {
    return avatarUrl;
  }

  const assetBaseUrl = apiBaseUrl.replace(/\/api\/v1$/, "");
  return `${assetBaseUrl}${avatarUrl.startsWith("/") ? avatarUrl : `/${avatarUrl}`}`;
}

export function getDisplayInitial(displayName: string): string {
  const trimmed = displayName.trim();
  return trimmed ? trimmed[0]?.toUpperCase() ?? "?" : "?";
}
