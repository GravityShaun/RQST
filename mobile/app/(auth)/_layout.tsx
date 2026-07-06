import { Stack } from "expo-router";

import { premiumTheme } from "../../src/components/premium-ui";

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: premiumTheme.colors.background },
        animation: "fade",
      }}
    />
  );
}
