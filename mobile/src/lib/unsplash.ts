export const unsplashImages = {
  homeHero:
    "https://images.unsplash.com/photo-1516280440614-37939bbacd81?auto=format&fit=crop&w=1200&q=80",
  spotlightDj:
    "https://images.unsplash.com/photo-1501386761578-eac5c94b800a?auto=format&fit=crop&w=1200&q=80",
  composer:
    "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?auto=format&fit=crop&w=1200&q=80",
  settingsProfile:
    "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&crop=faces&w=160&h=160&q=80",
  djPortrait:
    "https://images.unsplash.com/photo-1504593811423-6dd665756598?auto=format&fit=crop&w=1200&q=80",
  queueAccent:
    "https://images.unsplash.com/photo-1521334884684-d80222895322?auto=format&fit=crop&w=1000&q=80",
} as const;

const venueImages: Record<string, string> = {
  "Moonlight Room":
    "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=1200&q=80",
  "Velvet Radio":
    "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80",
  "Harbor Static":
    "https://images.unsplash.com/photo-1500375592092-40eb2168fd21?auto=format&fit=crop&w=1200&q=80",
};

const djImages: Record<string, string> = {
  "DJ Solace":
    "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&crop=faces&w=160&h=160&q=80",
  "Mina Flux":
    "https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?auto=format&fit=crop&crop=faces&w=160&h=160&q=80",
  "North Loop":
    "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&crop=faces&w=160&h=160&q=80",
};

const userImages: Record<string, string> = {
  "Maya Chen":
    "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&crop=faces&w=160&h=160&q=80",
  "Jalen Brooks":
    "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&crop=faces&w=160&h=160&q=80",
  "Sofia Rivera":
    "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&crop=faces&w=160&h=160&q=80",
  "Nico Park":
    "https://images.unsplash.com/photo-1507591064344-4c6ce005b128?auto=format&fit=crop&crop=faces&w=160&h=160&q=80",
  "Ava Patel":
    "https://images.unsplash.com/photo-1531123897727-8f129e1688ce?auto=format&fit=crop&crop=faces&w=160&h=160&q=80",
  "Marcus Reed":
    "https://images.unsplash.com/photo-1527980965255-d3b416303d12?auto=format&fit=crop&crop=faces&w=160&h=160&q=80",
  "Lena Ortiz":
    "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&crop=faces&w=160&h=160&q=80",
  "Owen Kim":
    "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&crop=faces&w=160&h=160&q=80",
  "Tessa Cole":
    "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&crop=faces&w=160&h=160&q=80",
  "Diego Santos":
    "https://images.unsplash.com/photo-1547425260-76bcadfb4f2c?auto=format&fit=crop&crop=faces&w=160&h=160&q=80",
  "Riley Stone":
    "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&crop=faces&w=160&h=160&q=80",
  "Mina Hart":
    "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?auto=format&fit=crop&crop=faces&w=160&h=160&q=80",
};

const songImages: Record<string, string> = {
  "One More Time":
    "https://images.unsplash.com/photo-1499364615650-ec38552f4f34?auto=format&fit=crop&w=900&q=80",
  "Heads Will Roll":
    "https://images.unsplash.com/photo-1504609813442-a8924e83f76e?auto=format&fit=crop&w=900&q=80",
  "Break My Soul":
    "https://images.unsplash.com/photo-1511379938547-c1f69419868d?auto=format&fit=crop&w=900&q=80",
  "Latch":
    "https://images.unsplash.com/photo-1504704911898-68304a7d2807?auto=format&fit=crop&w=900&q=80",
  "Midnight City":
    "https://images.unsplash.com/photo-1506157786151-b8491531f063?auto=format&fit=crop&w=900&q=80",
  Levels:
    "https://images.unsplash.com/photo-1498038432885-c6f3f1b912ee?auto=format&fit=crop&w=900&q=80",
  Mirrors:
    "https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=900&q=80",
  "Hung Up":
    "https://images.unsplash.com/photo-1507874457470-272b3c8d8ee2?auto=format&fit=crop&w=900&q=80",
  "Dance The Night":
    "https://images.unsplash.com/photo-1505236858219-8359eb29e329?auto=format&fit=crop&w=900&q=80",
  "Crazy In Love":
    "https://images.unsplash.com/photo-1509824227185-9c5a01ceba0d?auto=format&fit=crop&w=900&q=80",
};

export function getVenueImage(title: string) {
  return venueImages[title] ?? unsplashImages.homeHero;
}

export function getDjImage(name: string) {
  return djImages[name] ?? unsplashImages.djPortrait;
}

export function getUserImage(name: string) {
  return userImages[name] ?? unsplashImages.settingsProfile;
}

export function getSongImage(title: string) {
  return songImages[title] ?? unsplashImages.queueAccent;
}
