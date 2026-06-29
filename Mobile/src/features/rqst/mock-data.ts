import type { PremiumTone } from "../../components/premium-ui";

export type RqstVenue = {
  title: string;
  subtitle: string;
  requestFloorCents: number;
  distance: string;
  energy: number;
  latitude: number;
  longitude: number;
  tags: string[];
  tone: PremiumTone;
};

export type QueueItem = {
  id: string;
  rank: number;
  title: string;
  artist: string;
  totalCents: number;
  contributors: number;
  status: string;
  momentum: string;
};

export type UserRequest = {
  id: string;
  title: string;
  artist: string;
  venue: string;
  totalCents: number;
  myContributionCents: number;
  status: "Open" | "Locked" | "Played" | "Canceled";
  canCancel: boolean;
};

export const activeSession = {
  venue: "Moonlight Room",
  djName: "DJ Solace",
  event: "Friday Fever",
  neighborhood: "Williamsburg",
  distance: "0.2 mi away",
  requestFloorCents: 700,
  crowdStatus: "Packed, but moving smoothly",
  nextWindow: "Open for the next 2 songs",
  nowPlaying: "Disclosure - You & Me (Flume Remix)",
};

export const nearbyVenues: RqstVenue[] = [
  {
    title: "Moonlight Room",
    subtitle: "DJ Solace is taking upbeat pop, house, and crossover throwbacks.",
    requestFloorCents: 700,
    distance: "0.2 mi away",
    energy: 0.93,
    latitude: 32.7812,
    longitude: -79.9316,
    tags: ["Fast queue", "Shared boosts", "Women-led lineup"],
    tone: "gold",
  },
  {
    title: "Velvet Radio",
    subtitle: "Mina Flux is running a stylish disco set with lower floor pricing.",
    requestFloorCents: 500,
    distance: "0.6 mi away",
    energy: 0.82,
    latitude: 32.7768,
    longitude: -79.9415,
    tags: ["Disco", "Lower spend", "Friendly crowd"],
    tone: "mint",
  },
  {
    title: "Harbor Static",
    subtitle: "A rooftop room with slower pacing and more selective confirmations.",
    requestFloorCents: 900,
    distance: "1.1 mi away",
    energy: 0.74,
    latitude: 32.7889,
    longitude: -79.9232,
    tags: ["Rooftop", "Afrobeats", "Manual confirms"],
    tone: "slate",
  },
];

export const liveQueue: QueueItem[] = [
  {
    id: "queue-1",
    rank: 1,
    title: "One More Time",
    artist: "Daft Punk",
    totalCents: 3600,
    contributors: 5,
    status: "Open",
    momentum: "Three people boosted this in the last 8 minutes.",
  },
  {
    id: "queue-2",
    rank: 2,
    title: "Heads Will Roll",
    artist: "Yeah Yeah Yeahs",
    totalCents: 2950,
    contributors: 4,
    status: "Open",
    momentum: "Still climbing because the room is leaning indie-dance.",
  },
  {
    id: "queue-3",
    rank: 3,
    title: "Break My Soul",
    artist: "Beyonce",
    totalCents: 2400,
    contributors: 3,
    status: "Locked",
    momentum: "Locked while the DJ transitions out of the current run.",
  },
  {
    id: "queue-4",
    rank: 4,
    title: "Latch",
    artist: "Disclosure",
    totalCents: 1800,
    contributors: 2,
    status: "Open",
    momentum: "A lower total, but it matches the room really well tonight.",
  },
];

export const topRequestedSongs = [
  { title: "Murder on the Dancefloor", artist: "Sophie Ellis-Bextor", amount: "$41", tone: "gold" as const },
  { title: "Titanium", artist: "David Guetta", amount: "$33", tone: "mint" as const },
  { title: "Hot to Go!", artist: "Chappell Roan", amount: "$28", tone: "coral" as const },
];

export const upcomingEvents = [
  { title: "Sunset Terrace Pre-Party", subtitle: "Tomorrow · 7:00 PM · Greenpoint", value: "RSVP open" },
  { title: "Afterglow Rooftop", subtitle: "Saturday · 10:30 PM · Williamsburg", value: "Low floor" },
  { title: "Cherry Disco Social", subtitle: "Sunday · 5:30 PM · Bushwick", value: "Family of DJs" },
];

export const nearbyDjs = [
  { name: "DJ Solace", detail: "Pop house · Moonlight Room", tone: "gold" as const },
  { name: "Mina Flux", detail: "Disco edits · Velvet Radio", tone: "mint" as const },
  { name: "North Loop", detail: "Late rap set · Harbor Static", tone: "slate" as const },
];

export const songLibrary = [
  { id: "song-1", title: "Hung Up", artist: "Madonna" },
  { id: "song-2", title: "Dance The Night", artist: "Dua Lipa" },
  { id: "song-3", title: "Crazy In Love", artist: "Beyonce" },
  { id: "song-4", title: "Call On Me", artist: "Eric Prydz" },
  { id: "song-5", title: "Levitating", artist: "Dua Lipa" },
  { id: "song-6", title: "Get Lucky", artist: "Daft Punk" },
  { id: "song-7", title: "Party Rock Anthem", artist: "LMFAO" },
  { id: "song-8", title: "I Wanna Dance with Somebody", artist: "Whitney Houston" },
];

export const initialUserRequests: UserRequest[] = [
  {
    id: "request-1",
    title: "Midnight City",
    artist: "M83",
    venue: "Moonlight Room",
    totalCents: 1800,
    myContributionCents: 900,
    status: "Open",
    canCancel: true,
  },
  {
    id: "request-2",
    title: "Levels",
    artist: "Avicii",
    venue: "Moonlight Room",
    totalCents: 2600,
    myContributionCents: 1200,
    status: "Played",
    canCancel: false,
  },
  {
    id: "request-3",
    title: "Mirrors",
    artist: "Justin Timberlake",
    venue: "Velvet Radio",
    totalCents: 1400,
    myContributionCents: 600,
    status: "Locked",
    canCancel: false,
  },
];

export const djProfile = {
  name: "DJ Solace",
  handle: "@djsolace",
  bio: "Warm, high-energy pop and house sets with just enough chaos to keep a room smiling.",
  followers: "12.4k",
  acceptanceRate: "84%",
  totalEarnedTonight: "$246",
  genres: ["Pop house", "Disco edits", "2000s throwbacks"],
  socials: ["Instagram", "TikTok", "Spotify"],
  events: [
    { title: "Moonlight Room Residency", subtitle: "Every Friday · Williamsburg", value: "Tonight" },
    { title: "Sunday Soft Launch", subtitle: "Harbor Static · Rooftop session", value: "Tomorrow" },
  ],
};
