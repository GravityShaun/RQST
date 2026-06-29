import type { PremiumIconName, PremiumTone } from "../../components/premium-ui";
import { activeSession, nearbyDjs, topRequestedSongs, upcomingEvents } from "../rqst/mock-data";

export function useMockHomeData() {
  const stats: Array<{
    icon: PremiumIconName;
    label: string;
    value: string;
    footnote: string;
    tone: PremiumTone;
  }> = [
    { icon: "musical-notes-outline", label: "Requests tonight", value: "4", footnote: "2 still moving up", tone: "gold" },
    { icon: "wallet-outline", label: "Budget left", value: "$36", footnote: "Wallet is ready to go", tone: "mint" },
  ];

  const conciergeNotes: Array<{
    icon: PremiumIconName;
    title: string;
    subtitle: string;
    tone: PremiumTone;
  }> = [
    {
      icon: "location-outline",
      title: "You are in the right room",
      subtitle: `${activeSession.venue} is the closest live list and the easiest place to get a song moving tonight.`,
      tone: "slate",
    },
    {
      icon: "flash-outline",
      title: "Best time to bid",
      subtitle: "The next two songs are the cleanest window to place a fresh request.",
      tone: "gold",
    },
    {
      icon: "people-outline",
      title: "Bring friends into the same song",
      subtitle: "Shared boosts are the fastest way to jump an already-popular track.",
      tone: "mint",
    },
  ];

  const activeRequests: Array<{
    title: string;
    subtitle: string;
    value: string;
    tone: PremiumTone;
  }> = [
    { title: "Midnight City", subtitle: "Open at Moonlight Room", value: "$9 from you", tone: "mint" },
    { title: "Levels", subtitle: "Played 34 min ago", value: "$12 complete", tone: "slate" },
    { title: "Mirrors", subtitle: "Locked while the DJ transitions", value: "$6 waiting", tone: "coral" },
  ];

  return {
    detectedSession: {
      title: `${activeSession.djName} at ${activeSession.venue}`,
      subtitle: `${activeSession.event} is live now in ${activeSession.neighborhood}, and the list is still moving at a friendly pace.`,
      metrics: [
        { label: "Floor", value: "$7 min" },
        { label: "Window", value: "2 songs" },
        { label: "Crowd", value: "93%" },
      ],
      chips: ["Nearby", "Add money anytime", "Manual DJ confirm"],
    },
    stats,
    conciergeNotes,
    nearbyDjs: nearbyDjs.map((item) => item.name),
    upcomingEvents,
    activeRequests,
    topRequestedSongs,
  };
}
