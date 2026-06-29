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

