import { Redirect, useLocalSearchParams } from "expo-router";

import { OnboardingScreen } from "../src/components/Onboarding";

export default function OnboardingRoute() {
  const params = useLocalSearchParams<{ email?: string | string[] }>();
  const emailParam = params.email;
  const email = Array.isArray(emailParam) ? emailParam[0] : emailParam;

  if (!email?.trim()) {
    return <Redirect href="/(auth)/register" />;
  }

  return <OnboardingScreen email={email.trim().toLowerCase()} />;
}
