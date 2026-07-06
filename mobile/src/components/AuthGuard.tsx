import { PropsWithChildren, useEffect } from "react";
import { useRootNavigationState, useRouter, useSegments } from "expo-router";

import { useAuthStore } from "../store/auth";

export function AuthGuard({ children }: PropsWithChildren) {
  const status = useAuthStore((state) => state.status);
  const segments = useSegments();
  const router = useRouter();
  const navigationState = useRootNavigationState();

  useEffect(() => {
    if (status === "loading" || !navigationState?.key) {
      return;
    }

    const inAuthGroup = segments[0] === "(auth)";
    const onOnboarding = (segments as string[]).includes("onboarding");

    if (status === "unauthenticated" && !inAuthGroup && !onOnboarding) {
      router.replace("/(auth)/login");
      return;
    }

    if (status === "authenticated" && (inAuthGroup || onOnboarding)) {
      router.replace("/(tabs)/home");
    }
  }, [navigationState?.key, router, segments, status]);

  return children;
}
