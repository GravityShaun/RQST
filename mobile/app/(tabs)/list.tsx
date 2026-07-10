import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, router, useLocalSearchParams, type Href } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Image, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View, type StyleProp, type ViewStyle } from "react-native";
import { formatUsd } from "@rqst/shared-config";
import { apiRouteBuilders, apiRoutes, type SongRequestSummary, type TipSummary } from "@rqst/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useIsFocused, useNavigation } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { usePremiumTheme, useResolvedColorScheme, useThemedStyles } from "../../src/store/theme";

import { ScreenShell, SectionTitle, SurfaceCard, Tag } from "../../src/components/premium-ui";
import { RequestCancelAction } from "../../src/components/RequestCancelAction";
import { DeadlineCountdown } from "../../src/components/PlayDeadline";
import { DirectorySearch } from "../../src/features/discover/DirectorySearch";
import { type QueueItem, type RequesterContribution } from "../../src/features/rqst/mock-data";
import { rqstApi, type ContributionCreatePayload, type TipCreatePayload } from "../../src/lib/rqst-api";
import { isActiveQueueStatus, isExpiredQueueStatus, isPlayedQueueStatus } from "../../src/lib/SessionQueueSync";
import { canCancelRequest, getPendingCancelExpiresAt } from "../../src/lib/request-cancel";
import { useRequestCancel } from "../../src/lib/use-request-cancel";
import { useActiveSession } from "../../src/lib/use-active-session";
import { useAuthStore } from "../../src/store/auth";
import { usePendingCancelStore } from "../../src/store/pending-cancel";
import { useToastStore } from "../../src/store/toast";
import { resolveAvatarUrl } from "../../src/lib/avatar";
import { unsplashImages } from "../../src/lib/unsplash";

const quickAmounts = [5, 10, 15, 20, 25, 50];
const listRefreshIntervalMs = 30_000;

const djGradientColors = {
  light: ["#FFD2C8", "#F4B8CF", "#E8D9FF"] as const,
  dark: ["#E05A47", "#D97BAE", "#8B6DD6"] as const,
};

const venueGradientColors = {
  light: ["#A8D4FF", "#7AB8A8", "#D9F3F0"] as const,
  dark: ["#6B9FD4", "#7AB8A8", "#5E78B8"] as const,
};

function resolveRequesterImageUri(avatarUrl?: string | null): string {
  return resolveAvatarUrl(avatarUrl) ?? unsplashImages.djPortrait;
}
type SortKey = "song" | "price" | "rqsts";
type SortDirection = "asc" | "desc";
type RequesterSortKey = "chronological" | "price";

function aggregateContributorsByUser(
  request: SongRequestSummary,
): RequesterContribution[] {
  const byUserId = new Map<string, RequesterContribution>();

  for (const contributor of request.contributors) {
    const userId = String(contributor.userId);
    const existing = byUserId.get(userId);

    if (existing) {
      existing.paidCents += contributor.amountCents;
      continue;
    }

    byUserId.set(userId, {
      id: userId,
      name: contributor.displayName,
      handle: `@${contributor.displayName.toLowerCase().replace(/[^a-z0-9]+/g, "") || "rqst"}`,
      imageUri: resolveRequesterImageUri(contributor.avatarUrl),
      bio: "",
      neighborhood: "",
      favoriteGenres: [],
      requestsMade: 0,
      boostsGiven: 0,
      topSong: request.songTitle ?? "Requested song",
      paidCents: contributor.amountCents,
    });
  }

  return Array.from(byUserId.values());
}

function isPlayedQueueItem(item: QueueItem) {
  return isPlayedQueueStatus(item.status as SongRequestSummary["status"]);
}

function isExpiredQueueItem(item: QueueItem) {
  return isExpiredQueueStatus(item.status as SongRequestSummary["status"]);
}

function isInactiveQueueItem(item: QueueItem) {
  return isPlayedQueueItem(item) || isExpiredQueueItem(item);
}

function sortQueueItems(items: QueueItem[], sortKey: SortKey, sortDirection: SortDirection) {
  return [...items].sort((left, right) => {
    const directionMultiplier = sortDirection === "asc" ? 1 : -1;
    const fallbackSort = left.rank - right.rank;
    let result = 0;

    if (sortKey === "song") {
      result = `${left.title} ${left.artist}`.localeCompare(`${right.title} ${right.artist}`);
    } else if (sortKey === "rqsts") {
      result = left.contributors - right.contributors;
    } else {
      result = left.totalCents - right.totalCents;
    }

    return result === 0 ? fallbackSort : result * directionMultiplier;
  });
}

function mapBackendQueueItem(request: SongRequestSummary, index: number): QueueItem {
  const mappedContributors = aggregateContributorsByUser(request);
  const fallbackRequester: RequesterContribution = {
    id: String(request.requestedByUserId),
    name: request.requesterDisplayName ?? "RQST listener",
    handle: "@rqst",
    imageUri: resolveRequesterImageUri(request.requesterAvatarUrl),
    bio: "",
    neighborhood: "",
    favoriteGenres: [],
    requestsMade: 0,
    boostsGiven: 0,
    topSong: request.songTitle ?? "Requested song",
    paidCents: request.originalAmountCents,
  };
  const requestedBy = mappedContributors.length ? mappedContributors : [fallbackRequester];
  const contributorCount = request.contributorCount || requestedBy.length;

  return {
    id: String(request.id),
    rank: index + 1,
    title: request.songTitle ?? `Song #${request.songId}`,
    artist: request.songArtist ?? "Unknown artist",
    totalCents: request.totalPoolCents ?? request.totalAmountCents ?? 0,
    contributors: contributorCount,
    requestedBy,
    status: request.status === "pending_payment" ? "Pending" : request.status === "open" ? "Open" : request.status,
    momentum: request.createdAt,
    playDeadlineExpiresAt: request.playDeadlineExpiresAt ?? null,
    imageUri: request.songAlbumArtUrl ?? undefined,
    uploadedBy:
      requestedBy[0] ??
      fallbackRequester,
  };
}

