import type { PremiumTone } from "../../components/premium-ui";
import { getDjImage, getSongImage, getUserImage, getVenueImage, unsplashImages } from "../../lib/unsplash";

export type RqstVenue = {
  title: string;
  subtitle: string;
  requestFloorCents: number;
  distance: string;
  energy: number;
  latitude: number;
  longitude: number;
  imageUri: string;
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
  requestedBy: RequesterContribution[];
  status: string;
  momentum: string;
  imageUri?: string;
  uploadedBy: UserProfile;
};

export type UserProfile = {
  id: string;
  name: string;
  handle: string;
  imageUri: string;
  bio: string;
  neighborhood: string;
  favoriteGenres: string[];
  requestsMade: number;
  boostsGiven: number;
  topSong: string;
};

export type RequesterContribution = UserProfile & {
  paidCents: number;
};

export type UserRequest = {
  id: string;
  title: string;
  artist: string;
  imageUri?: string;
  submittedAt: string;
  djName: string;
  venue: string;
  requestedAmountCents: number;
  totalCents: number;
  myContributionCents: number;
  status: "Pending" | "Open" | "Locked" | "Played" | "Canceled";
  canCancel: boolean;
};

export const activeSession = {
  id: 1,
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

export const userProfiles: UserProfile[] = [
  {
    id: "maya-chen",
    name: "Maya Chen",
    handle: "@mayaplays",
    imageUri: getUserImage("Maya Chen"),
    bio: "Dance-floor optimist with a soft spot for French house, big pop hooks, and songs everyone remembers at once.",
    neighborhood: "Williamsburg",
    favoriteGenres: ["French house", "Pop edits", "Disco"],
    requestsMade: 28,
    boostsGiven: 17,
    topSong: "One More Time",
  },
  {
    id: "jalen-brooks",
    name: "Jalen Brooks",
    handle: "@jalenafterdark",
    imageUri: getUserImage("Jalen Brooks"),
    bio: "Usually trying to bend the room toward indie-dance without losing the people who came for the chorus.",
    neighborhood: "Greenpoint",
    favoriteGenres: ["Indie dance", "Electroclash", "Remixes"],
    requestsMade: 19,
    boostsGiven: 11,
    topSong: "Heads Will Roll",
  },
  {
    id: "sofia-rivera",
    name: "Sofia Rivera",
    handle: "@sofiarqsts",
    imageUri: getUserImage("Sofia Rivera"),
    bio: "Pop-house loyalist, birthday-table coordinator, and reliable source of requests that turn into singalongs.",
    neighborhood: "Bushwick",
    favoriteGenres: ["Pop house", "R&B", "Club classics"],
    requestsMade: 34,
    boostsGiven: 22,
    topSong: "Break My Soul",
  },
  {
    id: "nico-park",
    name: "Nico Park",
    handle: "@nicoinline",
    imageUri: getUserImage("Nico Park"),
    bio: "Low-key curator for late-night requests, especially the ones that keep the room warm between peaks.",
    neighborhood: "Lower East Side",
    favoriteGenres: ["House", "UK garage", "Vocal dance"],
    requestsMade: 15,
    boostsGiven: 9,
    topSong: "Latch",
  },
  {
    id: "ava-patel",
    name: "Ava Patel",
    handle: "@avarequests",
    imageUri: getUserImage("Ava Patel"),
    bio: "Usually pooling the birthday table into one very persuasive dance-floor request.",
    neighborhood: "Williamsburg",
    favoriteGenres: ["Dance pop", "House", "Throwbacks"],
    requestsMade: 22,
    boostsGiven: 14,
    topSong: "Hung Up",
  },
  {
    id: "marcus-reed",
    name: "Marcus Reed",
    handle: "@marcusmoves",
    imageUri: getUserImage("Marcus Reed"),
    bio: "Likes records that make the room clap before the chorus arrives.",
    neighborhood: "Bed-Stuy",
    favoriteGenres: ["Disco", "Funk", "Club classics"],
    requestsMade: 12,
    boostsGiven: 8,
    topSong: "Get Lucky",
  },
  {
    id: "lena-ortiz",
    name: "Lena Ortiz",
    handle: "@lenaafterhours",
    imageUri: getUserImage("Lena Ortiz"),
    bio: "Late-night regular with a precise sense for when the room needs a pop reset.",
    neighborhood: "Bushwick",
    favoriteGenres: ["Pop", "R&B", "Vocal house"],
    requestsMade: 31,
    boostsGiven: 19,
    topSong: "Dance The Night",
  },
  {
    id: "owen-kim",
    name: "Owen Kim",
    handle: "@owenkicks",
    imageUri: getUserImage("Owen Kim"),
    bio: "Always looking for the request that gets strangers moving like they came together.",
    neighborhood: "Greenpoint",
    favoriteGenres: ["Electro", "Indie dance", "Remixes"],
    requestsMade: 17,
    boostsGiven: 13,
    topSong: "Levels",
  },
  {
    id: "tessa-cole",
    name: "Tessa Cole",
    handle: "@tessaturns",
    imageUri: getUserImage("Tessa Cole"),
    bio: "Pop edit enthusiast and dependable spark for the first big singalong.",
    neighborhood: "Lower East Side",
    favoriteGenres: ["Pop edits", "Disco", "House"],
    requestsMade: 26,
    boostsGiven: 16,
    topSong: "Levitating",
  },
  {
    id: "diego-santos",
    name: "Diego Santos",
    handle: "@diegodance",
    imageUri: getUserImage("Diego Santos"),
    bio: "Keeps one eye on the DJ and one eye on the friends deciding what to boost next.",
    neighborhood: "Williamsburg",
    favoriteGenres: ["Afrobeats", "House", "Latin pop"],
    requestsMade: 20,
    boostsGiven: 10,
    topSong: "Pepas",
  },
  {
    id: "riley-stone",
    name: "Riley Stone",
    handle: "@rileyrqst",
    imageUri: getUserImage("Riley Stone"),
    bio: "Quick with a shared request when the room is ready for something louder.",
    neighborhood: "Greenpoint",
    favoriteGenres: ["Electropop", "Dance rock", "Club hits"],
    requestsMade: 15,
    boostsGiven: 7,
    topSong: "Heads Will Roll",
  },
  {
    id: "mina-hart",
    name: "Mina Hart",
    handle: "@minamoves",
    imageUri: getUserImage("Mina Hart"),
    bio: "Knows exactly which chorus will turn a quiet pocket into a small scene.",
    neighborhood: "Bushwick",
    favoriteGenres: ["R&B", "Pop house", "Disco"],
    requestsMade: 24,
    boostsGiven: 18,
    topSong: "Break My Soul",
  },
];

function contribution(user: UserProfile, paidCents: number): RequesterContribution {
  return { ...user, paidCents };
}

export const nearbyVenues: RqstVenue[] = [
  {
    title: "Moonlight Room",
    subtitle: "DJ Solace is taking upbeat pop, house, and crossover throwbacks.",
    requestFloorCents: 700,
    distance: "0.2 mi away",
    energy: 0.93,
    latitude: 32.7812,
    longitude: -79.9316,
    imageUri: getVenueImage("Moonlight Room"),
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
    imageUri: getVenueImage("Velvet Radio"),
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
    imageUri: getVenueImage("Harbor Static"),
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
    contributors: 7,
    requestedBy: [
      contribution(userProfiles[0], 700),
      contribution(userProfiles[4], 600),
      contribution(userProfiles[5], 550),
      contribution(userProfiles[6], 500),
      contribution(userProfiles[7], 450),
      contribution(userProfiles[8], 425),
      contribution(userProfiles[10], 375),
    ],
    status: "Open",
    momentum: "Three people boosted this in the last 8 minutes.",
    imageUri: getSongImage("One More Time"),
    uploadedBy: userProfiles[0],
  },
  {
    id: "queue-2",
    rank: 2,
    title: "Heads Will Roll",
    artist: "Yeah Yeah Yeahs",
    totalCents: 2950,
    contributors: 3,
    requestedBy: [
      contribution(userProfiles[1], 1200),
      contribution(userProfiles[7], 950),
      contribution(userProfiles[10], 800),
    ],
    status: "Open",
    momentum: "Still climbing because the room is leaning indie-dance.",
    imageUri: getSongImage("Heads Will Roll"),
    uploadedBy: userProfiles[1],
  },
  {
    id: "queue-3",
    rank: 3,
    title: "Break My Soul",
    artist: "Beyonce",
    totalCents: 2400,
    contributors: 9,
    requestedBy: [
      contribution(userProfiles[2], 500),
      contribution(userProfiles[0], 350),
      contribution(userProfiles[4], 300),
      contribution(userProfiles[5], 275),
      contribution(userProfiles[6], 250),
      contribution(userProfiles[7], 225),
      contribution(userProfiles[8], 200),
      contribution(userProfiles[9], 175),
      contribution(userProfiles[11], 125),
    ],
    status: "Locked",
    momentum: "Locked while the DJ transitions out of the current run.",
    imageUri: getSongImage("Break My Soul"),
    uploadedBy: userProfiles[2],
  },
  {
    id: "queue-4",
    rank: 4,
    title: "Latch",
    artist: "Disclosure",
    totalCents: 1800,
    contributors: 1,
    requestedBy: [contribution(userProfiles[3], 1800)],
    status: "Open",
    momentum: "A lower total, but it matches the room really well tonight.",
    imageUri: getSongImage("Latch"),
    uploadedBy: userProfiles[3],
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
  { name: "DJ Solace", detail: "Pop house · Moonlight Room", tone: "gold" as const, imageUri: getDjImage("DJ Solace") },
  { name: "Mina Flux", detail: "Disco edits · Velvet Radio", tone: "mint" as const, imageUri: getDjImage("Mina Flux") },
  { name: "North Loop", detail: "Late rap set · Harbor Static", tone: "slate" as const, imageUri: getDjImage("North Loop") },
];

export const songLibrary = [
  { id: "song-1", title: "Hung Up", artist: "Madonna", imageUri: getSongImage("Hung Up") },
  { id: "song-2", title: "Dance The Night", artist: "Dua Lipa", imageUri: getSongImage("Dance The Night") },
  { id: "song-3", title: "Crazy In Love", artist: "Beyonce", imageUri: getSongImage("Crazy In Love") },
  { id: "song-4", title: "Call On Me", artist: "Eric Prydz", imageUri: unsplashImages.queueAccent },
  { id: "song-5", title: "Levitating", artist: "Dua Lipa", imageUri: unsplashImages.composer },
  { id: "song-6", title: "Get Lucky", artist: "Daft Punk", imageUri: unsplashImages.spotlightDj },
  { id: "song-7", title: "Party Rock Anthem", artist: "LMFAO", imageUri: unsplashImages.homeHero },
  { id: "song-8", title: "I Wanna Dance with Somebody", artist: "Whitney Houston", imageUri: unsplashImages.djPortrait },
];

export const initialUserRequests: UserRequest[] = [
  {
    id: "request-1",
    title: "Midnight City",
    artist: "M83",
    submittedAt: "2026-07-03T21:18:00-04:00",
    djName: "DJ Solace",
    venue: "Moonlight Room",
    requestedAmountCents: 900,
    totalCents: 1800,
    myContributionCents: 900,
    status: "Open",
    canCancel: false,
  },
  {
    id: "request-2",
    title: "Levels",
    artist: "Avicii",
    submittedAt: "2026-07-03T20:44:00-04:00",
    djName: "DJ Solace",
    venue: "Moonlight Room",
    requestedAmountCents: 1200,
    totalCents: 2600,
    myContributionCents: 1200,
    status: "Played",
    canCancel: false,
  },
  {
    id: "request-3",
    title: "Mirrors",
    artist: "Justin Timberlake",
    submittedAt: "2026-07-02T23:12:00-04:00",
    djName: "Mina Flux",
    venue: "Velvet Radio",
    requestedAmountCents: 600,
    totalCents: 1400,
    myContributionCents: 600,
    status: "Locked",
    canCancel: false,
  },
];

export const djProfile = {
  name: "DJ Solace",
  handle: "@djsolace",
  imageUri: getDjImage("DJ Solace"),
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
