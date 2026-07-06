export type UserRole = "listener" | "dj" | "admin";

export type RequestStatus =
  | "pending_payment"
  | "open"
  | "locked"
  | "confirmed_by_dj"
  | "played"
  | "rejected"
  | "cancelled"
  | "refunded"
  | "disputed"
  | "expired";

export type PaymentStatus =
  | "payment_created"
  | "checkout_started"
  | "payment_pending"
  | "payment_authorized"
  | "payment_succeeded"
  | "payment_failed"
  | "payment_cancelled"
  | "payment_refunded"
  | "payment_disputed";

export interface SessionSummary {
  id: number;
  djName: string;
  venueName: string;
  minimumRequestAmountCents: number;
  status: "live" | "paused" | "ended" | "not_started";
}

export interface QueueItem {
  id: number;
  rank: number;
  songTitle: string;
  artist: string;
  totalAmountCents: number;
  contributorCount: number;
  status: RequestStatus;
}

export interface RequestContributor {
  id: number;
  userId: number;
  displayName: string;
  avatarUrl?: string | null;
  amountCents: number;
  currency: string;
  isInitial: boolean;
  status: "pending_payment" | "succeeded" | "cancelled" | "refunded" | "disputed";
  createdAt: string;
}

export interface DjProfile {
  id: number;
  userId: number;
  artistName: string;
  slug: string;
  bio?: string | null;
  city?: string | null;
  genresJson: string[];
  isPublic: boolean;
}

export interface DjDiscoverProfile extends DjProfile {
  liveSessionId?: number | null;
  isLive: boolean;
  venueName?: string | null;
}

export interface VenueSummary {
  id: number;
  name: string;
  address: string;
  city: string;
  state?: string | null;
  country: string;
  latitude?: number | null;
  longitude?: number | null;
  placeId?: string | null;
}

export interface PlaceSearchResult {
  placeId: string;
  name: string;
  address: string;
  city: string;
  state?: string | null;
  country: string;
  latitude?: number | null;
  longitude?: number | null;
  displayName: string;
  source: "database" | "online";
  venueId?: number | null;
}

export interface DjEvent {
  id: number;
  djProfileId: number;
  name: string;
  description?: string | null;
  startsAt: string;
  endsAt?: string | null;
  ticketUrl?: string | null;
  flyerUrl?: string | null;
  venue: VenueSummary;
}

export interface UserProfile {
  id: number;
  email: string;
  displayName: string;
  avatarUrl?: string | null;
  role: UserRole;
  isEmailVerified: boolean;
}

export interface SongRequestSummary {
  id: number;
  sessionId: number;
  songId: number;
  requestedByUserId: number;
  status: RequestStatus;
  originalAmountCents: number;
  totalAmountCents: number;
  currency: string;
  note?: string | null;
  rankSnapshot?: number | null;
  confirmedByDjAt?: string | null;
  playedAt?: string | null;
  rejectedAt?: string | null;
  cancelledAt?: string | null;
  createdAt: string;
  updatedAt: string;
  songTitle?: string | null;
  songArtist?: string | null;
  songAlbum?: string | null;
  songAlbumArtUrl?: string | null;
  djProfileId?: number | null;
  djArtistName?: string | null;
  venueId?: number | null;
  venueName?: string | null;
  eventId?: number | null;
  requesterDisplayName?: string | null;
  requesterAvatarUrl?: string | null;
  myContributionCents: number;
  myOriginalContributionCents: number;
  myAddedContributionCents: number;
  totalPoolCents: number;
  poolOriginalCents: number;
  addedAmountCents: number;
  myAddedContributions: RequestContributor[];
  contributorCount: number;
  latestPaymentId?: number | null;
  latestPaymentStatus?: string | null;
  checkoutUrl?: string | null;
  contributors: RequestContributor[];
}