export default function ListScreen() {
  const theme = usePremiumTheme();
  const resolvedScheme = useResolvedColorScheme();
  const styles = useThemedStyles((activeTheme) =>
    StyleSheet.create({
actionColumn: {
    alignItems: "flex-end",
    marginLeft: 8,
    width: 34,
  },
  amountOption: {
    backgroundColor: activeTheme.colors.surface,
    borderColor: activeTheme.colors.border,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  amountOptionSelected: {
    backgroundColor: "#EAF2FF",
    borderColor: "#6A95FF",
  },
  amountOptionText: {
    color: activeTheme.colors.ink,
    fontFamily: activeTheme.fonts.display,
    fontSize: 20,
    fontWeight: "700",
  },
  amountOptionTextSelected: {
    color: "#2457D6",
  },
  amountSelector: {
    maxHeight: 280,
  },
  amountSelectorContent: {
    gap: 10,
    paddingRight: 4,
  },
  arrowButton: {
    alignItems: "center",
    backgroundColor: activeTheme.colors.surfaceElevated,
    borderColor: "#D98A84",
    borderRadius: 999,
    borderWidth: 1,
    height: 28,
    justifyContent: "center",
    width: 28,
  },
  arrowButtonDisabled: {
    opacity: 0.4,
  },
  playedLabel: {
    color: "#C95A52",
    fontSize: 9,
    fontWeight: "700",
    textAlign: "center",
  },
  playedRqstsCell: {
    color: activeTheme.colors.inkMuted,
  },
  playedSongArtist: {
    color: activeTheme.colors.inkMuted,
  },
  playedSongTitle: {
    color: activeTheme.colors.inkMuted,
  },
  playedSupportCell: {
    color: activeTheme.colors.inkMuted,
  },
  tableRowPlayed: {
    opacity: 0.55,
  },
  circleButton: {
    alignItems: "center",
    backgroundColor: activeTheme.colors.surfaceElevated,
    borderColor: activeTheme.colors.border,
    borderRadius: 24,
    borderWidth: 1,
    height: 48,
    justifyContent: "center",
    shadowColor: "#5B6474",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
    width: 48,
  },
  circleButtonLight: {
    backgroundColor: "#D94E3D",
  },
  circleButtonActive: {
    backgroundColor: activeTheme.colors.surfaceElevated,
    borderColor: "#E2AAB1",
  },
  customAmountInput: {
    backgroundColor: activeTheme.colors.surface,
    borderColor: activeTheme.colors.border,
    borderRadius: 18,
    borderWidth: 1,
    color: activeTheme.colors.ink,
    fontFamily: activeTheme.fonts.body,
    fontSize: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  customAmountLabel: {
    color: activeTheme.colors.inkMuted,
    fontFamily: activeTheme.fonts.body,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  customAmountWrap: {
    gap: 8,
    paddingTop: 8,
  },
  contentInset: {
    paddingHorizontal: 20,
  },
  contributionError: {
    color: "#B42318",
    fontFamily: activeTheme.fonts.body,
    fontSize: 13,
    textAlign: "center",
  },
  emptyRow: {
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 24,
    paddingVertical: 28,
  },
  emptySubtitle: {
    color: activeTheme.colors.inkMuted,
    fontFamily: activeTheme.fonts.body,
    fontSize: 13,
    textAlign: "center",
  },
  emptyTitle: {
    color: activeTheme.colors.ink,
    fontFamily: activeTheme.fonts.display,
    fontSize: 16,
    fontWeight: "800",
  },
  identityEyebrow: {
    color: activeTheme.colors.inkMuted,
    fontFamily: activeTheme.fonts.body,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  identityPanel: {
    flexDirection: "row",
    gap: 10,
  },
  identitySection: {
    gap: 0,
  },
  identityPillBorder: {
    borderRadius: 999,
    overflow: "hidden",
    padding: 1.5,
  },
  identityPillDj: {
    flex: 0.65,
  },
  identityPillInner: {
    backgroundColor: activeTheme.colors.surfaceElevated,
    borderRadius: 999,
    gap: 4,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  identityPillVenue: {
    flex: 0.35,
  },
  identityValue: {
    color: activeTheme.colors.ink,
    fontFamily: activeTheme.fonts.display,
    fontSize: 15,
    fontWeight: "700",
  },
  showSubtitle: {
    color: activeTheme.colors.inkMuted,
    fontFamily: activeTheme.fonts.body,
    fontSize: 11,
    fontWeight: "500",
    paddingHorizontal: 4,
    paddingTop: 10,
  },
  pickRoomButton: {
    alignItems: "center",
    backgroundColor: "#D94E3D",
    borderRadius: 999,
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  pickRoomButtonText: {
    color: "#FFFFFF",
    fontFamily: activeTheme.fonts.body,
    fontSize: 14,
    fontWeight: "800",
  },
  pickRoomCard: {
    marginTop: 8,
  },
  modalBackdrop: {
    backgroundColor: "rgba(30,23,23,0.4)",
    flex: 1,
    justifyContent: "flex-end",
    padding: 16,
  },
  modalCard: {
    backgroundColor: activeTheme.colors.surfaceElevated,
    borderRadius: 24,
    gap: 14,
    maxHeight: "88%",
    padding: 20,
  },
  modalCloseButton: {
    alignItems: "center",
    backgroundColor: activeTheme.colors.surface,
    borderRadius: 999,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  modalCopy: {
    flex: 1,
    gap: 2,
  },
  modalCta: {
    alignItems: "center",
    backgroundColor: "#D94E3D",
    borderRadius: 999,
    justifyContent: "center",
    paddingVertical: 16,
  },
  modalCtaDisabled: {
    opacity: 0.45,
  },
  modalCtaText: {
    color: activeTheme.colors.text,
    fontFamily: activeTheme.fonts.body,
    fontSize: 15,
    fontWeight: "800",
  },
  modalEyebrow: {
    color: activeTheme.colors.inkMuted,
    fontFamily: activeTheme.fonts.body,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  modalHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 12,
  },
  modalSubtitle: {
    color: activeTheme.colors.inkMuted,
    fontFamily: activeTheme.fonts.body,
    fontSize: 14,
  },
  modalTitle: {
    color: activeTheme.colors.ink,
    fontFamily: activeTheme.fonts.display,
    fontSize: 24,
    fontWeight: "800",
  },
  priceColumn: {
    alignItems: "flex-end",
    textAlign: "right",
    width: 54,
  },
  requesterAvatar: {
    backgroundColor: "#E8D9FF",
    borderColor: "#FFFFFF",
    borderRadius: 17,
    borderWidth: 2,
    height: 34,
    overflow: "hidden",
    width: 34,
  },
  requesterList: {
    gap: 10,
    paddingRight: 2,
  },
  requesterListAvatar: {
    borderRadius: 22,
    height: 44,
    width: 44,
  },
  requesterListAmount: {
    color: "#5E78B8",
    fontFamily: activeTheme.fonts.display,
    fontSize: 15,
    fontWeight: "800",
    textAlign: "right",
  },
  requesterListCopy: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  requesterListHandle: {
    color: activeTheme.colors.inkMuted,
    fontFamily: activeTheme.fonts.body,
    fontSize: 13,
  },
  requesterListItem: {
    alignItems: "center",
    backgroundColor: activeTheme.colors.surface,
    borderColor: activeTheme.colors.border,
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    padding: 12,
  },
  requesterListName: {
    color: activeTheme.colors.ink,
    fontFamily: activeTheme.fonts.display,
    fontSize: 15,
    fontWeight: "800",
  },
  requesterListScroll: {
    maxHeight: 480,
  },
  requesterSortControl: {
    alignSelf: "flex-start",
    backgroundColor: activeTheme.colors.surface,
    borderColor: activeTheme.colors.border,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    padding: 3,
  },
  requesterSortOption: {
    alignItems: "center",
    borderRadius: 9,
    flexDirection: "row",
    gap: 3,
    justifyContent: "center",
    minWidth: 82,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  requesterSortOptionActive: {
    backgroundColor: activeTheme.colors.surfaceElevated,
    shadowColor: activeTheme.colors.shadow,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
  },
  requesterSortText: {
    color: activeTheme.colors.inkMuted,
    fontFamily: activeTheme.fonts.body,
    fontSize: 10,
    fontWeight: "800",
  },
  requesterSortTextActive: {
    color: "#A3485B",
  },
  screenContent: {
    flexGrow: 1,
    paddingBottom: 0,
    paddingHorizontal: 0,
  },
  songArtist: {
    color: activeTheme.colors.inkMuted,
    fontFamily: activeTheme.fonts.body,
    fontSize: 12,
    marginTop: 2,
  },
  songColumn: {
    flex: 1,
    minWidth: 0,
    paddingRight: 4,
  },
  songTitle: {
    color: activeTheme.colors.ink,
    fontFamily: activeTheme.fonts.display,
    fontSize: 16,
    fontWeight: "700",
    lineHeight: 19,
  },
  rqstsCell: {
    color: "#A3485B",
    fontFamily: activeTheme.fonts.display,
    fontSize: 14,
    fontWeight: "800",
    minWidth: 14,
  },
  rqstsButton: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
    justifyContent: "flex-start",
    width: 72,
  },
  rqstsColumn: {
    alignItems: "flex-start",
    textAlign: "left",
    width: 72,
  },
  searchClearButton: {
    alignItems: "center",
    backgroundColor: activeTheme.colors.surface,
    borderRadius: 999,
    height: 30,
    justifyContent: "center",
    width: 30,
  },
  searchInput: {
    color: activeTheme.colors.ink,
    flex: 1,
    fontFamily: activeTheme.fonts.body,
    fontSize: 15,
    minWidth: 0,
    paddingVertical: 0,
  },
  searchPanel: {
    alignItems: "center",
    backgroundColor: activeTheme.colors.surfaceElevated,
    borderColor: activeTheme.colors.border,
    borderRadius: 22,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    shadowColor: "#5B6474",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
  },
  sortHeaderButton: {
    alignItems: "center",
    flexDirection: "row",
    gap: 2,
    justifyContent: "flex-end",
  },
  sortHeaderButtonLeft: {
    justifyContent: "flex-start",
  },
  supportCell: {
    color: "#5E78B8",
    fontSize: 13,
    fontWeight: "700",
  },
  table: {
    flexGrow: 1,
    width: "100%",
  },
  tableBodyDivider: {
    borderBottomColor: activeTheme.colors.border,
    borderBottomWidth: 1,
  },
  tableCard: {
    borderRadius: 22,
    flexGrow: 1,
    overflow: "hidden",
    padding: 0,
    shadowOpacity: 0.04,
  },
  tableCell: {
    color: activeTheme.colors.ink,
    fontFamily: activeTheme.fonts.body,
    fontSize: 14,
  },
  tableHeaderCell: {
    color: activeTheme.colors.inkMuted,
    fontFamily: activeTheme.fonts.body,
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  tableHeaderCellActive: {
    color: "#C95A52",
  },
  tableHeaderRow: {
    backgroundColor: "rgba(30,23,23,0.06)",
  },
  tableRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 14,
  },
  topBar: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  topBarLeft: {
    flexDirection: "row",
    gap: 12,
  },
    }),
  );

  const queryClient = useQueryClient();
  const navigation = useNavigation();
  const isScreenFocused = useIsFocused();
  const { sessionId, djName, venueName, djSlug, hasSession, isSessionLive, showLabel, activeEventId } = useActiveSession({
    requireSelection: true,
  });
  const isSignedIn = useAuthStore((state) => state.status === "authenticated" && Boolean(state.accessToken));
  const currentUserId = useAuthStore((state) => state.user?.id ?? null);
  const showToast = useToastStore((state) => state.showToast);
  const { cancelRequest } = useRequestCancel();
  const pendingExpiresById = usePendingCancelStore((state) => state.expiresByRequestId);
  const pruneExpiredPendingCancels = usePendingCancelStore((state) => state.pruneExpired);
  const [expiredCancelIds, setExpiredCancelIds] = useState<Set<number>>(() => new Set());
  const [selectedSongId, setSelectedSongId] = useState<string | null>(null);
  const [selectedRequesterSongId, setSelectedRequesterSongId] = useState<string | null>(null);
  const [selectedAmount, setSelectedAmount] = useState("10");
  const [customAmount, setCustomAmount] = useState("");
  const [isTipModalOpen, setIsTipModalOpen] = useState(false);
  const [tipSelectedAmount, setTipSelectedAmount] = useState("10");
  const [tipCustomAmount, setTipCustomAmount] = useState("");
  const [tipError, setTipError] = useState("");
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("price");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [requesterSortKey, setRequesterSortKey] = useState<RequesterSortKey>("chronological");
  const [requesterSortDirection, setRequesterSortDirection] = useState<SortDirection>("asc");
  const [contributionError, setContributionError] = useState("");
  const sessionRequestsQuery = useQuery({
    queryKey: ["sessionRequests", sessionId],
    queryFn: () =>
      rqstApi<SongRequestSummary[]>(apiRouteBuilders.sessionRequests(sessionId as number).replace("/api/v1", ""), {
        auth: false,
      }),
    enabled: sessionId != null,
    retry: false,
    staleTime: 0,
    gcTime: 0,
  });
  const sessionPlayedRequestsQuery = useQuery({
    queryKey: ["sessionPlayedRequests", sessionId],
    queryFn: () =>
      rqstApi<SongRequestSummary[]>(
        apiRouteBuilders.sessionPlayedRequests(sessionId as number).replace("/api/v1", ""),
        { auth: false },
      ),
    enabled: sessionId != null,
    retry: false,
    staleTime: 0,
    gcTime: 0,
  });
  const sessionExpiredRequestsQuery = useQuery({
    queryKey: ["sessionExpiredRequests", sessionId],
    queryFn: () =>
      rqstApi<SongRequestSummary[]>(
        apiRouteBuilders.sessionExpiredRequests(sessionId as number).replace("/api/v1", ""),
        { auth: false },
      ),
    enabled: sessionId != null,
    retry: false,
    staleTime: 0,
    gcTime: 0,
  });
  const contributeMutation = useMutation({
    mutationFn: ({ requestId, amountCents }: { requestId: string; amountCents: number }) =>
      rqstApi<SongRequestSummary>(apiRouteBuilders.contributeToRequest(requestId).replace("/api/v1", ""), {
        method: "POST",
        body: JSON.stringify({ amount_cents: amountCents } satisfies ContributionCreatePayload),
      }),
    onSuccess: (updatedRequest) => {
      queryClient.setQueryData<SongRequestSummary[]>(["sessionRequests", sessionId], (currentRequests = []) =>
        currentRequests.map((request) => (request.id === updatedRequest.id ? updatedRequest : request)),
      );
      queryClient.setQueryData<SongRequestSummary[]>(["meRequests"], (currentRequests = []) => {
        const existingIndex = currentRequests.findIndex((request) => request.id === updatedRequest.id);
        if (existingIndex === -1) {
          return [updatedRequest, ...currentRequests];
        }

        return currentRequests.map((request) => (request.id === updatedRequest.id ? updatedRequest : request));
      });
      queryClient.invalidateQueries({ queryKey: ["sessionRequests", sessionId] });
      queryClient.invalidateQueries({ queryKey: ["meRequests"] });
    },
    retry: false,
  });
  const tipMutation = useMutation({
    mutationFn: (amountCents: number) =>
      rqstApi<TipSummary>(apiRouteBuilders.sessionTips(sessionId as number).replace("/api/v1", ""), {
        method: "POST",
        body: JSON.stringify({ amount_cents: amountCents } satisfies TipCreatePayload),
      }),
    onSuccess: (tip) => {
      queryClient.invalidateQueries({ queryKey: ["sessionTips", sessionId] });
      queryClient.invalidateQueries({ queryKey: ["meTips"] });
      setIsTipModalOpen(false);
      setTipSelectedAmount("10");
      setTipCustomAmount("");
      setTipError("");
      showToast({
        title: "Tip sent",
        message: `${formatUsd(tip.amountCents)} went straight to ${djName ?? "the DJ"}.`,
        durationMs: 6_000,
      });
    },
    retry: false,
  });
  const sessionRequestsById = useMemo(
    () =>
      new Map(
        [...(sessionRequestsQuery.data ?? []), ...(sessionPlayedRequestsQuery.data ?? []), ...(sessionExpiredRequestsQuery.data ?? [])]
          .filter((request) => request.sessionId === sessionId)
          .map((request) => [request.id, request]),
      ),
    [sessionId, sessionExpiredRequestsQuery.data, sessionPlayedRequestsQuery.data, sessionRequestsQuery.data],
  );
  const queue = useMemo(() => {
    if (!hasSession || sessionId == null) {
      return [];
    }

    const activeRequests = (sessionRequestsQuery.data ?? []).filter(
      (request) =>
        request.sessionId === sessionId &&
        isActiveQueueStatus(request.status) &&
        (activeEventId == null || request.eventId === activeEventId),
    );
    const playedRequests = (sessionPlayedRequestsQuery.data ?? []).filter(
      (request) =>
        request.sessionId === sessionId &&
        isPlayedQueueStatus(request.status) &&
        (activeEventId == null || request.eventId === activeEventId),
    );
    const expiredRequests = (sessionExpiredRequestsQuery.data ?? []).filter(
      (request) =>
        request.sessionId === sessionId &&
        isExpiredQueueStatus(request.status) &&
        (activeEventId == null || request.eventId === activeEventId),
    );

    return [...activeRequests, ...playedRequests, ...expiredRequests].map((request, index) =>
      mapBackendQueueItem(request, index),
    );
  }, [
    activeEventId,
    hasSession,
    sessionId,
    sessionExpiredRequestsQuery.data,
    sessionPlayedRequestsQuery.data,
    sessionRequestsQuery.data,
  ]);

  const sortedQueue = useMemo(() => {
    const activeItems = queue.filter((item) => !isInactiveQueueItem(item));
    const playedItems = queue.filter((item) => isPlayedQueueItem(item));
    const expiredItems = queue.filter((item) => isExpiredQueueItem(item));

    return [
      ...sortQueueItems(activeItems, sortKey, sortDirection),
      ...sortQueueItems(playedItems, "price", "desc"),
      ...sortQueueItems(expiredItems, "price", "desc"),
    ];
  }, [queue, sortDirection, sortKey]);

  useEffect(() => {
    if (isScreenFocused) {
      return;
    }

    setSortKey("price");
    setSortDirection("desc");
  }, [isScreenFocused]);

  useEffect(() => {
    pruneExpiredPendingCancels();
    const interval = setInterval(() => {
      pruneExpiredPendingCancels();
    }, 1000);

    return () => clearInterval(interval);
  }, [pruneExpiredPendingCancels]);

  const refreshSessionQueue = useCallback(async () => {
    if (sessionId == null) {
      return;
    }

    await Promise.all([
      queryClient.refetchQueries({ queryKey: ["sessionRequests", sessionId] }),
      queryClient.refetchQueries({ queryKey: ["sessionPlayedRequests", sessionId] }),
      queryClient.refetchQueries({ queryKey: ["sessionExpiredRequests", sessionId] }),
    ]);
  }, [queryClient, sessionId]);

  useEffect(() => {
    if (!isScreenFocused || sessionId == null) {
      return;
    }

    void refreshSessionQueue();
  }, [isScreenFocused, refreshSessionQueue, sessionId]);

  useEffect(() => {
    setSelectedSongId(null);
    setSelectedRequesterSongId(null);
    setContributionError("");
    if (sessionId != null) {
      queryClient.setQueryData(["sessionRequests", sessionId], []);
      queryClient.setQueryData(["sessionPlayedRequests", sessionId], []);
      queryClient.setQueryData(["sessionExpiredRequests", sessionId], []);
      queryClient.removeQueries({
        queryKey: ["sessionRequests"],
        predicate: (query) => query.queryKey[1] !== sessionId,
      });
      queryClient.removeQueries({
        queryKey: ["sessionPlayedRequests"],
        predicate: (query) => query.queryKey[1] !== sessionId,
      });
      queryClient.removeQueries({
        queryKey: ["sessionExpiredRequests"],
        predicate: (query) => query.queryKey[1] !== sessionId,
      });
    }
  }, [queryClient, sessionId]);

  useEffect(() => {
    if (!isScreenFocused || sessionId == null) {
      return undefined;
    }

    const interval = setInterval(() => {
      void refreshSessionQueue();
    }, listRefreshIntervalMs);

    return () => clearInterval(interval);
  }, [isScreenFocused, refreshSessionQueue, sessionId]);

  useEffect(() => {
    const unsubscribe = navigation.addListener("tabPress", () => {
      if (sessionId != null) {
        void refreshSessionQueue();
      }
    });

    return unsubscribe;
  }, [navigation, refreshSessionQueue, sessionId]);

  const selectedSong = queue.find((item) => item.id === selectedSongId) ?? null;
  const selectedRequesterSong = queue.find((item) => item.id === selectedRequesterSongId) ?? null;
  const selectedRequesterList = useMemo(() => {
    const requesters = selectedRequesterSong?.requestedBy ?? [];

    if (requesterSortKey === "price") {
      return [...requesters].sort((left, right) =>
        requesterSortDirection === "asc" ? left.paidCents - right.paidCents : right.paidCents - left.paidCents,
      );
    }

    return requesterSortDirection === "asc" ? requesters : [...requesters].reverse();
  }, [requesterSortDirection, requesterSortKey, selectedRequesterSong]);
  const modalAmountDollars = customAmount ? Number(customAmount || 0) : Number(selectedAmount || 0);
  const modalAmountCents = Math.max(Number.isFinite(modalAmountDollars) ? modalAmountDollars : 0, 0) * 100;
  const tipAmountDollars = tipCustomAmount ? Number(tipCustomAmount || 0) : Number(tipSelectedAmount || 0);
  const tipAmountCents = Math.max(Number.isFinite(tipAmountDollars) ? tipAmountDollars : 0, 0) * 100;
  const canSubmitContribution =
    isSessionLive && Boolean(selectedSong) && selectedSong?.status === "Open" && modalAmountCents > 0;
  const canSubmitTip = hasSession && isSessionLive && tipAmountCents > 0;
  const openTipModal = () => {
    if (!hasSession) {
      setIsPickerOpen(true);
      return;
    }
    setTipError("");
    setTipSelectedAmount("10");
    setTipCustomAmount("");
    setIsTipModalOpen(true);
  };
  const handleSubmitTip = async () => {
    if (!canSubmitTip || sessionId == null) {
      return;
    }

    setTipError("");
    if (!isSignedIn) {
      setTipError("Sign in is required to tip the DJ.");
      router.push("/(auth)/login");
      return;
    }

    try {
      await tipMutation.mutateAsync(tipAmountCents);
    } catch (error) {
      setTipError(error instanceof Error ? error.message : "Could not send this tip. Please try again.");
    }
  };
  const handleSubmitContribution = async () => {
    if (!selectedSong || !canSubmitContribution) {
      return;
    }

    setContributionError("");
    const numericRequestId = Number(selectedSong.id);
    const isBackendRequest = Number.isInteger(numericRequestId);

    if (isBackendRequest) {
      if (!isSignedIn) {
        setContributionError("Sign in is required to add money to this song.");
        router.push("/(auth)/login");
        return;
      }

      try {
        await contributeMutation.mutateAsync({ requestId: selectedSong.id, amountCents: modalAmountCents });
        setSelectedSongId(null);
        setSelectedAmount("10");
        setCustomAmount("");
        return;
      } catch (error) {
        setContributionError(
          error instanceof Error ? error.message : "Could not add money to this song. Please try again.",
        );
        return;
      }
    }

    setContributionError("This song is no longer in the live queue.");
  };
  const openProfile = (requester: RequesterContribution) => {
    router.push({
      pathname: "/profile/[id]",
      params: {
        id: requester.id,
        name: requester.name,
        handle: requester.handle,
        imageUri: requester.imageUri,
        bio: requester.bio || "",
        neighborhood: requester.neighborhood || "",
        topSong: requester.topSong || "",
        requestsMade: String(requester.requestsMade ?? 0),
        boostsGiven: String(requester.boostsGiven ?? 0),
      },
    } as Href);
  };
  const openRequesters = (itemId: string) => {
    const item = queue.find((queueItem) => queueItem.id === itemId);
    if (!item) {
      return;
    }

    const requesters = item.requestedBy;
    if (requesters.length === 0) {
      return;
    }

    if (requesters.length === 1) {
      openProfile(requesters[0]);
      return;
    }

    setRequesterSortKey("chronological");
    setRequesterSortDirection("asc");
    setSelectedRequesterSongId(item.id);
  };
  const sortIconName = (key: SortKey) => {
    if (sortKey !== key) {
      return "swap-vertical-outline";
    }

    return sortDirection === "asc" ? "chevron-up" : "chevron-down";
  };
  const changeSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection((currentDirection) => (currentDirection === "asc" ? "desc" : "asc"));
      return;
    }

    setSortKey(key);
    setSortDirection(key === "song" ? "asc" : "desc");
  };
  const changeRequesterSort = (key: RequesterSortKey) => {
    if (requesterSortKey === key) {
      setRequesterSortDirection((currentDirection) => (currentDirection === "asc" ? "desc" : "asc"));
      return;
    }

    setRequesterSortKey(key);
    setRequesterSortDirection(key === "chronological" ? "asc" : "desc");
  };
  const requesterSortIconName = (key: RequesterSortKey) => {
    if (requesterSortKey !== key) {
      return "swap-vertical-outline";
    }

    return requesterSortDirection === "asc" ? "chevron-up" : "chevron-down";
  };
  const renderSortableHeader = (label: string, key: SortKey, style?: StyleProp<ViewStyle>) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Sort by ${label}`}
      onPress={() => changeSort(key)}
      style={[
        styles.sortHeaderButton,
        (key === "rqsts" || key === "song") && styles.sortHeaderButtonLeft,
        style,
      ]}
    >
      <Text style={[styles.tableHeaderCell, sortKey === key && styles.tableHeaderCellActive]}>{label}</Text>
      {key !== "rqsts" ? (
        <Ionicons
          name={sortIconName(key)}
          size={12}
          color={sortKey === key ? "#C95A52" : theme.colors.inkMuted}
        />
      ) : null}
    </Pressable>
  );

  return (
    <ScreenShell
      contentContainerStyle={styles.screenContent}
      refreshControl={
        <RefreshControl
          refreshing={
            sessionRequestsQuery.isRefetching ||
            sessionPlayedRequestsQuery.isRefetching ||
            sessionExpiredRequestsQuery.isRefetching
          }
          onRefresh={() => {
            void refreshSessionQueue();
          }}
          tintColor="#C95A52"
        />
      }
    >
      <View style={styles.contentInset}>
        <View style={styles.topBar}>
          <View style={styles.topBarLeft}>
            <Pressable
              accessibilityLabel="Tip the DJ"
              accessibilityRole="button"
              onPress={openTipModal}
              style={[styles.circleButton, styles.circleButtonLight]}
            >
              <Ionicons name="heart" size={20} color="#FFFFFF" />
            </Pressable>
            <Pressable
              accessibilityLabel="Find a DJ or venue"
              accessibilityRole="button"
              onPress={() => setIsPickerOpen((currentValue) => !currentValue)}
              style={[styles.circleButton, (isPickerOpen || !hasSession) && styles.circleButtonActive]}
            >
              <Ionicons name="search" size={20} color={theme.colors.ink} />
            </Pressable>
          </View>
          <Tag
            label={hasSession ? (venueName ?? "Live venue") : "Pick a room"}
            tone="gold"
            icon="location-outline"
          />
        </View>
      </View>

      {isPickerOpen ? (
        <View style={styles.contentInset}>
          <DirectorySearch
            defaultViewMode="browse"
            hideDjActions
            liveOnly
            selectOnly
            onLiveSessionSelected={() => setIsPickerOpen(false)}
          />
        </View>
      ) : null}

      {hasSession ? (
        <>
          <View style={styles.contentInset}>
            <View style={styles.identitySection}>
              <Link href={(djSlug ? `/dj?slug=${encodeURIComponent(djSlug)}` : "/dj") as Href} asChild>
                <Pressable style={styles.identityPanel}>
                  <LinearGradient
                    colors={[...djGradientColors[resolvedScheme]]}
                    end={{ x: 1, y: 1 }}
                    start={{ x: 0, y: 0 }}
                    style={[styles.identityPillBorder, styles.identityPillDj]}
                  >
                    <View style={styles.identityPillInner}>
                      <Text style={styles.identityEyebrow}>DJ playing</Text>
                      <Text numberOfLines={1} style={styles.identityValue}>
                        {djName}
                      </Text>
                    </View>
                  </LinearGradient>
                  <LinearGradient
                    colors={[...venueGradientColors[resolvedScheme]]}
                    end={{ x: 1, y: 1 }}
                    start={{ x: 0, y: 0 }}
                    style={[styles.identityPillBorder, styles.identityPillVenue]}
                  >
                    <View style={styles.identityPillInner}>
                      <Text style={styles.identityEyebrow}>Venue</Text>
                      <Text numberOfLines={1} style={styles.identityValue}>
                        {venueName}
                      </Text>
                    </View>
                  </LinearGradient>
                </Pressable>
              </Link>
              {showLabel ? (
                <Text numberOfLines={1} style={styles.showSubtitle}>
                  {showLabel}
                </Text>
              ) : null}
            </View>
          </View>

          <View style={styles.contentInset}>
            <SectionTitle
              title="Requested songs"
              subtitle="The artist or DJ can choose to play each of the requested songs."
            />
          </View>

          <SurfaceCard style={styles.tableCard}>
            <View style={styles.table}>
              <View style={[styles.tableRow, styles.tableHeaderRow]}>
                {renderSortableHeader("Rqsts", "rqsts", styles.rqstsColumn)}
                {renderSortableHeader("Song", "song", styles.songColumn)}
                {renderSortableHeader("Price", "price", styles.priceColumn)}
                <Text style={[styles.tableHeaderCell, styles.actionColumn]}> </Text>
              </View>

              {sortedQueue.map((item) => {
                const isPlayed = isPlayedQueueItem(item);
                const isExpired = isExpiredQueueItem(item);
                const isInactive = isInactiveQueueItem(item);
                const backendRequest = sessionRequestsById.get(Number(item.id));
                const cancelExpiresAt =
                  backendRequest && !expiredCancelIds.has(backendRequest.id)
                    ? getPendingCancelExpiresAt(backendRequest.id, pendingExpiresById)
                    : null;
                const showCancelAction =
                  !isInactive &&
                  backendRequest != null &&
                  cancelExpiresAt != null &&
                  canCancelRequest(backendRequest, currentUserId, pendingExpiresById);
                const canContribute = isSessionLive && !isInactive;
                const showDeadlineCountdown =
                  !isInactive && item.playDeadlineExpiresAt && item.status !== "Pending";

                return (
                  <View
                    key={item.id}
                    style={[styles.tableRow, styles.tableBodyDivider, isInactive && styles.tableRowPlayed]}
                  >
                  <Pressable
                    accessibilityLabel={
                      item.requestedBy.length === 1
                        ? `Open ${item.requestedBy[0].name}'s profile`
                        : `Show ${item.requestedBy.length} requesters for ${item.title}`
                    }
                    accessibilityRole="button"
                    hitSlop={8}
                    onPress={() => openRequesters(item.id)}
                    style={styles.rqstsButton}
                  >
                    <Text style={[styles.rqstsCell, isInactive && styles.playedRqstsCell]}>{item.contributors}</Text>
                    <Image
                      resizeMode="cover"
                      source={{ uri: item.requestedBy[0]?.imageUri ?? item.uploadedBy.imageUri }}
                      style={styles.requesterAvatar}
                    />
                  </Pressable>
                  <View style={styles.songColumn}>
                    <Text style={[styles.songTitle, isInactive && styles.playedSongTitle]}>
                      {item.title}
                    </Text>
                    <Text style={[styles.songArtist, isInactive && styles.playedSongArtist]} numberOfLines={1}>
                      {item.artist}
                    </Text>
                    {showDeadlineCountdown && item.playDeadlineExpiresAt ? (
                      <DeadlineCountdown expiresAt={item.playDeadlineExpiresAt} variant="badge" />
                    ) : null}
                    {isExpired ? (
                      <Text style={{ color: "#B42318", fontSize: 11, fontWeight: "700", marginTop: 2 }}>
                        Timed out
                      </Text>
                    ) : null}
                    {showCancelAction && cancelExpiresAt != null ? (
                      <RequestCancelAction
                        expiresAt={cancelExpiresAt}
                        onCancel={cancelRequest}
                        onExpired={() => {
                          setExpiredCancelIds((currentIds) => {
                            const nextIds = new Set(currentIds);
                            nextIds.add(backendRequest.id);
                            return nextIds;
                          });
                        }}
                        requestId={backendRequest.id}
                        variant="inline"
                      />
                    ) : null}
                  </View>
                  <Text
                    style={[
                      styles.tableCell,
                      styles.priceColumn,
                      styles.supportCell,
                      isInactive && styles.playedSupportCell,
                    ]}
                  >
                    {formatUsd(item.totalCents)}
                  </Text>
                  <View style={styles.actionColumn}>
                    {isPlayed ? (
                      <Text style={styles.playedLabel}>played</Text>
                    ) : (
                      <Pressable
                        disabled={!canContribute}
                        onPress={() => {
                          if (!canContribute) {
                            return;
                          }

                          setContributionError("");
                          setSelectedSongId(item.id);
                          setSelectedAmount("10");
                          setCustomAmount("");
                        }}
                        style={[styles.arrowButton, !canContribute && styles.arrowButtonDisabled]}
                      >
                        <Ionicons name="arrow-up" size={13} color="#C95A52" />
                      </Pressable>
                    )}
                  </View>
                  </View>
                );
              })}
              {sortedQueue.length === 0 ? (
                <View style={styles.emptyRow}>
                  <Text style={styles.emptyTitle}>No songs in the queue yet</Text>
                  <Text style={styles.emptySubtitle}>Be the first song request in queue for this set.</Text>
                </View>
              ) : null}
            </View>
          </SurfaceCard>
        </>
      ) : !isPickerOpen ? (
        <View style={styles.contentInset}>
          <SurfaceCard style={styles.pickRoomCard}>
            <View style={styles.emptyRow}>
              <Ionicons name="search-outline" size={32} color={theme.colors.inkMuted} />
              <Text style={styles.emptyTitle}>Find a live room</Text>
              <Text style={styles.emptySubtitle}>
                Tap the search icon above to browse DJs and venues, then open a live list.
              </Text>
              <Pressable
                accessibilityLabel="Browse DJs and venues"
                accessibilityRole="button"
                onPress={() => setIsPickerOpen(true)}
                style={styles.pickRoomButton}
              >
                <Ionicons name="musical-notes-outline" size={16} color="#FFFFFF" />
                <Text style={styles.pickRoomButtonText}>Browse DJs & venues</Text>
              </Pressable>
            </View>
          </SurfaceCard>
        </View>
      ) : null}

      <Modal animationType="slide" transparent visible={Boolean(selectedSong)} onRequestClose={() => setSelectedSongId(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={styles.modalCopy}>
                <Text style={styles.modalEyebrow}>Add to this song</Text>
                <Text style={styles.modalTitle}>{selectedSong?.title}</Text>
                <Text style={styles.modalSubtitle}>{selectedSong?.artist}</Text>
              </View>
              <Pressable onPress={() => setSelectedSongId(null)} style={styles.modalCloseButton}>
                <Ionicons name="close" size={18} color={theme.colors.ink} />
              </Pressable>
            </View>

            <ScrollView
              style={styles.amountSelector}
              contentContainerStyle={styles.amountSelectorContent}
              showsVerticalScrollIndicator={false}
            >
              {quickAmounts.map((amount) => {
                const isSelected = selectedAmount === String(amount) && !customAmount;

                return (
                  <Pressable
                    key={amount}
                    onPress={() => {
                      setSelectedAmount(String(amount));
                      setCustomAmount("");
                    }}
                    style={[styles.amountOption, isSelected && styles.amountOptionSelected]}
                  >
                    <Text style={[styles.amountOptionText, isSelected && styles.amountOptionTextSelected]}>{`$${amount}`}</Text>
                  </Pressable>
                );
              })}

              <View style={styles.customAmountWrap}>
                <Text style={styles.customAmountLabel}>Custom amount</Text>
                <TextInput
                  keyboardType="numeric"
                  onChangeText={(text) => {
                    setCustomAmount(text);
                    setSelectedAmount("");
                  }}
                  placeholder="Enter amount"
                  placeholderTextColor={theme.colors.inkMuted}
                  style={styles.customAmountInput}
                  value={customAmount}
                />
              </View>
            </ScrollView>

            {contributionError ? <Text style={styles.contributionError}>{contributionError}</Text> : null}

            <Pressable
              disabled={!canSubmitContribution || contributeMutation.isPending}
              onPress={handleSubmitContribution}
              style={[styles.modalCta, (!canSubmitContribution || contributeMutation.isPending) && styles.modalCtaDisabled]}
            >
              <Text style={styles.modalCtaText}>
                {contributeMutation.isPending ? "Adding" : `Add ${formatUsd(modalAmountCents)}`}
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal
        animationType="slide"
        transparent
        visible={isTipModalOpen}
        onRequestClose={() => setIsTipModalOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={styles.modalCopy}>
                <Text style={styles.modalEyebrow}>Tip the DJ</Text>
                <Text style={styles.modalTitle}>{djName ?? "DJ"}</Text>
                <Text style={styles.modalSubtitle}>
                  Send a tip for a great set. It goes straight to their account.
                </Text>
              </View>
              <Pressable onPress={() => setIsTipModalOpen(false)} style={styles.modalCloseButton}>
                <Ionicons name="close" size={18} color={theme.colors.ink} />
              </Pressable>
            </View>

            <ScrollView
              style={styles.amountSelector}
              contentContainerStyle={styles.amountSelectorContent}
              showsVerticalScrollIndicator={false}
            >
              {quickAmounts.map((amount) => {
                const isSelected = tipSelectedAmount === String(amount) && !tipCustomAmount;

                return (
                  <Pressable
                    key={amount}
                    onPress={() => {
                      setTipSelectedAmount(String(amount));
                      setTipCustomAmount("");
                    }}
                    style={[styles.amountOption, isSelected && styles.amountOptionSelected]}
                  >
                    <Text style={[styles.amountOptionText, isSelected && styles.amountOptionTextSelected]}>{`$${amount}`}</Text>
                  </Pressable>
                );
              })}

              <View style={styles.customAmountWrap}>
                <Text style={styles.customAmountLabel}>Custom amount</Text>
                <TextInput
                  keyboardType="numeric"
                  onChangeText={(text) => {
                    setTipCustomAmount(text);
                    setTipSelectedAmount("");
                  }}
                  placeholder="Enter amount"
                  placeholderTextColor={theme.colors.inkMuted}
                  style={styles.customAmountInput}
                  value={tipCustomAmount}
                />
              </View>
            </ScrollView>

            {tipError ? <Text style={styles.contributionError}>{tipError}</Text> : null}

            <Pressable
              disabled={!canSubmitTip || tipMutation.isPending}
              onPress={() => {
                void handleSubmitTip();
              }}
              style={[styles.modalCta, (!canSubmitTip || tipMutation.isPending) && styles.modalCtaDisabled]}
            >
              <Text style={styles.modalCtaText}>
                {tipMutation.isPending ? "Sending tip" : `Tip ${formatUsd(tipAmountCents)}`}
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal
        animationType="slide"
        transparent
        visible={Boolean(selectedRequesterSong)}
        onRequestClose={() => setSelectedRequesterSongId(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={styles.modalCopy}>
                <Text style={styles.modalEyebrow}>Requested by</Text>
                <Text style={styles.modalTitle}>{selectedRequesterSong?.title}</Text>
                <Text style={styles.modalSubtitle}>
                  {selectedRequesterSong?.contributors ?? 0} paid rqsts
                </Text>
              </View>
              <Pressable onPress={() => setSelectedRequesterSongId(null)} style={styles.modalCloseButton}>
                <Ionicons name="close" size={18} color={theme.colors.ink} />
              </Pressable>
            </View>

            <View style={styles.requesterSortControl}>
              <Pressable
                accessibilityRole="button"
                onPress={() => changeRequesterSort("chronological")}
                style={[
                  styles.requesterSortOption,
                  requesterSortKey === "chronological" && styles.requesterSortOptionActive,
                ]}
              >
                <Text
                  style={[
                    styles.requesterSortText,
                    requesterSortKey === "chronological" && styles.requesterSortTextActive,
                  ]}
                >
                  Chronological
                </Text>
                <Ionicons
                  name={requesterSortIconName("chronological")}
                  size={10}
                  color={requesterSortKey === "chronological" ? "#A3485B" : theme.colors.inkMuted}
                />
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={() => changeRequesterSort("price")}
                style={[
                  styles.requesterSortOption,
                  requesterSortKey === "price" && styles.requesterSortOptionActive,
                ]}
              >
                <Text
                  style={[
                    styles.requesterSortText,
                    requesterSortKey === "price" && styles.requesterSortTextActive,
                  ]}
                >
                  Price
                </Text>
                <Ionicons
                  name={requesterSortIconName("price")}
                  size={10}
                  color={requesterSortKey === "price" ? "#A3485B" : theme.colors.inkMuted}
                />
              </Pressable>
            </View>

            <ScrollView
              indicatorStyle="black"
              persistentScrollbar
              style={styles.requesterListScroll}
              contentContainerStyle={styles.requesterList}
              showsVerticalScrollIndicator
            >
              {selectedRequesterList.map((requester) => (
                <Pressable
                  key={requester.id}
                  onPress={() => {
                    setSelectedRequesterSongId(null);
                    openProfile(requester);
                  }}
                  style={styles.requesterListItem}
                >
                  <Image source={{ uri: requester.imageUri }} style={styles.requesterListAvatar} />
                  <View style={styles.requesterListCopy}>
                    <Text style={styles.requesterListName}>{requester.name}</Text>
                    <Text style={styles.requesterListHandle}>{requester.handle}</Text>
                  </View>
                  <Text style={styles.requesterListAmount}>{formatUsd(requester.paidCents)}</Text>
                  <Ionicons name="chevron-forward" size={18} color={theme.colors.inkMuted} />
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScreenShell>
  );
}
