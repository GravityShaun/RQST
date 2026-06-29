export const currency = {
  code: "USD",
  locale: "en-US",
};

export const requestStatuses = {
  pending_payment: "Pending payment",
  open: "Open",
  locked: "Locked",
  confirmed_by_dj: "Confirmed",
  played: "Played",
  rejected: "Rejected",
  cancelled: "Cancelled",
  refunded: "Refunded",
  disputed: "Disputed",
  expired: "Expired",
} as const;

export const paymentStatuses = {
  payment_created: "Created",
  checkout_started: "Checkout started",
  payment_pending: "Pending",
  payment_authorized: "Authorized",
  payment_succeeded: "Succeeded",
  payment_failed: "Failed",
  payment_cancelled: "Cancelled",
  payment_refunded: "Refunded",
  payment_disputed: "Disputed",
} as const;

export const theme = {
  colors: {
    background: "#09070B",
    surface: "#16111A",
    elevated: "#231A29",
    border: "#34273C",
    text: "#F8F1FF",
    muted: "#BDAFCA",
    accent: "#FF5D5D",
    accentAlt: "#5EF2FF",
    success: "#5CE1A5",
    warning: "#F8D36B",
  },
  radii: {
    sm: 12,
    md: 18,
    lg: 28,
  },
} as const;

export const mobileTabs = ["Home", "Find", "List", "Requests", "Settings"] as const;
export const desktopPages = ["Home", "Requests", "Payments", "Profile", "Settings"] as const;

export function formatUsd(cents: number): string {
  return new Intl.NumberFormat(currency.locale, {
    style: "currency",
    currency: currency.code,
  }).format(cents / 100);
}

