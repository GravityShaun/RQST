import { Stack } from "expo-router";
import { LogBox } from "react-native";

import { AppProviders } from "../src/lib/providers";
import { usePremiumTheme } from "../src/store/theme";

LogBox.ignoreLogs([
  "has a shadow set but cannot calculate shadow efficiently",
  "RemoteTextInput",
  "Result accumulator timeout",
  "Reanimated",
  "Skia",
]);

function RootNavigator() {
  const theme = usePremiumTheme();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.colors.background },
      }}
    />
  );
}

export default function RootLayout() {
  return (
    <AppProviders>
      <RootNavigator />
    </AppProviders>
  );
}
