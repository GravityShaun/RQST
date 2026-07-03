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
  status: "pending_payment" | "succeeded" | "cancelled" | "refunded" | "disputed";
  createdAt: string;
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
  contributorCount: number;
  latestPaymentId?: number | null;
  latestPaymentStatus?: string | null;
  checkoutUrl?: string | null;
  contributors: RequestContributor[];
}
