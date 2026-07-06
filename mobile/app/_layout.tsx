import { Stack } from "expo-router";
import { LogBox } from "react-native";

import { AppProviders } from "../src/lib/providers";
import { premiumTheme } from "../src/components/premium-ui";

LogBox.ignoreLogs([
  "has a shadow set but cannot calculate shadow efficiently",
  "RemoteTextInput",
  "Result accumulator timeout",
  "Reanimated",
  "Skia",
]);

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
