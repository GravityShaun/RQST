import { PropsWithChildren, useEffect } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AppToast } from "../components/AppToast";
import { AuthGuard } from "../components/AuthGuard";
import { ThemeSync } from "../components/ThemeSync";
import { SessionQueueSync } from "./SessionQueueSync";
import { useAuthStore } from "../store/auth";
import { usePremiumTheme } from "../store/theme";

const queryClient = new QueryClient();

function AuthBootstrap({ children }: PropsWithChildren) {
  const status = useAuthStore((state) => state.status);
  const bootstrap = useAuthStore((state) => state.bootstrap);
  const theme = usePremiumTheme();

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  return (
    <>
      {children}
      {status === "loading" ? (
        <View pointerEvents="none" style={[styles.loadingOverlay, { backgroundColor: theme.colors.background }]}>
          <ActivityIndicator color={theme.colors.coral} size="large" />
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
          <ThemeSync />
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
    justifyContent: "center",
    zIndex: 100,
  },
});
