import { PropsWithChildren, useEffect } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { premiumTheme } from "../components/premium-ui";
import { AppToast } from "../components/AppToast";
import { AuthGuard } from "../components/AuthGuard";
import { SessionQueueSync } from "./SessionQueueSync";
import { useAuthStore } from "../store/auth";

const queryClient = new QueryClient();

function AuthBootstrap({ children }: PropsWithChildren) {
  const status = useAuthStore((state) => state.status);
  const bootstrap = useAuthStore((state) => state.bootstrap);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  return (
    <>
      {children}
      {status === "loading" ? (
        <View pointerEvents="none" style={styles.loadingOverlay}>
          <ActivityIndicator color={premiumTheme.colors.coral} size="large" />
        </View>
      ) : null}
    </>
  );
}

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <AuthBootstrap>
          <AuthGuard>
            <SessionQueueSync />
            {children}
          </AuthGuard>
          <AppToast />
        </AuthBootstrap>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    backgroundColor: premiumTheme.colors.background,
    justifyContent: "center",
    zIndex: 100,
  },
});
