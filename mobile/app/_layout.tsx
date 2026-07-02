import { Stack } from "expo-router";

import { AppProviders } from "../src/lib/providers";
import { premiumTheme } from "../src/components/premium-ui";

export default function RootLayout() {
  return (
    <AppProviders>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: premiumTheme.colors.background },
        }}
      />
    </AppProviders>
  );
}
