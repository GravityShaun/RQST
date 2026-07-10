from enum import StrEnum


class UserRole(StrEnum):
    LISTENER = "listener"
    DJ = "dj"
    ADMIN = "admin"


class SessionStatus(StrEnum):
    NOT_STARTED = "not_started"
    LIVE = "live"
    PAUSED = "paused"
    ENDED = "ended"


class RequestStatus(StrEnum):
    PENDING_PAYMENT = "pending_payment"
    OPEN = "open"
    LOCKED = "locked"
    CONFIRMED_BY_DJ = "confirmed_by_dj"
    PLAYED = "played"
    REJECTED = "rejected"
    CANCELLED = "cancelled"
    REFUNDED = "refunded"
    DISPUTED = "disputed"
    EXPIRED = "expired"


class ContributionStatus(StrEnum):
    PENDING_PAYMENT = "pending_payment"
    SUCCEEDED = "succeeded"
    CANCELLED = "cancelled"
    REFUNDED = "refunded"
    DISPUTED = "disputed"


class PaymentStatus(StrEnum):
    PAYMENT_CREATED = "payment_created"
    CHECKOUT_STARTED = "checkout_started"
    PAYMENT_PENDING = "payment_pending"
    PAYMENT_AUTHORIZED = "payment_authorized"
    PAYMENT_SUCCEEDED = "payment_succeeded"
    PAYMENT_FAILED = "payment_failed"
    PAYMENT_CANCELLED = "payment_cancelled"
    PAYMENT_REFUNDED = "payment_refunded"
    PAYMENT_DISPUTED = "payment_disputed"


class LedgerStatus(StrEnum):
    PENDING_CONFIRMATION = "pending_confirmation"
    AVAILABLE = "available"
    REVERSED = "reversed"
    ON_HOLD = "on_hold"
    PAID_OUT = "paid_out"


class TipStatus(StrEnum):
    PENDING_PAYMENT = "pending_payment"
    SUCCEEDED = "succeeded"
    THANKED = "thanked"
    CANCELLED = "cancelled"
    REFUNDED = "refunded"

