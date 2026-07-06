import { Redirect } from "expo-router";

import { useAuthStore } from "../src/store/auth";

export default function Index() {
  const status = useAuthStore((state) => state.status);

  if (status === "loading") {
    return null;
  }

  if (status === "authenticated") {
    return <Redirect href="/(tabs)/home" />;
  }

  return <Redirect href="/(auth)/login" />;
}
