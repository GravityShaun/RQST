const ACCESS_TOKEN_KEY = "rqst_access_token";
const REFRESH_TOKEN_KEY = "rqst_refresh_token";
const LEGACY_ACCESS_TOKEN_KEY = "rqst_dj_access_token";

export type StoredTokens = {
  accessToken: string;
  refreshToken: string;
};

export function loadStoredTokens(): StoredTokens | null {
  if (!import.meta.client) {
    return null;
  }

  const accessToken = localStorage.getItem(ACCESS_TOKEN_KEY) ?? localStorage.getItem(LEGACY_ACCESS_TOKEN_KEY);
  const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);

  if (!accessToken) {
    return null;
  }

  return {
    accessToken,
    refreshToken: refreshToken ?? "",
  };
}

export function saveStoredTokens(tokens: StoredTokens) {
  if (!import.meta.client) {
    return;
  }

  localStorage.setItem(ACCESS_TOKEN_KEY, tokens.accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
  localStorage.removeItem(LEGACY_ACCESS_TOKEN_KEY);
}

export function clearStoredTokens() {
  if (!import.meta.client) {
    return;
  }

  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(LEGACY_ACCESS_TOKEN_KEY);
}
