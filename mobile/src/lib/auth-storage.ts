import * as SecureStore from "expo-secure-store";

import type { UserProfile } from "./auth-api";

const ACCESS_TOKEN_KEY = "rqst_access_token";
const REFRESH_TOKEN_KEY = "rqst_refresh_token";
const USER_PROFILE_KEY = "rqst_user_profile";

const secureStoreOptions: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
};

export type StoredTokens = {
  accessToken: string;
  refreshToken: string;
};

export type StoredSession = StoredTokens & {
  user: UserProfile | null;
};

export async function loadStoredTokens(): Promise<StoredTokens | null> {
  const [accessToken, refreshToken] = await Promise.all([
    SecureStore.getItemAsync(ACCESS_TOKEN_KEY),
    SecureStore.getItemAsync(REFRESH_TOKEN_KEY),
  ]);

  if (!accessToken || !refreshToken) {
    return null;
  }

  return { accessToken, refreshToken };
}

export async function loadStoredUser(): Promise<UserProfile | null> {
  const raw = await SecureStore.getItemAsync(USER_PROFILE_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as UserProfile;
  } catch {
    return null;
  }
}

export async function loadStoredSession(): Promise<StoredSession | null> {
  const tokens = await loadStoredTokens();
  if (!tokens) {
    return null;
  }

  const user = await loadStoredUser();
  return { ...tokens, user };
}

export async function saveStoredTokens(tokens: StoredTokens): Promise<void> {
  await Promise.all([
    SecureStore.setItemAsync(ACCESS_TOKEN_KEY, tokens.accessToken, secureStoreOptions),
    SecureStore.setItemAsync(REFRESH_TOKEN_KEY, tokens.refreshToken, secureStoreOptions),
  ]);
}

export async function saveStoredUser(user: UserProfile): Promise<void> {
  await SecureStore.setItemAsync(USER_PROFILE_KEY, JSON.stringify(user), secureStoreOptions);
}

export async function saveStoredSession(tokens: StoredTokens, user: UserProfile): Promise<void> {
  await Promise.all([saveStoredTokens(tokens), saveStoredUser(user)]);
}

export async function clearStoredTokens(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY),
    SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY),
    SecureStore.deleteItemAsync(USER_PROFILE_KEY),
  ]);
}
