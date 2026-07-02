export function useDashboardData() {
  return {
    stats: [
      { label: "Session status", value: "Live", hint: "Neon Room · Friday late set" },
      { label: "Earned tonight", value: "$286.00", hint: "Confirmed and available" },
      { label: "Pending pledge", value: "$144.00", hint: "Still waiting on DJ confirmation" },
    ],
    queue: [
      { rank: 1, title: "One More Time", artist: "Daft Punk", total: "$32.00", contributors: 4, status: "Open" },
      { rank: 2, title: "Heads Will Roll", artist: "Yeah Yeah Yeahs", total: "$28.00", contributors: 3, status: "Open" },
      { rank: 3, title: "Titanium", artist: "David Guetta", total: "$22.00", contributors: 2, status: "Locked" },
    ],
  };
}

