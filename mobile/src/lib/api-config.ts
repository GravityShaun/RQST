import { Platform } from "react-native";

const localApiHost = Platform.OS === "android" ? "10.0.2.2" : "127.0.0.1";

export const apiBaseUrl = (process.env.EXPO_PUBLIC_RQST_API_URL ?? `http://${localApiHost}:8000/api/v1`).replace(/\/$/, "");

export const wsBaseUrl = (
  process.env.EXPO_PUBLIC_RQST_WS_URL ?? apiBaseUrl.replace(/^http/, "ws").replace(/\/api\/v1$/, "")
).replace(/\/$/, "");
