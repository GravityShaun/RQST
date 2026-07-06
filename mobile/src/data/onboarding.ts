import type { ComponentProps } from "react";
import type { Ionicons } from "@expo/vector-icons";

import { premiumTheme } from "../components/premium-ui";

export type OnboardingData = {
  id: string;
  text: string;
  description: string;
  backgroundColor: string;
  textColor: string;
  icon: ComponentProps<typeof Ionicons>["name"];
};

export const onboardingFieldTabIndex = {
  displayName: 0,
  photo: 1,
  password: 2,
  confirmPassword: 3,
  continue: 4,
} as const;

export const onboardingSlides: OnboardingData[] = [
  {
    id: "welcome",
    text: "Welcome to RQST",
    description: "Request songs, back the queue, and stay synced with the DJ.",
    backgroundColor: premiumTheme.colors.coral,
    textColor: premiumTheme.colors.text,
    icon: "musical-notes-outline",
  },
  {
    id: "name",
    text: "What should we call you?",
    description: "This is how DJs and the room will see you.",
    backgroundColor: premiumTheme.colors.mint,
    textColor: premiumTheme.colors.ink,
    icon: "person-outline",
  },
  {
    id: "photo",
    text: "Add a profile photo",
    description: "Optional — tap to upload, or skip and we'll use your initial.",
    backgroundColor: premiumTheme.colors.gold,
    textColor: premiumTheme.colors.ink,
    icon: "camera-outline",
  },
  {
    id: "password",
    text: "Secure your account",
    description: "Pick a password so you can sign back in anytime.",
    backgroundColor: "#4A5466",
    textColor: premiumTheme.colors.text,
    icon: "lock-closed-outline",
  },
];
