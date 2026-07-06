import { startTransition, useDeferredValue, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Animated, Easing, Image, Modal, PanResponder, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { formatUsd } from "@rqst/shared-config";
import { apiRouteBuilders, apiRoutes, type SongRequestSummary } from "@rqst/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useIsFocused, useNavigation } from "@react-navigation/native";
import { router } from "expo-router";

import { GrainyGradientBackground } from "../../src/components/grainy-gradient/GrainyGradient";
import { RequestCancelAction } from "../../src/components/RequestCancelAction";
import { ScreenShell, SectionTitle, SurfaceCard, Tag, premiumTheme } from "../../src/components/premium-ui";
import { DirectorySearch } from "../../src/features/discover/DirectorySearch";
import { activeSession as mockActiveSession, initialUserRequests, songLibrary, type UserAddedContribution, type UserRequest } from "../../src/features/rqst/mock-data";
import {
  apiBaseUrl,
  rqstApi,
  type ContributionCreatePayload,
  type RequestCreatePayload,
} from "../../src/lib/rqst-api";
import { canCancelRequest, getPendingCancelExpiresAt } from "../../src/lib/request-cancel";
import { useRequestCancel } from "../../src/lib/use-request-cancel";
import { useActiveSession } from "../../src/lib/use-active-session";
import { useAuthStore } from "../../src/store/auth";
import { isActiveQueueStatus } from "../../src/lib/SessionQueueSync";
import { usePendingCancelStore } from "../../src/store/pending-cancel";
import { unsplashImages } from "../../src/lib/unsplash";

const quickAmounts = ["5", "10", "15"] as const;
const customAmountValue = "custom";
const siteGradientColors = ["#FFD2C8", "#F4B8CF", "#E8D9FF"] as const;
const siteThemeBlue = "#2F5FBE";
const shoutoutQuickAmounts = ["3", "5", "10"] as const;
const shoutoutCustomAmountValue = "custom";
const rqstModeTabs = ["search", "requested"] as const;
const requestTabs = ["queued", "played"] as const;
const drawerClosedOffset = 760;
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
type SearchSong = {
  result_type?: "song";
  id: number | string;
  title: string;
  artist: string;
  album?: string | null;
  imageUri?: string | null;
  album_art_url?: string | null;
  duration_ms?: number | null;
  isrc?: string | null;
  external_source?: string;
  external_id?: string | null;
  explicit?: boolean;
  popularity_score?: number;
};

type SearchArtist = {
  result_type: "artist";
  id: string;
  name: string;
  image_url?: string | null;
  disambiguation?: string | null;
  country?: string | null;
  artist_type?: string | null;
  external_source?: string;
};

type SearchResult = SearchSong | SearchArtist;
type RqstModeTab = (typeof rqstModeTabs)[number];
type RequestTab = (typeof requestTabs)[number];
type ContributionDraft = {
  requestId: string;
  amountCents: number;
  isCustom: boolean;
};

function isSongResult(result: SearchResult): result is SearchSong {
  return result.result_type !== "artist";
}

function isArtistResult(result: SearchResult): result is SearchArtist {
  return result.result_type === "artist";
}

function getSongImageUri(song: SearchSong) {
  return song.imageUri ?? song.album_art_url ?? unsplashImages.queueAccent;
}

function normalizeSearchValue(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function dropLeadingArticle(value: string) {
  return value.replace(/^the\s+/, "");
}

function getSearchScore(queryValue: string, targetValue: string) {
  const query = normalizeSearchValue(queryValue);
  const target = normalizeSearchValue(targetValue);
  const canonicalQuery = dropLeadingArticle(query);
  const canonicalTarget = dropLeadingArticle(target);

  if (!query) {
    return 1;
  }

  if (target === query) {
    return 120;
  }

  if (canonicalTarget === canonicalQuery) {
    return 110;
  }

  if (target.startsWith(query)) {
    return 90;
  }

  if (canonicalTarget.startsWith(canonicalQuery)) {
    return 82;
  }

  if (target.includes(query)) {
    return 64;
  }

  if (canonicalQuery && canonicalTarget.includes(canonicalQuery)) {
    return 56;
  }

  return query.split(" ").filter((word) => target.includes(word) || canonicalTarget.includes(word)).length * 12;
}

function getSearchResultText(result: SearchResult) {
  if (isArtistResult(result)) {
    return result.name;
  }

  return `${result.title} ${result.artist} ${result.album ?? ""}`;
}

function isSongByArtist(song: SearchSong, artistName: string) {
  const songArtist = normalizeSearchValue(song.artist);
  const selectedArtist = normalizeSearchValue(artistName);

  return songArtist === selectedArtist || songArtist.includes(selectedArtist);
}

function getCanonicalSongTitle(title: string) {
  return normalizeSearchValue(title)
    .replace(/\s*\([^)]*(remix|edit|live|instrumental|karaoke|version|remaster|mix)[^)]*\)/g, "")
    .replace(/\s*-[^-]*(remix|edit|live|instrumental|karaoke|version|remaster|mix).*$/g, "")
    .trim();
}

function songsMatchForQueue(selectedSong: SearchSong, request: SongRequestSummary) {
  const numericSongId = Number(selectedSong.id);
  if (Number.isInteger(numericSongId) && numericSongId === request.songId) {
    return true;
  }

  const selectedTitle = getCanonicalSongTitle(selectedSong.title);
  const selectedArtist = normalizeSearchValue(selectedSong.artist);
  const queueTitle = getCanonicalSongTitle(request.songTitle ?? "");
  const queueArtist = normalizeSearchValue(request.songArtist ?? "");

  return selectedTitle.length > 0 && selectedTitle === queueTitle && selectedArtist === queueArtist;
}

function findExistingQueueRequest(
  selectedSong: SearchSong | undefined,
  sessionRequests: SongRequestSummary[] | undefined,
) {
  if (!selectedSong || !sessionRequests?.length) {
    return undefined;
  }

  return sessionRequests.find(
    (request) => isActiveQueueStatus(request.status) && songsMatchForQueue(selectedSong, request),
  );
}

function isMainSongVersion(song: SearchSong) {
  const title = normalizeSearchValue(song.title);

  return !/(\([^)]*(remix|edit|live|instrumental|karaoke|version|remaster|mix)[^)]*\)|-[^-]*(remix|edit|live|instrumental|karaoke|version|remaster|mix))/.test(title);
}

function getSongResultKey(song: SearchSong) {
  return `${song.id}-${song.title}-${song.artist}`;
}

function formatRequestDateTime(value: string) {
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function mapUserAddedContributions(
  request: SongRequestSummary,
  currentUserId?: number | null,
): UserAddedContribution[] {
  if (request.myAddedContributions?.length) {
    return [...request.myAddedContributions]
      .map((contributor) => ({
        id: String(contributor.id),
        amountCents: contributor.amountCents,
        createdAt: contributor.createdAt,
        status: contributor.status,
      }))
      .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
  }

  if (currentUserId == null) {
    return [];
  }

  return [...(request.contributors ?? [])]
    .filter(
      (contributor) =>
        Number(contributor.userId) === Number(currentUserId) && contributor.isInitial !== true,
    )
    .map((contributor) => ({
      id: String(contributor.id),
      amountCents: contributor.amountCents,
      createdAt: contributor.createdAt,
      status: contributor.status,
    }))
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
}

function shouldShowUpRequestsButton(request: UserRequest) {
  const addCount = request.myAddedContributions.length;

  if (!request.isOriginalRequester) {
    return addCount > 1;
  }

  return addCount > 0 || request.myAddedContributionCents > 0;
}

function formatAddStatus(status: UserAddedContribution["status"]) {
  if (status === "pending_payment") {
    return "Pending";
  }

  if (status === "succeeded") {
    return "Added";
  }

  return status.charAt(0).toUpperCase() + status.slice(1);
}

function mapRequestStatus(status: SongRequestSummary["status"]): UserRequest["status"] {
  if (status === "played") {
    return "Played";
  }

  if (status === "locked" || status === "confirmed_by_dj") {
    return "Pending";
  }

  if (status === "cancelled" || status === "refunded" || status === "rejected" || status === "expired") {
    return "Canceled";
  }

  if (status === "pending_payment") {
    return "Pending";
  }

  return "Open";
}

function mapBackendRequest(request: SongRequestSummary, currentUserId?: number | null): UserRequest {
  const totalCents = request.totalPoolCents ?? request.totalAmountCents ?? 0;
  const myContributionCents = request.myContributionCents ?? 0;
  const myOriginalContributionCents =
    request.myOriginalContributionCents ??
    (currentUserId != null && currentUserId === request.requestedByUserId ? request.originalAmountCents : 0);
  const myAddedContributionCents =
    request.myAddedContributionCents ?? Math.max(0, myContributionCents - myOriginalContributionCents);
  const poolOriginalCents = request.poolOriginalCents ?? request.originalAmountCents;
  const addedToSongCents = request.addedAmountCents ?? Math.max(0, totalCents - poolOriginalCents);
  const myAddedContributions = mapUserAddedContributions(request, currentUserId);
  const isOriginalRequester =
    currentUserId != null && currentUserId === request.requestedByUserId;

  return {
    id: String(request.id),
    title: request.songTitle ?? `Song #${request.songId}`,
    artist: request.songArtist ?? "Unknown artist",
    imageUri: request.songAlbumArtUrl ?? undefined,
    submittedAt: request.createdAt,
    djName: request.djArtistName ?? mockActiveSession.djName,
    venue: request.venueName ?? mockActiveSession.venue,
    requestedAmountCents: poolOriginalCents,
    totalCents,
    myContributionCents,
    myOriginalContributionCents,
    myAddedContributionCents,
    addedToSongCents,
    myAddedContributions,
    isOriginalRequester,
    status: mapRequestStatus(request.status),
    canCancel: request.status === "pending_payment" || request.status === "open",
  };
}

function showSearchFirst(
  scrollRef: RefObject<ScrollView | null>,
  searchDockProgress: Animated.Value,
  setRqstModeTab: (tab: RqstModeTab) => void,
  animated = false,
) {
  setRqstModeTab("search");
  searchDockProgress.setValue(0);
  scrollRef.current?.scrollTo({ y: 0, animated });
}

export default function RequestsScreen() {
  const queryClient = useQueryClient();
  const navigation = useNavigation();
  const isScreenFocused = useIsFocused();
  const isSignedIn = useAuthStore((state) => state.status === "authenticated" && Boolean(state.accessToken));
  const currentUserId = useAuthStore((state) => state.user?.id ?? null);
  const { cancelRequest } = useRequestCancel();
  const pendingExpiresById = usePendingCancelStore((state) => state.expiresByRequestId);
  const registerPendingCancel = usePendingCancelStore((state) => state.register);
  const pruneExpiredPendingCancels = usePendingCancelStore((state) => state.pruneExpired);
  const [expiredCancelIds, setExpiredCancelIds] = useState<Set<number>>(() => new Set());
  const searchDockProgress = useRef(new Animated.Value(0)).current;
  const requestDrawerTranslateY = useRef(new Animated.Value(drawerClosedOffset)).current;
  const contributionDrawerTranslateY = useRef(new Animated.Value(drawerClosedOffset)).current;
  const scrollRef = useRef<ScrollView>(null);
  const searchInputRef = useRef<TextInput>(null);
  const [query, setQuery] = useState("");
  const [selectedArtistName, setSelectedArtistName] = useState("");
  const [selectedAlbumName, setSelectedAlbumName] = useState("");
  const [selectedSongId, setSelectedSongId] = useState<number | string>("");
  const [selectedAmount, setSelectedAmount] = useState<(typeof quickAmounts)[number] | typeof customAmountValue>("10");
  const [customAmount, setCustomAmount] = useState("");
  const [showShoutoutRequest, setShowShoutoutRequest] = useState(false);
  const [shoutoutMessage, setShoutoutMessage] = useState("");
  const [selectedShoutoutAmount, setSelectedShoutoutAmount] = useState<
    (typeof shoutoutQuickAmounts)[number] | typeof shoutoutCustomAmountValue
  >("5");
  const [customShoutoutAmount, setCustomShoutoutAmount] = useState("");
  const [localRequests, setLocalRequests] = useState(initialUserRequests);
  const [rqstModeTab, setRqstModeTab] = useState<RqstModeTab>("search");
  const [requestTab, setRequestTab] = useState<RequestTab>("queued");
  const [contributionDraft, setContributionDraft] = useState<ContributionDraft | null>(null);
  const [addHistoryRequestId, setAddHistoryRequestId] = useState<string | null>(null);
  const [customContributionAmount, setCustomContributionAmount] = useState("");
  const [musicSearchResults, setMusicSearchResults] = useState<SearchResult[]>([]);
  const [hasFetchedAppleMusic, setHasFetchedAppleMusic] = useState(false);
  const [isSearchingSongs, setIsSearchingSongs] = useState(false);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [songSearchError, setSongSearchError] = useState("");
  const [requestSubmitError, setRequestSubmitError] = useState("");
  const { sessionId, requestFloorCents, djName, venueName, hasSession } = useActiveSession({ requireSelection: true });
  const myRequestsQuery = useQuery({
    queryKey: ["meRequests"],
    queryFn: () => rqstApi<SongRequestSummary[]>(apiRoutes.meRequests.replace("/api/v1", "")),
    enabled: isSignedIn,
    retry: false,
  });
  const sessionRequestsQuery = useQuery({
    queryKey: ["sessionRequests", sessionId],
    queryFn: () =>
      rqstApi<SongRequestSummary[]>(apiRouteBuilders.sessionRequests(sessionId as number).replace("/api/v1", ""), {
        auth: false,
      }),
    enabled: sessionId != null,
    retry: false,
  });
  const createRequestMutation = useMutation({
    mutationFn: (payload: RequestCreatePayload) =>
      rqstApi<SongRequestSummary>(apiRouteBuilders.createSessionRequest(sessionId).replace("/api/v1", ""), {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: (createdRequest) => {
      queryClient.setQueryData<SongRequestSummary[]>(["meRequests"], (currentRequests = []) => [
        createdRequest,
        ...currentRequests.filter((request) => request.id !== createdRequest.id),
      ]);
      queryClient.setQueryData<SongRequestSummary[]>(["sessionRequests", sessionId], (currentRequests = []) => [
        createdRequest,
        ...currentRequests.filter((request) => request.id !== createdRequest.id),
      ]);
      queryClient.invalidateQueries({ queryKey: ["meRequests"] });
      queryClient.invalidateQueries({ queryKey: ["sessionRequests", sessionId] });
    },
    retry: false,
  });
  const contributeMutation = useMutation({
    mutationFn: ({ requestId, amountCents }: { requestId: string; amountCents: number }) =>
      rqstApi<SongRequestSummary>(apiRouteBuilders.contributeToRequest(requestId).replace("/api/v1", ""), {
        method: "POST",
        body: JSON.stringify({ amount_cents: amountCents } satisfies ContributionCreatePayload),
      }),
    onSuccess: (updatedRequest) => {
      queryClient.setQueryData<SongRequestSummary[]>(["meRequests"], (currentRequests = []) => {
        const existingIndex = currentRequests.findIndex((request) => request.id === updatedRequest.id);
        if (existingIndex === -1) {
          return [updatedRequest, ...currentRequests];
        }

        return currentRequests.map((request) => (request.id === updatedRequest.id ? updatedRequest : request));
      });
      queryClient.setQueryData<SongRequestSummary[]>(["sessionRequests", sessionId], (currentRequests = []) =>
        currentRequests.map((request) => (request.id === updatedRequest.id ? updatedRequest : request)),
      );
      queryClient.invalidateQueries({ queryKey: ["sessionRequests", sessionId] });
      queryClient.invalidateQueries({ queryKey: ["meRequests"] });
    },
    retry: false,
  });

  const deferredQuery = useDeferredValue(query);
  const normalizedInputQuery = normalizeSearchValue(query);
  const normalizedQuery = normalizeSearchValue(deferredQuery);
  const selectedArtistQuery = normalizeSearchValue(selectedArtistName);
  const filteredMusicSearchResults = useMemo<SearchResult[]>(() => {
    if (!normalizedInputQuery) {
      return [];
    }

    return musicSearchResults
      .map((result) => ({
        result,
        score: getSearchScore(normalizedInputQuery, getSearchResultText(result)),
      }))
      .filter((item) => item.score > 0)
      .map((item) => item.result);
  }, [musicSearchResults, normalizedInputQuery]);
  const filteredResults = normalizedInputQuery.length >= 2 && !songSearchError ? filteredMusicSearchResults : [];
  const filteredSongs = filteredResults.filter(isSongResult);
  const artistFilteredSongs = selectedArtistQuery
    ? filteredSongs.filter((song) => isSongByArtist(song, selectedArtistName))
    : filteredSongs;
  const artistMainSongs = artistFilteredSongs.filter(isMainSongVersion).reduce<SearchSong[]>((songs, song) => {
    const canonicalTitle = getCanonicalSongTitle(song.title);
    if (canonicalTitle && !songs.some((existingSong) => getCanonicalSongTitle(existingSong.title) === canonicalTitle)) {
      songs.push(song);
    }

    return songs;
  }, []);
  const artistPopularSongs = artistMainSongs.slice(0, 10);
  const artistAlbumSections = artistMainSongs.reduce<Array<{ album: string; songs: SearchSong[]; coverUri: string }>>(
    (sections, song) => {
      const album = song.album?.trim() || "Singles and other tracks";
      const section = sections.find((item) => item.album === album);

      if (section) {
        section.songs.push(song);
      } else {
        sections.push({ album, songs: [song], coverUri: getSongImageUri(song) });
      }

      return sections;
    },
    [],
  ).sort((left, right) => left.album.localeCompare(right.album));
  const selectedAlbum = selectedAlbumName
    ? artistAlbumSections.find((section) => section.album === selectedAlbumName)
    : undefined;
  const selectedSong = filteredSongs.find((song) => song.id === selectedSongId);
  const existingQueueRequest = useMemo(
    () => findExistingQueueRequest(selectedSong, sessionRequestsQuery.data),
    [selectedSong, sessionRequestsQuery.data],
  );
  const isExistingQueueSong = Boolean(existingQueueRequest);
  const topResult = normalizedQuery && !selectedArtistQuery ? filteredResults[0] : undefined;
  const topResultItems = normalizedQuery && !selectedArtistQuery ? filteredResults.slice(1, 4) : [];
  const songResults = selectedArtistQuery
    ? artistFilteredSongs
    : filteredSongs.filter(
        (song) =>
          (!topResult || !isSongResult(topResult) || song.id !== topResult.id) &&
          !topResultItems.some((result) => isSongResult(result) && result.id === song.id),
      );
  const artistResults = selectedArtistQuery
    ? []
    : filteredResults
        .filter(isArtistResult)
        .filter(
          (artist) =>
            (!topResult || !isArtistResult(topResult) || artist.id !== topResult.id) &&
            !topResultItems.some((result) => isArtistResult(result) && result.id === artist.id),
        );
  const hasVisibleResults = selectedArtistQuery ? artistFilteredSongs.length > 0 : filteredResults.length > 0;
  const canShowEmptyState = normalizedInputQuery.length >= 2 && hasFetchedAppleMusic && !isSearchingSongs && !hasVisibleResults;
  const shouldDockSearch = normalizedInputQuery.length > 0 || Boolean(selectedSong);
  const searchTopSpacerHeight = searchDockProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [188, 0],
  });
  const bidAmount = selectedAmount === customAmountValue ? customAmount : selectedAmount;
  const bidCents = Math.max(Number(bidAmount || 0), 0) * 100;
  const shoutoutAmount =
    selectedShoutoutAmount === shoutoutCustomAmountValue ? customShoutoutAmount : selectedShoutoutAmount;
  const shoutoutAmountCents = showShoutoutRequest ? Math.max(Number(shoutoutAmount || 0), 0) * 100 : 0;
  const requestTotalCents = bidCents + shoutoutAmountCents;
  const canSubmitNew =
    hasSession &&
    Boolean(selectedSong) &&
    !isExistingQueueSong &&
    requestFloorCents != null &&
    Number.isFinite(requestTotalCents) &&
    requestTotalCents >= requestFloorCents &&
    (!showShoutoutRequest || (shoutoutMessage.trim().length > 0 && shoutoutAmountCents > 0));
  const canSubmitContribution =
    hasSession &&
    Boolean(selectedSong) &&
    isExistingQueueSong &&
    requestFloorCents != null &&
    Number.isFinite(bidCents) &&
    bidCents >= requestFloorCents;
  const canSubmit = isExistingQueueSong ? canSubmitContribution : canSubmitNew;
  const isSubmitPending = isExistingQueueSong ? contributeMutation.isPending : createRequestMutation.isPending;
  const requests = useMemo(() => {
    if (isSignedIn) {
      return (myRequestsQuery.data ?? []).map((request) => mapBackendRequest(request, currentUserId));
    }

    return localRequests;
  }, [currentUserId, isSignedIn, localRequests, myRequestsQuery.data]);
  const myRequestsById = useMemo(
    () => new Map((myRequestsQuery.data ?? []).map((request) => [request.id, request])),
    [myRequestsQuery.data],
  );
  const queuedRequests = requests.filter(
    (request) => request.status !== "Played" && request.status !== "Canceled",
  );
  const playedRequests = requests.filter((request) => request.status === "Played");
  const visibleRequests = requestTab === "queued" ? queuedRequests : playedRequests;
  const isRefreshingRequests = myRequestsQuery.isRefetching;
  const contributionRequest = contributionDraft
    ? requests.find((request) => request.id === contributionDraft.requestId)
    : undefined;
  const addHistoryRequest = addHistoryRequestId
    ? requests.find((request) => request.id === addHistoryRequestId)
    : undefined;
  const contributionAmountCents = contributionDraft?.isCustom
    ? Math.max(Number(customContributionAmount || 0), 0) * 100
    : contributionDraft?.amountCents ?? 0;
  const canConfirmContribution =
    Boolean(contributionRequest) &&
    contributionRequest?.status === "Open" &&
    Number.isFinite(contributionAmountCents) &&
    contributionAmountCents > 0;

  useEffect(() => {
    pruneExpiredPendingCancels();
    const interval = setInterval(() => {
      pruneExpiredPendingCancels();
    }, 1000);

    return () => clearInterval(interval);
  }, [pruneExpiredPendingCancels]);

  useEffect(() => {
    if (isSignedIn) {
      void myRequestsQuery.refetch();
    }
  }, [isSignedIn, myRequestsQuery.refetch]);

  useEffect(() => {
    Animated.timing(searchDockProgress, {
      duration: 340,
      easing: Easing.out(Easing.cubic),
      toValue: shouldDockSearch ? 1 : 0,
      useNativeDriver: false,
    }).start();
  }, [searchDockProgress, shouldDockSearch]);

  useEffect(() => {
    if (isScreenFocused) {
      return;
    }

    setQuery("");
    setSelectedArtistName("");
    setSelectedAlbumName("");
    setSelectedSongId("");
    setSelectedAmount("10");
    setCustomAmount("");
    setMusicSearchResults([]);
    setHasFetchedAppleMusic(false);
    setIsSearchingSongs(false);
    setIsSearchFocused(false);
    setSongSearchError("");
    setRequestSubmitError("");
    setRqstModeTab("search");
    searchDockProgress.setValue(0);
  }, [isScreenFocused, searchDockProgress]);

  useEffect(() => {
    if (!selectedSongId) {
      return;
    }

    requestDrawerTranslateY.setValue(drawerClosedOffset);
    Animated.spring(requestDrawerTranslateY, {
      damping: 28,
      mass: 0.82,
      stiffness: 240,
      toValue: 0,
      useNativeDriver: true,
    }).start();
  }, [requestDrawerTranslateY, selectedSongId]);

  useEffect(() => {
    if (!contributionDraft) {
      return;
    }

    contributionDrawerTranslateY.setValue(drawerClosedOffset);
    Animated.spring(contributionDrawerTranslateY, {
      damping: 28,
      mass: 0.82,
      stiffness: 240,
      toValue: 0,
      useNativeDriver: true,
    }).start();
  }, [contributionDrawerTranslateY, contributionDraft]);

  useEffect(() => {
    if (!isScreenFocused) {
      return undefined;
    }

    showSearchFirst(scrollRef, searchDockProgress, setRqstModeTab);

    if (isSignedIn) {
      void myRequestsQuery.refetch();
    }

    const focusTimeout = setTimeout(() => {
      searchInputRef.current?.focus();
    }, 180);

    return () => clearTimeout(focusTimeout);
  }, [isScreenFocused, isSignedIn, myRequestsQuery.refetch, searchDockProgress]);

  useEffect(() => {
    const unsubscribe = navigation.addListener("tabPress", () => {
      showSearchFirst(scrollRef, searchDockProgress, setRqstModeTab, true);
    });

    return unsubscribe;
  }, [navigation, searchDockProgress]);

  useEffect(() => {
    if (normalizedQuery.length < 2) {
      setMusicSearchResults([]);
      setHasFetchedAppleMusic(false);
      setSongSearchError("");
      setIsSearchingSongs(false);
      return;
    }

    const controller = new AbortController();
    setHasFetchedAppleMusic(false);
    const searchTimeout = setTimeout(() => {
      setIsSearchingSongs(true);
      setSongSearchError("");

      const resultLimit = 50;
      const searchQuery = selectedArtistName ? deferredQuery.trim() || selectedArtistName : deferredQuery.trim();
      const searchUrl = `${apiBaseUrl}/songs/search?q=${encodeURIComponent(searchQuery)}&limit=${resultLimit}${
        selectedArtistName ? `&artist=${encodeURIComponent(selectedArtistName)}` : ""
      }`;

      fetch(searchUrl, {
        signal: controller.signal,
      })
        .then((response) => {
          if (!response.ok) {
            throw new Error("Song search failed");
          }
          return response.json() as Promise<SearchResult[]>;
        })
        .then((results) => {
          setMusicSearchResults(results);
          setHasFetchedAppleMusic(true);
        })
        .catch((error) => {
          if (error.name !== "AbortError") {
            setMusicSearchResults([]);
            setHasFetchedAppleMusic(false);
            setSongSearchError("Live search is offline. Showing local picks.");
          }
        })
        .finally(() => setIsSearchingSongs(false));
    }, 120);

    return () => {
      controller.abort();
      clearTimeout(searchTimeout);
    };
  }, [deferredQuery, normalizedQuery, selectedArtistName]);

  function handleSelectSong(songId: number | string) {
    setRequestSubmitError("");
    setSelectedSongId(songId);
    if (selectedAmount === customAmountValue && !customAmount) {
      setSelectedAmount("10");
    }
    if (sessionId != null) {
      void sessionRequestsQuery.refetch();
    }
  }

  function resetRequestDraft() {
    setSelectedSongId("");
    setSelectedAmount("10");
    setCustomAmount("");
    setShowShoutoutRequest(false);
    setShoutoutMessage("");
    setSelectedShoutoutAmount("5");
    setCustomShoutoutAmount("");
    setRequestSubmitError("");
  }

  function closeRequestModal() {
    Animated.timing(requestDrawerTranslateY, {
      duration: 220,
      easing: Easing.out(Easing.cubic),
      toValue: drawerClosedOffset,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        resetRequestDraft();
      }
    });
  }

  function handleSelectArtist(artistName: string) {
    setSelectedArtistName(artistName);
    setSelectedAlbumName("");
    setSelectedSongId("");
    startTransition(() => setQuery(artistName));
  }

  function handleChangeQuery(text: string) {
    setSelectedArtistName("");
    setSelectedAlbumName("");
    startTransition(() => setQuery(text));
  }

  function renderArtistResult(artist: SearchArtist, variant: "top" | "list" = "list") {
    const imageUri = artist.image_url ?? unsplashImages.djPortrait;
    const artistMeta = [artist.artist_type, artist.country, artist.disambiguation].filter(Boolean).join(" · ");

    return (
      <Pressable key={`artist-${artist.id}`} onPress={() => handleSelectArtist(artist.name)} style={styles.songResult}>
        <View style={[styles.songCard, variant === "top" && styles.topResultCard]}>
          <Image
            source={{ uri: imageUri }}
            style={[
              styles.songImage,
              styles.artistImage,
              variant === "top" && styles.topResultImage,
              variant === "top" && styles.topResultArtistImage,
            ]}
          />
          <View style={styles.songCopy}>
            <Text numberOfLines={1} style={[styles.songTitle, variant === "top" && styles.topResultTitle]}>
              {artist.name}
            </Text>
            <Text numberOfLines={1} style={styles.songArtist}>
              {artistMeta || "Artist"}
            </Text>
          </View>
          <View style={styles.artistStatus}>
            <Ionicons name="person" size={16} color={premiumTheme.colors.inkMuted} />
          </View>
        </View>
      </Pressable>
    );
  }

  function renderSongResult(song: SearchSong, variant: "top" | "list" = "list") {
    const selected = selectedSong?.id === song.id;

    return (
      <Pressable key={song.id} onPress={() => handleSelectSong(song.id)} style={styles.songResult}>
        <View style={[styles.songCard, variant === "top" && styles.topResultCard, selected && styles.songCardSelected]}>
          <Image source={{ uri: getSongImageUri(song) }} style={[styles.songImage, variant === "top" && styles.topResultImage]} />
          <View style={styles.songCopy}>
            <Text numberOfLines={1} style={[styles.songTitle, variant === "top" && styles.topResultTitle]}>
              {song.title}
            </Text>
            <Text numberOfLines={1} style={styles.songArtist}>
              {song.album ? `${song.artist} · ${song.album}` : song.artist}
            </Text>
          </View>
          <Pressable
            accessibilityLabel={`Request ${song.title}`}
            onPress={() => handleSelectSong(song.id)}
            style={[styles.songStatus, selected && styles.songStatusSelected]}
          >
            <Ionicons
              name={selected ? "checkmark" : song.external_source === "apple_music" ? "musical-notes" : "add"}
              size={17}
              color={selected ? premiumTheme.colors.text : premiumTheme.colors.inkMuted}
            />
          </Pressable>
        </View>
      </Pressable>
    );
  }

  function openContributionModal(requestId: string, amountCents: number, isCustom = false) {
    setCustomContributionAmount("");
    setContributionDraft({ requestId, amountCents, isCustom });
  }

  function closeContributionModal() {
    Animated.timing(contributionDrawerTranslateY, {
      duration: 220,
      easing: Easing.out(Easing.cubic),
      toValue: drawerClosedOffset,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        setContributionDraft(null);
        setCustomContributionAmount("");
      }
    });
  }

  const requestDrawerPanResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gestureState) => gestureState.dy > 6 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx),
        onPanResponderMove: (_, gestureState) => {
          requestDrawerTranslateY.setValue(Math.max(gestureState.dy, 0));
        },
        onPanResponderRelease: (_, gestureState) => {
          if (gestureState.dy > 86 || gestureState.vy > 0.85) {
            closeRequestModal();
            return;
          }

          Animated.spring(requestDrawerTranslateY, {
            damping: 24,
            stiffness: 260,
            toValue: 0,
            useNativeDriver: true,
          }).start();
        },
      }),
    [requestDrawerTranslateY],
  );

  const contributionDrawerPanResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gestureState) => gestureState.dy > 6 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx),
        onPanResponderMove: (_, gestureState) => {
          contributionDrawerTranslateY.setValue(Math.max(gestureState.dy, 0));
        },
        onPanResponderRelease: (_, gestureState) => {
          if (gestureState.dy > 86 || gestureState.vy > 0.85) {
            closeContributionModal();
            return;
          }

          Animated.spring(contributionDrawerTranslateY, {
            damping: 24,
            stiffness: 260,
            toValue: 0,
            useNativeDriver: true,
          }).start();
        },
      }),
    [contributionDrawerTranslateY],
  );

  async function handleConfirmContribution() {
    if (!contributionDraft || !canConfirmContribution) {
      return;
    }

    const requestId = contributionDraft.requestId;
    const numericRequestId = Number(requestId);

    if (isSignedIn && Number.isInteger(numericRequestId)) {
      try {
        await contributeMutation.mutateAsync({ requestId, amountCents: contributionAmountCents });
        closeContributionModal();
        return;
      } catch {
        // Keep the demo/local flow usable when the authenticated backend is not available.
      }
    }

    setLocalRequests((current) =>
      current.map((request) =>
        request.id === requestId && request.status !== "Played"
          ? {
              ...request,
              totalCents: request.totalCents + contributionAmountCents,
              myContributionCents: request.myContributionCents + contributionAmountCents,
              myAddedContributionCents: request.myAddedContributionCents + contributionAmountCents,
              addedToSongCents: request.addedToSongCents + contributionAmountCents,
              myAddedContributions: [
                {
                  id: `local-add-${Date.now()}`,
                  amountCents: contributionAmountCents,
                  createdAt: new Date().toISOString(),
                  status: "succeeded",
                },
                ...request.myAddedContributions,
              ],
            }
          : request,
      ),
    );
    closeContributionModal();
  }

  async function handleSubmitRequest() {
    if (!selectedSong || !canSubmit) {
      return;
    }

    setRequestSubmitError("");
    if (!hasSession || sessionId == null) {
      setRequestSubmitError("Choose a live DJ or artist before confirming this request.");
      return;
    }
    if (!isSignedIn) {
      setRequestSubmitError("Sign in is required to create this request in the backend.");
      router.push("/(auth)/login");
      return;
    }

    if (existingQueueRequest) {
      try {
        await contributeMutation.mutateAsync({
          requestId: String(existingQueueRequest.id),
          amountCents: bidCents,
        });
        closeRequestModal();
        setQuery("");
        resetRequestDraft();
        setRqstModeTab("requested");
        setRequestTab("queued");
      } catch (error) {
        setRequestSubmitError(
          error instanceof Error ? error.message : "Could not add your contribution. Please try again.",
        );
      }
      return;
    }

    const numericSongId = Number(selectedSong.id);
    try {
      const createdRequest = await createRequestMutation.mutateAsync({
        song_id: Number.isInteger(numericSongId) ? numericSongId : undefined,
        amount_cents: requestTotalCents,
        note: showShoutoutRequest ? shoutoutMessage.trim() : null,
        song: {
          title: selectedSong.title,
          artist: selectedSong.artist,
          album: selectedSong.album ?? null,
          duration_ms: selectedSong.duration_ms ?? null,
          album_art_url: selectedSong.album_art_url ?? selectedSong.imageUri ?? null,
          isrc: selectedSong.isrc ?? null,
          external_source: selectedSong.external_source ?? null,
          external_id: selectedSong.external_id ?? null,
          explicit: selectedSong.explicit ?? false,
        },
      });
      registerPendingCancel(createdRequest.id);
      closeRequestModal();
      setQuery("");
      resetRequestDraft();
      setRqstModeTab("requested");
      setRequestTab("queued");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Could not create this request in the backend. Please try again.";

      if (message.toLowerCase().includes("contribute")) {
        const refreshed = await sessionRequestsQuery.refetch();
        const found = findExistingQueueRequest(selectedSong, refreshed.data);
        if (found) {
          setRequestSubmitError("");
          return;
        }
      }

      setRequestSubmitError(message);
    }
  }

  return (
    <ScreenShell
      contentContainerStyle={styles.content}
      edgeToEdgeTop
      scrollRef={scrollRef}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshingRequests}
          onRefresh={() => {
            if (isSignedIn) {
              void myRequestsQuery.refetch();
            }
          }}
          tintColor="#C95A52"
        />
      }
    >
      <GrainyGradientBackground
        amplitude={0.12}
        animated
        colors={["#b01818", "#b3aeb9", "#073990"]}
        intensity={0.022}
        size={5.2}
        speed={0.85}
      />
      <View style={styles.rqstModeTabs}>
        {rqstModeTabs.map((tab) => {
          const selected = rqstModeTab === tab;

          return (
            <Pressable
              key={tab}
              onPress={() => setRqstModeTab(tab)}
              style={[styles.rqstModeTab, selected && styles.rqstModeTabSelected]}
            >
              <Ionicons
                name={tab === "search" ? "search" : "albums-outline"}
                size={16}
                color={selected ? premiumTheme.colors.text : premiumTheme.colors.inkMuted}
              />
              <Text style={[styles.rqstModeTabText, selected && styles.rqstModeTabTextSelected]}>
                {tab === "search" ? "Search" : "Requested"}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {rqstModeTab === "search" ? (
        <View style={styles.searchPane}>
          <Animated.View style={[styles.searchTopSpacer, { height: searchTopSpacerHeight }]} />
          <View style={[styles.searchBarShell, isSearchFocused && styles.searchBarShellFocused]}>
            <LinearGradient
              colors={
                isSearchFocused
                  ? ["rgba(255, 255, 255, 0.72)", "rgba(255, 255, 255, 0.28)", "rgba(255, 255, 255, 0.56)"]
                  : ["rgba(255, 255, 255, 0.56)", "rgba(255, 255, 255, 0.18)", "rgba(255, 255, 255, 0.42)"]
              }
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.searchBarShellGradient}
            >
            <View style={styles.searchBar}>
              <View style={styles.searchIconBadge}>
                <Ionicons name="search" size={20} color="#FFF9F7" />
              </View>
              <TextInput
                ref={searchInputRef}
                value={query}
                onBlur={() => setIsSearchFocused(false)}
                onChangeText={handleChangeQuery}
                onFocus={() => setIsSearchFocused(true)}
                placeholder="Search by song or artist"
                placeholderTextColor="rgba(30, 23, 23, 0.48)"
                style={styles.searchInput}
              />
            </View>
            </LinearGradient>
          </View>

          {songSearchError ? <Text style={styles.searchError}>{songSearchError}</Text> : null}

          {normalizedInputQuery.length >= 2 ? (
            <View style={styles.songList}>
              {selectedArtistName ? (
                <View style={styles.resultSection}>
                  <Text style={styles.artistPageTitle}>{selectedArtistName}</Text>

                  {selectedAlbum ? (
                    <View style={styles.albumSongSection}>
                      <Pressable onPress={() => setSelectedAlbumName("")} style={styles.albumBackButton}>
                        <Ionicons name="chevron-back" size={16} color={premiumTheme.colors.inkMuted} />
                        <Text style={styles.albumBackText}>Albums</Text>
                      </Pressable>
                      <View style={styles.albumDetailHeader}>
                        <Image source={{ uri: selectedAlbum.coverUri }} style={styles.albumDetailImage} />
                        <View style={styles.albumDetailCopy}>
                          <Text numberOfLines={2} style={styles.albumDetailTitle}>
                            {selectedAlbum.album}
                          </Text>
                          <Text style={styles.albumDetailSubtitle}>{`${selectedAlbum.songs.length} song${
                            selectedAlbum.songs.length === 1 ? "" : "s"
                          }`}</Text>
                        </View>
                      </View>
                      {selectedAlbum.songs.map((song) => renderSongResult(song))}
                    </View>
                  ) : (
                    <>
                      <Text style={styles.resultSectionTitle}>Popular</Text>
                      {artistPopularSongs.map((song, index) => (
                        <View key={getSongResultKey(song)} style={styles.popularSongRow}>
                          <Text style={styles.popularRank}>{index + 1}</Text>
                          <View style={styles.popularSongContent}>{renderSongResult(song)}</View>
                        </View>
                      ))}

                      <Text style={styles.resultSectionTitle}>Albums</Text>
                      <View style={styles.albumGrid}>
                        {artistAlbumSections.map((section) => (
                          <Pressable
                            key={section.album}
                            onPress={() => setSelectedAlbumName(section.album)}
                            style={styles.albumTile}
                          >
                            <Image source={{ uri: section.coverUri }} style={styles.albumTileImage} />
                            <Text numberOfLines={2} style={styles.albumTileTitle}>
                              {section.album}
                            </Text>
                          </Pressable>
                        ))}
                      </View>
                    </>
                  )}
                </View>
              ) : null}

              {!selectedArtistName && topResult ? (
                <View style={styles.resultSection}>
                  <Text style={styles.resultSectionTitle}>Top result</Text>
                  {isSongResult(topResult) ? renderSongResult(topResult, "top") : renderArtistResult(topResult, "top")}
                  {topResultItems.map((result) =>
                    isSongResult(result) ? renderSongResult(result) : renderArtistResult(result),
                  )}
                </View>
              ) : null}

              {!selectedArtistName && songResults.length ? (
                <View style={styles.resultSection}>
                  <Text style={styles.resultSectionTitle}>{selectedArtistName || "Songs"}</Text>
                  {songResults.map((song) => renderSongResult(song))}
                </View>
              ) : null}

              {artistResults.length ? (
                <View style={styles.resultSection}>
                  <Text style={styles.resultSectionTitle}>Artists</Text>
                  {artistResults.map((artist) => renderArtistResult(artist))}
                </View>
              ) : null}
            </View>
          ) : null}

          {canShowEmptyState ? (
            <SurfaceCard style={styles.emptyState}>
              <Text style={styles.emptyTitle}>No results found</Text>
              <Text style={styles.emptySubtitle}>
                {selectedArtistName
                  ? `No songs found for ${selectedArtistName}.`
                  : "Try a different artist, title, or a shorter search."}
              </Text>
            </SurfaceCard>
          ) : null}
        </View>
      ) : (
        <>
          <View style={styles.requestsSectionHeader}>
            <SectionTitle title="My requests" subtitle="Add money to open songs while they are still eligible." />
          </View>
          <View style={styles.requestTabs}>
            {requestTabs.map((tab) => {
              const selected = requestTab === tab;
              return (
                <Pressable
                  key={tab}
                  onPress={() => setRequestTab(tab)}
                  style={[styles.requestTab, selected && styles.requestTabSelected]}
                >
                  <Text style={[styles.requestTabText, selected && styles.requestTabTextSelected]}>
                    {tab === "queued" ? "Queued" : "Played"}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <View style={styles.requestList}>
            {visibleRequests.map((request) => {
              const isPlayed = request.status === "Played";
              const backendRequest = myRequestsById.get(Number(request.id));
              const cancelExpiresAt =
                backendRequest && !expiredCancelIds.has(backendRequest.id)
                  ? getPendingCancelExpiresAt(backendRequest.id, pendingExpiresById)
                  : null;
              const showCancelAction =
                requestTab === "queued" &&
                backendRequest != null &&
                cancelExpiresAt != null &&
                canCancelRequest(backendRequest, currentUserId, pendingExpiresById);

              return (
                <SurfaceCard key={request.id} style={[styles.requestCard, !isPlayed && styles.queuedRequestCard]}>
                  <View style={styles.requestTop}>
                    <View style={styles.requestTitleWrap}>
                      <Image
                        source={{
                          uri:
                            request.imageUri ??
                            songLibrary.find((song) => song.title === request.title)?.imageUri ??
                            unsplashImages.queueAccent,
                        }}
                        style={styles.requestImage}
                      />
                      <View style={styles.requestTitleCopy}>
                        <Text numberOfLines={1} style={styles.requestTitle}>
                          {request.title}
                        </Text>
                        <Text numberOfLines={1} style={styles.requestSubtitle}>
                          {request.artist}
                        </Text>
                      </View>
                    </View>
                    <Tag label={isPlayed ? "Played" : "Queued"} tone={isPlayed ? "slate" : "mint"} />
                  </View>
                  <View style={styles.requestContextRow}>
                    <View style={styles.requestContextItem}>
                      <Ionicons name="time-outline" size={14} color={premiumTheme.colors.inkMuted} />
                      <Text numberOfLines={1} style={styles.requestContextText}>
                        {formatRequestDateTime(request.submittedAt)}
                      </Text>
                    </View>
                    <View style={styles.requestContextItem}>
                      <Ionicons name="location-outline" size={14} color={premiumTheme.colors.inkMuted} />
                      <Text numberOfLines={1} style={styles.requestContextText}>
                        {request.venue}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.requestDetailGrid}>
                    <View style={[styles.requestDetailItem, styles.requestDetailItemPrimary]}>
                      <Text style={styles.requestDetailLabel}>Total</Text>
                      <Text style={styles.requestDetailValue}>{formatUsd(request.totalCents)}</Text>
                      <Text style={styles.requestDetailHint}>All contributors combined</Text>
                    </View>
                    <View style={styles.requestDetailItem}>
                      <Text style={styles.requestDetailLabel}>Original</Text>
                      <Text style={styles.requestDetailValue}>{formatUsd(request.requestedAmountCents)}</Text>
                    </View>
                  </View>
                  <View style={styles.requestYouRow}>
                    <Text style={styles.requestYouLabel}>Your share</Text>
                    <View style={styles.requestYouBreakdown}>
                      {request.myOriginalContributionCents > 0 ? (
                        <Text style={styles.requestYouPart}>Request {formatUsd(request.myOriginalContributionCents)}</Text>
                      ) : null}
                      {request.myAddedContributionCents > 0 ? (
                        <Text style={styles.requestYouPartAdded}>+{formatUsd(request.myAddedContributionCents)} added</Text>
                      ) : null}
                      {request.myContributionCents > 0 ? (
                        <Text style={styles.requestYouTotal}>{formatUsd(request.myContributionCents)} total</Text>
                      ) : (
                        <Text style={styles.requestYouTotalMuted}>No contribution yet</Text>
                      )}
                    </View>
                  </View>
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
                    />
                  ) : null}
                  {shouldShowUpRequestsButton(request) ? (
                    <Pressable
                      accessibilityLabel={`View all up-requests for ${request.title}`}
                      accessibilityRole="button"
                      onPress={() => setAddHistoryRequestId(request.id)}
                      style={styles.addHistoryButton}
                    >
                      <View style={styles.addHistoryButtonCopy}>
                        <Ionicons name="arrow-up-circle-outline" size={16} color="#5E78B8" />
                        <Text style={styles.addHistoryButtonText}>
                          {request.myAddedContributions.length > 0
                            ? `All up-requests (${request.myAddedContributions.length})`
                            : "All up-requests"}
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward" size={16} color={premiumTheme.colors.inkMuted} />
                    </Pressable>
                  ) : null}
                  {request.status === "Open" ? (
                    <View style={styles.requestButtons}>
                      <Pressable onPress={() => openContributionModal(request.id, 500)} style={styles.smallButton}>
                        <Text style={styles.smallButtonText}>Add $5</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => openContributionModal(request.id, 0, true)}
                        style={styles.customAmountButton}
                      >
                        <Text style={styles.customAmountButtonText}>Custom amount</Text>
                      </Pressable>
                    </View>
                  ) : null}
                </SurfaceCard>
              );
            })}
          </View>
        </>
      )}
      <Modal
        animationType="fade"
        transparent
        presentationStyle="overFullScreen"
        visible={Boolean(contributionDraft)}
        onRequestClose={closeContributionModal}
      >
        <Pressable style={styles.requestModalBackdrop} onPress={closeContributionModal}>
          <AnimatedPressable
            style={[styles.requestDrawer, { transform: [{ translateY: contributionDrawerTranslateY }] }]}
            onPress={(event) => event.stopPropagation()}
          >
            <View style={styles.requestDragArea} {...contributionDrawerPanResponder.panHandlers}>
              <View style={styles.requestDrawerHandle} />
            </View>
            <View style={styles.modalHeader}>
              <Text style={styles.modalEyebrow}>Confirm contribution</Text>
              <Pressable accessibilityLabel="Close contribution modal" onPress={closeContributionModal} style={styles.modalClose}>
                <Ionicons name="close" size={18} color={premiumTheme.colors.inkMuted} />
              </Pressable>
            </View>
            <Text style={styles.modalTitle}>{contributionRequest?.title ?? "Request"}</Text>
            <Text style={styles.modalSubtitle}>
              {contributionRequest ? `${contributionRequest.djName} · ${contributionRequest.venue}` : ""}
            </Text>
            {contributionDraft?.isCustom ? (
              <View style={styles.modalInputWrap}>
                <Text style={styles.modalInputPrefix}>$</Text>
                <TextInput
                  value={customContributionAmount}
                  onChangeText={setCustomContributionAmount}
                  keyboardType="numeric"
                  placeholder="Enter amount"
                  placeholderTextColor="rgba(30, 23, 23, 0.48)"
                  style={styles.modalInput}
                />
              </View>
            ) : (
              <View style={styles.confirmAmountPill}>
                <Text style={styles.confirmAmountText}>{formatUsd(contributionAmountCents)}</Text>
              </View>
            )}
            <Text style={styles.modalFinePrint}>This will increase your contribution and move the request higher in the queue.</Text>
            <View style={styles.modalActions}>
              <Pressable onPress={closeContributionModal} style={styles.modalSecondaryButton}>
                <Text style={styles.modalSecondaryText}>Back</Text>
              </Pressable>
              <Pressable
                disabled={!canConfirmContribution}
                onPress={handleConfirmContribution}
                style={[styles.modalPrimaryButton, !canConfirmContribution && styles.ctaDisabled]}
              >
                <Text style={styles.modalPrimaryText}>Confirm</Text>
              </Pressable>
            </View>
          </AnimatedPressable>
        </Pressable>
      </Modal>
      <Modal
        animationType="slide"
        transparent
        visible={Boolean(addHistoryRequest)}
        onRequestClose={() => setAddHistoryRequestId(null)}
      >
        <View style={styles.addHistoryBackdrop}>
          <View style={styles.addHistoryCard}>
            <View style={styles.addHistoryHeader}>
              <View style={styles.addHistoryHeaderCopy}>
                <Text style={styles.addHistoryEyebrow}>All up-requests</Text>
                <Text style={styles.addHistoryTitle}>{addHistoryRequest?.title}</Text>
                <Text style={styles.addHistorySubtitle}>
                  {addHistoryRequest?.myAddedContributions.length ?? 0} times you added money
                </Text>
              </View>
              <Pressable
                accessibilityLabel="Close up-requests list"
                onPress={() => setAddHistoryRequestId(null)}
                style={styles.addHistoryCloseButton}
              >
                <Ionicons name="close" size={18} color={premiumTheme.colors.ink} />
              </Pressable>
            </View>
            <ScrollView
              style={styles.addHistoryListScroll}
              contentContainerStyle={styles.addHistoryList}
              showsVerticalScrollIndicator
            >
              {(addHistoryRequest?.myAddedContributions ?? []).length > 0 ? (
                (addHistoryRequest?.myAddedContributions ?? []).map((addition, index) => (
                  <View key={addition.id} style={styles.addHistoryItem}>
                    <View style={styles.addHistoryItemCopy}>
                      <Text style={styles.addHistoryItemLabel}>
                        {`Up-request #${(addHistoryRequest?.myAddedContributions.length ?? 0) - index}`}
                      </Text>
                      <Text style={styles.addHistoryItemDate}>{formatRequestDateTime(addition.createdAt)}</Text>
                    </View>
                    <View style={styles.addHistoryItemMeta}>
                      <Text style={styles.addHistoryItemAmount}>{formatUsd(addition.amountCents)}</Text>
                      <Text
                        style={[
                          styles.addHistoryItemStatus,
                          addition.status === "pending_payment" && styles.addHistoryItemStatusPending,
                        ]}
                      >
                        {formatAddStatus(addition.status)}
                      </Text>
                    </View>
                  </View>
                ))
              ) : (
                <View style={styles.addHistoryEmpty}>
                  <Text style={styles.addHistoryEmptyText}>
                    {formatUsd(addHistoryRequest?.myAddedContributionCents ?? 0)} added in total. Pull to refresh if
                    individual up-requests are missing.
                  </Text>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
      <Modal
        animationType="fade"
        transparent
        presentationStyle="overFullScreen"
        visible={Boolean(selectedSongId)}
        onRequestClose={closeRequestModal}
      >
        <Pressable style={styles.requestModalBackdrop} onPress={closeRequestModal}>
          <AnimatedPressable
            style={[styles.requestDrawer, { transform: [{ translateY: requestDrawerTranslateY }] }]}
            onPress={(event) => event.stopPropagation()}
          >
            <View style={styles.requestDragArea} {...requestDrawerPanResponder.panHandlers}>
              <View style={styles.requestDrawerHandle} />
            </View>
            <View style={styles.modalHeader}>
              <Text style={styles.modalEyebrow}>
                {isExistingQueueSong ? "Add to existing request" : "Confirm song request"}
              </Text>
              <Pressable accessibilityLabel="Close request modal" onPress={closeRequestModal} style={styles.modalClose}>
                <Ionicons name="close" size={18} color={premiumTheme.colors.inkMuted} />
              </Pressable>
            </View>

            {selectedSong ? (
              <>
                <View style={styles.bidHeader}>
                  <View style={styles.bidHeaderCopy}>
                    <Text numberOfLines={2} style={styles.modalTitle}>
                      {selectedSong.title}
                    </Text>
                    <Text numberOfLines={1} style={styles.modalSubtitle}>
                      {selectedSong.artist}
                    </Text>
                  </View>
                  <Image source={{ uri: getSongImageUri(selectedSong) }} style={styles.bidImage} />
                </View>

                {existingQueueRequest ? (
                  <View style={styles.existingQueueBanner}>
                    <Ionicons color={siteThemeBlue} name="musical-notes" size={24} />
                    <View style={styles.existingQueueBannerCopy}>
                      <Text style={styles.existingQueueTitle}>Song already in queue</Text>
                      <View style={styles.existingQueueStats}>
                        <View style={styles.existingQueueStatBlock}>
                          <Text style={styles.existingQueueStatValue}>
                            {formatUsd(
                              existingQueueRequest.totalPoolCents ?? existingQueueRequest.totalAmountCents ?? 0,
                            )}
                          </Text>
                          <Text style={styles.existingQueueStatLabel}>current total</Text>
                        </View>
                        <View style={styles.existingQueueStatDivider} />
                        <View style={styles.existingQueueStatBlock}>
                          <Text style={styles.existingQueueStatValue}>{existingQueueRequest.contributorCount}</Text>
                          <Text style={styles.existingQueueStatLabel}>
                            {existingQueueRequest.contributorCount === 1 ? "contributor" : "contributors"}
                          </Text>
                        </View>
                      </View>
                    </View>
                  </View>
                ) : null}

                {!isExistingQueueSong && !hasSession ? (
                  <View style={styles.requestTargetPicker}>
                    <Text style={styles.requestTargetEyebrow}>Choose who receives this request</Text>
                    <DirectorySearch
                      defaultViewMode="browse"
                      hideDjActions
                      liveOnly
                      selectOnly
                      onLiveSessionSelected={() => setRequestSubmitError("")}
                    />
                  </View>
                ) : null}

                {!isExistingQueueSong && hasSession ? (
                <LinearGradient
                  colors={[...siteGradientColors]}
                  end={{ x: 1, y: 1 }}
                  start={{ x: 0, y: 0 }}
                  style={styles.requestTargetCardBorder}
                >
                  <View style={styles.requestTargetCardInner}>
                    <Text style={styles.requestTargetEyebrow}>This request goes to</Text>
                    <View style={styles.requestTargetMain}>
                      <LinearGradient
                        colors={[...siteGradientColors]}
                        end={{ x: 1, y: 1 }}
                        start={{ x: 0, y: 0 }}
                        style={styles.requestTargetIconWrap}
                      >
                        <Ionicons color="#FFFFFF" name="headset" size={18} />
                      </LinearGradient>
                      <View style={styles.requestTargetCopy}>
                        <Text numberOfLines={1} style={styles.requestTargetDj}>
                          {djName}
                        </Text>
                        <View style={styles.requestTargetVenueRow}>
                          <Ionicons color={premiumTheme.colors.coral} name="location" size={14} />
                          <Text numberOfLines={1} style={styles.requestTargetVenue}>
                            {venueName}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.requestTargetLiveBadge}>
                        <Ionicons color="#FFFFFF" name="radio" size={11} />
                        <Text style={styles.requestTargetLiveText}>Live</Text>
                      </View>
                    </View>
                  </View>
                </LinearGradient>
                ) : null}
              </>
            ) : null}

            <Text style={styles.modalSectionLabel}>{isExistingQueueSong ? "Contribution amount" : "Song amount"}</Text>
            <View style={styles.amountRow}>
              {quickAmounts.map((value) => {
                const selected = selectedAmount === value;

                return (
                  <Pressable
                    key={value}
                    onPress={() => setSelectedAmount(value)}
                    style={[styles.amountChip, selected && styles.amountChipSelected]}
                  >
                    <Text style={[styles.amountChipText, selected && styles.amountChipTextSelected]}>{`$${value}`}</Text>
                  </Pressable>
                );
              })}
              <Pressable
                onPress={() => setSelectedAmount(customAmountValue)}
                style={[styles.amountChip, selectedAmount === customAmountValue && styles.amountChipSelected]}
              >
                <Text
                  style={[
                    styles.amountChipText,
                    selectedAmount === customAmountValue && styles.amountChipTextSelected,
                  ]}
                >
                  Custom
                </Text>
              </Pressable>
            </View>

            {selectedAmount === customAmountValue ? (
              <View style={styles.modalInputWrap}>
                <Text style={styles.modalInputPrefix}>$</Text>
                <TextInput
                  value={customAmount}
                  onChangeText={setCustomAmount}
                  keyboardType="numeric"
                  placeholder="Enter amount"
                  placeholderTextColor="rgba(30, 23, 23, 0.48)"
                  style={styles.modalInput}
                />
              </View>
            ) : null}

            {!isExistingQueueSong ? (
            <Pressable
              onPress={() => setShowShoutoutRequest((current) => !current)}
              style={styles.shoutoutAddButton}
            >
              <Ionicons name={showShoutoutRequest ? "close" : "megaphone-outline"} size={13} color="#FFFFFF" />
              <Text style={styles.shoutoutAddButtonText}>{showShoutoutRequest ? "Remove shoutout" : "Add shoutout"}</Text>
            </Pressable>
            ) : null}

            {!isExistingQueueSong && showShoutoutRequest ? (
              <View style={styles.shoutoutPanel}>
                <Text style={styles.shoutoutSupportingText}>Request a message for the DJ to shoutout to the crowd.</Text>
                <TextInput
                  value={shoutoutMessage}
                  onChangeText={setShoutoutMessage}
                  multiline
                  maxLength={240}
                  placeholder="Message for the DJ"
                  placeholderTextColor="rgba(47, 95, 190, 0.46)"
                  style={styles.shoutoutMessageInput}
                />
                <View style={styles.shoutoutAmountRow}>
                  {shoutoutQuickAmounts.map((value) => {
                    const selected = selectedShoutoutAmount === value;

                    return (
                      <Pressable
                        key={value}
                        onPress={() => setSelectedShoutoutAmount(value)}
                        style={[styles.shoutoutAmountChip, selected && styles.shoutoutAmountChipSelected]}
                      >
                        <Text style={[styles.shoutoutAmountChipText, selected && styles.shoutoutAmountChipTextSelected]}>
                          {`$${value}`}
                        </Text>
                      </Pressable>
                    );
                  })}
                  <Pressable
                    onPress={() => setSelectedShoutoutAmount(shoutoutCustomAmountValue)}
                    style={[
                      styles.shoutoutAmountChip,
                      selectedShoutoutAmount === shoutoutCustomAmountValue && styles.shoutoutAmountChipSelected,
                    ]}
                  >
                    <Text
                      style={[
                        styles.shoutoutAmountChipText,
                        selectedShoutoutAmount === shoutoutCustomAmountValue && styles.shoutoutAmountChipTextSelected,
                      ]}
                    >
                      Custom
                    </Text>
                  </Pressable>
                </View>
                {selectedShoutoutAmount === shoutoutCustomAmountValue ? (
                  <View style={styles.shoutoutAmountWrap}>
                    <Text style={styles.shoutoutAmountPrefix}>$</Text>
                    <TextInput
                      value={customShoutoutAmount}
                      onChangeText={setCustomShoutoutAmount}
                      keyboardType="numeric"
                      placeholder="Amount"
                      placeholderTextColor="rgba(47, 95, 190, 0.46)"
                      style={styles.shoutoutAmountInput}
                    />
                  </View>
                ) : null}
              </View>
            ) : null}

            <View style={styles.requestModalFooter}>
              {!isExistingQueueSong && hasSession ? (
              <View style={styles.requestTargetConfirmRow}>
                <Ionicons color={premiumTheme.colors.coral} name="checkmark-circle" size={16} />
                <Text style={styles.requestTargetConfirmText}>
                  Sending to{" "}
                  <Text style={styles.requestTargetConfirmHighlight}>{djName}</Text>
                  {" · "}
                  <Text style={styles.requestTargetConfirmHighlight}>{venueName}</Text>
                </Text>
              </View>
              ) : null}
              <Text style={[styles.modalFinePrint, requestSubmitError ? styles.modalFinePrintError : null]}>
                {requestSubmitError
                  ? requestSubmitError
                  : isExistingQueueSong
                    ? canSubmit
                      ? `Your ${formatUsd(bidCents)} contribution will boost this request in the queue.`
                      : requestFloorCents != null
                        ? `Minimum contribution is ${formatUsd(requestFloorCents)}.`
                        : "Choose a live DJ or artist to continue."
                  : !hasSession
                    ? "Select a live DJ or artist above to continue."
                  : showShoutoutRequest && !shoutoutMessage.trim()
                  ? "Add a shoutout message to continue."
                  : showShoutoutRequest && shoutoutAmountCents <= 0
                    ? "Choose a shoutout amount to continue."
                  : canSubmit
                    ? `Your request amount is ${formatUsd(requestTotalCents)}.`
                    : requestFloorCents != null
                      ? `Minimum request is ${formatUsd(requestFloorCents)}.`
                      : "Select a live DJ or artist above to continue."}
              </Text>
              <View style={styles.requestConfirmActions}>
                <Pressable
                  disabled={!canSubmit || isSubmitPending}
                  onPress={handleSubmitRequest}
                  style={[
                    isExistingQueueSong ? styles.modalContributeButton : styles.modalPrimaryButton,
                    (!canSubmit || isSubmitPending) && styles.ctaDisabled,
                  ]}
                >
                  <Text style={styles.modalPrimaryText}>
                    {isSubmitPending
                      ? isExistingQueueSong
                        ? "Contributing"
                        : "Requesting"
                      : isExistingQueueSong
                        ? `Contribute ${formatUsd(bidCents)}`
                        : "Confirm request"}
                  </Text>
                </Pressable>
              </View>
            </View>
          </AnimatedPressable>
        </Pressable>
      </Modal>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  amountChip: {
    alignItems: "center",
    backgroundColor: premiumTheme.colors.backgroundSecondary,
    borderColor: premiumTheme.colors.border,
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: "center",
    minWidth: 70,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  amountChipSelected: {
    backgroundColor: premiumTheme.colors.coral,
    borderColor: premiumTheme.colors.coral,
  },
  amountChipText: {
    color: premiumTheme.colors.ink,
    fontFamily: premiumTheme.fonts.body,
    fontSize: 15,
    fontWeight: "700",
  },
  amountChipTextSelected: {
    color: premiumTheme.colors.text,
  },
  amountRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  albumBackButton: {
    alignItems: "center",
    flexDirection: "row",
    gap: 4,
    paddingHorizontal: 12,
    paddingTop: 12,
  },
  albumBackText: {
    color: premiumTheme.colors.inkMuted,
    fontFamily: premiumTheme.fonts.body,
    fontSize: 13,
    fontWeight: "800",
  },
  albumDetailCopy: {
    flex: 1,
    gap: 4,
  },
  albumDetailHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    padding: 12,
  },
  albumDetailImage: {
    borderRadius: 10,
    height: 72,
    width: 72,
  },
  albumDetailSubtitle: {
    color: premiumTheme.colors.inkMuted,
    fontFamily: premiumTheme.fonts.body,
    fontSize: 12,
    fontWeight: "700",
  },
  albumDetailTitle: {
    color: premiumTheme.colors.ink,
    fontFamily: premiumTheme.fonts.display,
    fontSize: 18,
    fontWeight: "800",
  },
  albumGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    columnGap: 8,
    rowGap: 12,
    padding: 12,
    paddingTop: 6,
  },
  albumSongSection: {
    paddingBottom: 6,
  },
  albumTile: {
    gap: 5,
    width: "31.5%",
  },
  albumTileImage: {
    aspectRatio: 1,
    borderRadius: 10,
    width: "100%",
  },
  albumTileTitle: {
    color: premiumTheme.colors.ink,
    fontFamily: premiumTheme.fonts.body,
    fontSize: 11,
    fontWeight: "700",
    lineHeight: 14,
  },
  artistImage: {
    borderRadius: 23,
  },
  artistPageTitle: {
    color: premiumTheme.colors.ink,
    fontFamily: premiumTheme.fonts.display,
    fontSize: 22,
    fontWeight: "800",
    paddingHorizontal: 12,
    paddingTop: 14,
  },
  artistStatus: {
    alignItems: "center",
    backgroundColor: premiumTheme.colors.backgroundSecondary,
    borderRadius: 999,
    height: 32,
    justifyContent: "center",
    width: 32,
  },
  bidCard: {
    gap: 16,
  },
  bidHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: 14,
    justifyContent: "space-between",
  },
  bidHeaderCopy: {
    flex: 1,
    gap: 4,
  },
  bidImage: {
    borderRadius: 14,
    height: 64,
    width: 64,
  },
  bidSubtitle: {
    color: premiumTheme.colors.inkMuted,
    fontFamily: premiumTheme.fonts.body,
    fontSize: 13,
  },
  bidTitle: {
    color: premiumTheme.colors.ink,
    fontFamily: premiumTheme.fonts.display,
    fontSize: 22,
    fontWeight: "800",
  },
  content: {
    gap: 16,
    minHeight: "100%",
    paddingBottom: 112,
    position: "relative",
  },
  cta: {
    alignItems: "center",
    alignSelf: "stretch",
    backgroundColor: premiumTheme.colors.coral,
    borderRadius: 999,
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    paddingVertical: 16,
  },
  ctaDisabled: {
    backgroundColor: "#B9B3AE",
  },
  ctaText: {
    color: premiumTheme.colors.text,
    fontFamily: premiumTheme.fonts.body,
    fontSize: 16,
    fontWeight: "800",
  },
  customInput: {
    color: premiumTheme.colors.ink,
    flex: 1,
    fontFamily: premiumTheme.fonts.body,
    fontSize: 18,
    fontWeight: "700",
    paddingVertical: 14,
  },
  customInputWrap: {
    alignItems: "center",
    backgroundColor: premiumTheme.colors.backgroundSecondary,
    borderColor: premiumTheme.colors.border,
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 16,
  },
  customPrefix: {
    color: premiumTheme.colors.inkMuted,
    fontFamily: premiumTheme.fonts.body,
    fontSize: 18,
    fontWeight: "700",
  },
  customAmountButton: {
    alignItems: "center",
    backgroundColor: "rgba(77, 134, 247, 0.11)",
    borderColor: "rgba(77, 134, 247, 0.24)",
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: "center",
    minWidth: 124,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  customAmountButtonText: {
    color: "#2F5FBE",
    fontFamily: premiumTheme.fonts.body,
    fontSize: 12,
    fontWeight: "800",
  },
  emptyState: {
    gap: 6,
  },
  emptySubtitle: {
    color: premiumTheme.colors.inkMuted,
    fontFamily: premiumTheme.fonts.body,
    fontSize: 14,
  },
  emptyTitle: {
    color: premiumTheme.colors.ink,
    fontFamily: premiumTheme.fonts.display,
    fontSize: 20,
    fontWeight: "700",
  },
  floorCopy: {
    color: premiumTheme.colors.inkMuted,
    fontFamily: premiumTheme.fonts.body,
    fontSize: 13,
    fontWeight: "600",
  },
  confirmAmountPill: {
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: "rgba(224, 90, 71, 0.12)",
    borderColor: "rgba(224, 90, 71, 0.22)",
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  confirmAmountText: {
    color: premiumTheme.colors.coral,
    fontFamily: premiumTheme.fonts.display,
    fontSize: 18,
    fontWeight: "800",
  },
  modalActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 2,
  },
  modalClose: {
    alignItems: "center",
    backgroundColor: premiumTheme.colors.backgroundSecondary,
    borderRadius: 999,
    height: 32,
    justifyContent: "center",
    width: 32,
  },
  modalContextItem: {
    alignItems: "center",
    backgroundColor: "rgba(30, 23, 23, 0.04)",
    borderColor: "rgba(30, 23, 23, 0.06)",
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    gap: 5,
    minWidth: 0,
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  modalContextRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
    paddingTop: 4,
  },
  modalContextText: {
    color: premiumTheme.colors.inkMuted,
    fontFamily: premiumTheme.fonts.body,
    fontSize: 11,
    fontWeight: "800",
    maxWidth: 124,
  },
  modalEyebrow: {
    color: premiumTheme.colors.inkMuted,
    fontFamily: premiumTheme.fonts.body,
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  modalFinePrint: {
    color: premiumTheme.colors.inkMuted,
    fontFamily: premiumTheme.fonts.body,
    fontSize: 12,
    lineHeight: 17,
  },
  modalFinePrintError: {
    color: premiumTheme.colors.coral,
    fontWeight: "700",
  },
  existingQueueBanner: {
    alignItems: "flex-start",
    backgroundColor: "rgba(47, 95, 190, 0.12)",
    borderColor: "rgba(47, 95, 190, 0.32)",
    borderRadius: 18,
    borderWidth: 2,
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 16,
  },
  existingQueueBannerCopy: {
    flex: 1,
    gap: 10,
  },
  existingQueueTitle: {
    color: siteThemeBlue,
    fontFamily: premiumTheme.fonts.display,
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: -0.4,
  },
  existingQueueStats: {
    alignItems: "center",
    flexDirection: "row",
    gap: 14,
  },
  existingQueueStatBlock: {
    gap: 2,
  },
  existingQueueStatValue: {
    color: premiumTheme.colors.ink,
    fontFamily: premiumTheme.fonts.display,
    fontSize: 20,
    fontWeight: "900",
  },
  existingQueueStatLabel: {
    color: premiumTheme.colors.inkMuted,
    fontFamily: premiumTheme.fonts.body,
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  existingQueueStatDivider: {
    backgroundColor: "rgba(47, 95, 190, 0.28)",
    height: 36,
    width: 1,
  },
  modalHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  modalInput: {
    color: premiumTheme.colors.ink,
    flex: 1,
    fontFamily: premiumTheme.fonts.body,
    fontSize: 18,
    fontWeight: "800",
    paddingVertical: 12,
  },
  modalInputPrefix: {
    color: premiumTheme.colors.inkMuted,
    fontFamily: premiumTheme.fonts.body,
    fontSize: 18,
    fontWeight: "800",
  },
  modalInputWrap: {
    alignItems: "center",
    backgroundColor: premiumTheme.colors.backgroundSecondary,
    borderColor: premiumTheme.colors.border,
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 14,
  },
  modalPrimaryButton: {
    alignItems: "center",
    backgroundColor: premiumTheme.colors.coral,
    borderRadius: 999,
    flex: 1,
    justifyContent: "center",
    paddingVertical: 12,
  },
  modalContributeButton: {
    alignItems: "center",
    backgroundColor: siteThemeBlue,
    borderRadius: 999,
    flex: 1,
    justifyContent: "center",
    paddingVertical: 12,
  },
  modalPrimaryText: {
    color: premiumTheme.colors.text,
    fontFamily: premiumTheme.fonts.body,
    fontSize: 14,
    fontWeight: "800",
  },
  modalSecondaryButton: {
    alignItems: "center",
    backgroundColor: premiumTheme.colors.backgroundSecondary,
    borderRadius: 999,
    flex: 1,
    justifyContent: "center",
    paddingVertical: 12,
  },
  modalSecondaryText: {
    color: premiumTheme.colors.ink,
    fontFamily: premiumTheme.fonts.body,
    fontSize: 14,
    fontWeight: "800",
  },
  modalSectionLabel: {
    color: premiumTheme.colors.inkMuted,
    fontFamily: premiumTheme.fonts.body,
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  modalSubtitle: {
    color: premiumTheme.colors.inkMuted,
    fontFamily: premiumTheme.fonts.body,
    fontSize: 13,
    fontWeight: "600",
  },
  modalTitle: {
    color: premiumTheme.colors.ink,
    fontFamily: premiumTheme.fonts.display,
    fontSize: 22,
    fontWeight: "800",
  },
  popularRank: {
    color: premiumTheme.colors.inkMuted,
    fontFamily: premiumTheme.fonts.body,
    fontSize: 13,
    fontWeight: "800",
    textAlign: "center",
    width: 24,
  },
  popularSongContent: {
    flex: 1,
  },
  popularSongRow: {
    alignItems: "center",
    flexDirection: "row",
    paddingLeft: 8,
  },
  requestButtons: {
    flexDirection: "row",
    gap: 8,
  },
  requestCard: {
    backgroundColor: "rgba(255, 255, 255, 0.88)",
    borderColor: "rgba(255, 255, 255, 0.78)",
    borderRadius: 22,
    borderWidth: 1,
    gap: 10,
    overflow: "hidden",
    padding: 14,
    shadowOffset: { width: 0, height: 9 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
  },
  queuedRequestCard: {
    borderColor: "rgba(77, 134, 247, 0.22)",
    shadowColor: "#4D86F7",
    shadowOpacity: 0.1,
  },
  requestContextItem: {
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.62)",
    borderColor: "rgba(30, 23, 23, 0.06)",
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    flex: 1,
    gap: 5,
    minWidth: 0,
    paddingHorizontal: 9,
    paddingVertical: 7,
  },
  requestContextRow: {
    flexDirection: "row",
    gap: 8,
  },
  requestContextText: {
    color: premiumTheme.colors.inkMuted,
    flex: 1,
    fontFamily: premiumTheme.fonts.body,
    fontSize: 11,
    fontWeight: "700",
  },
  requestImage: {
    borderRadius: 12,
    height: 46,
    width: 46,
  },
  requestList: {
    gap: 10,
  },
  requestDrawer: {
    alignSelf: "stretch",
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopColor: "rgba(30, 23, 23, 0.08)",
    borderTopWidth: 1,
    elevation: 18,
    flexGrow: 1,
    gap: 14,
    maxHeight: "90%",
    minHeight: "58%",
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 34,
    shadowColor: "#1E1717",
    shadowOffset: { width: 0, height: -12 },
    shadowOpacity: 0.18,
    shadowRadius: 28,
    width: "100%",
  },
  requestDrawerHandle: {
    alignSelf: "center",
    backgroundColor: "rgba(30, 23, 23, 0.18)",
    borderRadius: 999,
    height: 5,
    marginBottom: 2,
    width: 42,
  },
  requestModalBackdrop: {
    backgroundColor: "rgba(30, 23, 23, 0.34)",
    flex: 1,
    justifyContent: "flex-end",
  },
  requestConfirmActions: {
    flexDirection: "row",
  },
  requestTargetPicker: {
    gap: 10,
  },
  requestTargetCardBorder: {
    borderRadius: 20,
    padding: 2,
  },
  requestTargetCardInner: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    gap: 10,
    padding: 14,
  },
  requestTargetConfirmHighlight: {
    color: premiumTheme.colors.ink,
    fontWeight: "800",
  },
  requestTargetConfirmRow: {
    alignItems: "center",
    backgroundColor: "rgba(224, 90, 71, 0.08)",
    borderColor: "rgba(224, 90, 71, 0.16)",
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  requestTargetConfirmText: {
    color: premiumTheme.colors.inkMuted,
    flex: 1,
    fontFamily: premiumTheme.fonts.body,
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 18,
  },
  requestTargetCopy: {
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
  requestTargetDj: {
    color: premiumTheme.colors.ink,
    fontFamily: premiumTheme.fonts.display,
    fontSize: 22,
    fontWeight: "800",
    lineHeight: 26,
  },
  requestTargetEyebrow: {
    color: premiumTheme.colors.inkMuted,
    fontFamily: premiumTheme.fonts.body,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  requestTargetIconWrap: {
    alignItems: "center",
    borderRadius: 16,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  requestTargetLiveBadge: {
    alignItems: "center",
    backgroundColor: premiumTheme.colors.coral,
    borderRadius: 999,
    flexDirection: "row",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  requestTargetLiveText: {
    color: "#FFFFFF",
    fontFamily: premiumTheme.fonts.body,
    fontSize: 11,
    fontWeight: "800",
  },
  requestTargetMain: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
  },
  requestTargetVenue: {
    color: premiumTheme.colors.ink,
    flex: 1,
    fontFamily: premiumTheme.fonts.body,
    fontSize: 15,
    fontWeight: "700",
    lineHeight: 20,
  },
  requestTargetVenueRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 5,
  },
  requestModalFooter: {
    gap: 10,
    marginTop: "auto",
  },
  requestDetailGrid: {
    columnGap: 8,
    flexDirection: "row",
    flexWrap: "wrap",
    rowGap: 8,
  },
  requestDetailItem: {
    backgroundColor: premiumTheme.colors.backgroundSecondary,
    borderColor: "rgba(30, 23, 23, 0.05)",
    borderRadius: 16,
    borderWidth: 1,
    flex: 1,
    gap: 2,
    minWidth: 92,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  requestDetailItemPrimary: {
    backgroundColor: "rgba(184, 235, 221, 0.44)",
  },
  requestDragArea: {
    alignItems: "center",
    marginHorizontal: -18,
    paddingBottom: 6,
    paddingTop: 2,
  },
  requestDetailLabel: {
    color: premiumTheme.colors.inkMuted,
    fontFamily: premiumTheme.fonts.body,
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  requestDetailHint: {
    color: premiumTheme.colors.inkMuted,
    fontFamily: premiumTheme.fonts.body,
    fontSize: 9,
    fontWeight: "600",
  },
  requestDetailValue: {
    color: premiumTheme.colors.ink,
    fontFamily: premiumTheme.fonts.body,
    fontSize: 12,
    fontWeight: "800",
  },
  requestDetailValueAdded: {
    color: "#5E78B8",
  },
  requestYouRow: {
    backgroundColor: premiumTheme.colors.backgroundSecondary,
    borderColor: "rgba(30, 23, 23, 0.05)",
    borderRadius: 16,
    borderWidth: 1,
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  requestYouLabel: {
    color: premiumTheme.colors.inkMuted,
    fontFamily: premiumTheme.fonts.body,
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  requestYouBreakdown: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  requestYouPart: {
    color: premiumTheme.colors.ink,
    fontFamily: premiumTheme.fonts.body,
    fontSize: 12,
    fontWeight: "700",
  },
  requestYouPartAdded: {
    color: "#5E78B8",
    fontFamily: premiumTheme.fonts.body,
    fontSize: 12,
    fontWeight: "800",
  },
  requestYouTotal: {
    color: premiumTheme.colors.ink,
    fontFamily: premiumTheme.fonts.display,
    fontSize: 12,
    fontWeight: "800",
  },
  requestYouTotalMuted: {
    color: premiumTheme.colors.inkMuted,
    fontFamily: premiumTheme.fonts.body,
    fontSize: 12,
    fontWeight: "600",
  },
  addHistoryBackdrop: {
    backgroundColor: "rgba(30,23,23,0.4)",
    flex: 1,
    justifyContent: "flex-end",
    padding: 16,
  },
  addHistoryButton: {
    alignItems: "center",
    backgroundColor: "rgba(94, 120, 184, 0.08)",
    borderColor: "rgba(94, 120, 184, 0.18)",
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  addHistoryButtonCopy: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
  addHistoryButtonText: {
    color: "#5E78B8",
    fontFamily: premiumTheme.fonts.body,
    fontSize: 13,
    fontWeight: "800",
  },
  addHistoryCard: {
    backgroundColor: premiumTheme.colors.surfaceElevated,
    borderRadius: 24,
    gap: 14,
    maxHeight: "78%",
    padding: 20,
  },
  addHistoryCloseButton: {
    alignItems: "center",
    backgroundColor: premiumTheme.colors.surface,
    borderRadius: 999,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  addHistoryEyebrow: {
    color: premiumTheme.colors.inkMuted,
    fontFamily: premiumTheme.fonts.body,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  addHistoryHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 12,
  },
  addHistoryHeaderCopy: {
    flex: 1,
    gap: 2,
  },
  addHistoryItem: {
    alignItems: "center",
    backgroundColor: premiumTheme.colors.surface,
    borderColor: premiumTheme.colors.border,
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between",
    padding: 12,
  },
  addHistoryItemAmount: {
    color: "#5E78B8",
    fontFamily: premiumTheme.fonts.display,
    fontSize: 16,
    fontWeight: "800",
    textAlign: "right",
  },
  addHistoryItemCopy: {
    flex: 1,
    gap: 2,
  },
  addHistoryItemDate: {
    color: premiumTheme.colors.inkMuted,
    fontFamily: premiumTheme.fonts.body,
    fontSize: 13,
  },
  addHistoryItemLabel: {
    color: premiumTheme.colors.ink,
    fontFamily: premiumTheme.fonts.display,
    fontSize: 15,
    fontWeight: "800",
  },
  addHistoryItemMeta: {
    alignItems: "flex-end",
    gap: 2,
  },
  addHistoryItemStatus: {
    color: premiumTheme.colors.inkMuted,
    fontFamily: premiumTheme.fonts.body,
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  addHistoryItemStatusPending: {
    color: "#A3485B",
  },
  addHistoryList: {
    gap: 10,
    paddingRight: 2,
  },
  addHistoryListScroll: {
    maxHeight: 420,
  },
  addHistoryEmpty: {
    paddingHorizontal: 8,
    paddingVertical: 12,
  },
  addHistoryEmptyText: {
    color: premiumTheme.colors.inkMuted,
    fontFamily: premiumTheme.fonts.body,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
  addHistorySubtitle: {
    color: premiumTheme.colors.inkMuted,
    fontFamily: premiumTheme.fonts.body,
    fontSize: 14,
  },
  addHistoryTitle: {
    color: premiumTheme.colors.ink,
    fontFamily: premiumTheme.fonts.display,
    fontSize: 24,
    fontWeight: "800",
  },
  requestsSectionHeader: {
    marginTop: 28,
  },
  requestSubtitle: {
    color: premiumTheme.colors.inkMuted,
    fontFamily: premiumTheme.fonts.body,
    fontSize: 12,
  },
  requestTitle: {
    color: premiumTheme.colors.ink,
    fontFamily: premiumTheme.fonts.display,
    fontSize: 16,
    fontWeight: "700",
    lineHeight: 20,
  },
  requestTitleCopy: {
    flex: 1,
    minWidth: 0,
  },
  requestTitleWrap: {
    alignItems: "center",
    flexDirection: "row",
    flex: 1,
    gap: 10,
  },
  requestTop: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    justifyContent: "space-between",
  },
  requestTab: {
    alignItems: "center",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0)",
    flex: 1,
    justifyContent: "center",
    paddingVertical: 9,
  },
  requestTabSelected: {
    backgroundColor: premiumTheme.colors.coral,
    borderColor: "rgba(255, 198, 166, 0.72)",
  },
  requestTabs: {
    backgroundColor: "#ECEEF0",
    borderColor: "rgba(255, 255, 255, 0.6)",
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    gap: 4,
    overflow: "hidden",
    padding: 4,
  },
  requestTabText: {
    color: premiumTheme.colors.inkMuted,
    fontFamily: premiumTheme.fonts.body,
    fontSize: 12,
    fontWeight: "800",
  },
  requestTabTextSelected: {
    color: premiumTheme.colors.text,
  },
  rqstModeTab: {
    alignItems: "center",
    backgroundColor: "#ECEEF0",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0)",
    flex: 1,
    flexDirection: "row",
    gap: 7,
    justifyContent: "center",
    minHeight: 42,
    paddingHorizontal: 12,
  },
  rqstModeTabSelected: {
    backgroundColor: premiumTheme.colors.coral,
    borderColor: "rgba(255, 198, 166, 0.72)",
  },
  rqstModeTabs: {
    backgroundColor: "#ECEEF0",
    borderColor: "rgba(255, 255, 255, 0.66)",
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    gap: 4,
    overflow: "hidden",
    padding: 4,
    zIndex: 1,
  },
  rqstModeTabText: {
    color: premiumTheme.colors.inkMuted,
    fontFamily: premiumTheme.fonts.body,
    fontSize: 13,
    fontWeight: "800",
  },
  rqstModeTabTextSelected: {
    color: premiumTheme.colors.text,
  },
  resultSection: {
    borderBottomColor: premiumTheme.colors.border,
    borderBottomWidth: 1,
    paddingBottom: 6,
  },
  resultSectionTitle: {
    color: premiumTheme.colors.ink,
    fontFamily: premiumTheme.fonts.display,
    fontSize: 18,
    fontWeight: "800",
    paddingHorizontal: 12,
    paddingTop: 14,
    paddingBottom: 4,
  },
  searchBar: {
    alignItems: "center",
    backgroundColor: "#F5F6F7",
    borderColor: "rgba(255, 255, 255, 0.82)",
    borderRadius: 26,
    borderTopColor: "rgba(255, 255, 255, 0.96)",
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    minHeight: 64,
    overflow: "hidden",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  searchBarShell: {
    backgroundColor: "#FFFFFF",
    borderRadius: 30,
    elevation: 12,
    padding: 3,
    shadowColor: "#C8D8F1",
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.22,
    shadowRadius: 28,
    zIndex: 1,
  },
  searchBarShellFocused: {
    elevation: 16,
    shadowOpacity: 0.28,
  },
  searchBarShellGradient: {
    borderRadius: 27,
    overflow: "hidden",
  },
  searchIconBadge: {
    alignItems: "center",
    backgroundColor: premiumTheme.colors.coral,
    borderColor: "rgba(255, 255, 255, 0.56)",
    borderWidth: 1,
    borderRadius: 19,
    height: 38,
    justifyContent: "center",
    width: 38,
  },
  searchInput: {
    color: premiumTheme.colors.ink,
    flex: 1,
    fontFamily: premiumTheme.fonts.body,
    fontSize: 17,
    fontWeight: "700",
    minHeight: 38,
  },
  searchError: {
    color: premiumTheme.colors.coral,
    fontFamily: premiumTheme.fonts.body,
    fontSize: 13,
    fontWeight: "600",
  },
  searchPane: {
    gap: 16,
    minHeight: 500,
    zIndex: 1,
  },
  searchTopSpacer: {
    flexShrink: 0,
  },
  sessionNote: {
    color: premiumTheme.colors.inkMuted,
    fontFamily: premiumTheme.fonts.body,
    fontSize: 13,
  },
  shoutoutAddButton: {
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: "#2F5FBE",
    borderColor: "rgba(255, 255, 255, 0.4)",
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    gap: 5,
    justifyContent: "center",
    minHeight: 32,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  shoutoutAddButtonText: {
    color: "#FFFFFF",
    fontFamily: premiumTheme.fonts.body,
    fontSize: 11,
    fontWeight: "800",
  },
  shoutoutSupportingText: {
    color: "#2F5FBE",
    fontFamily: premiumTheme.fonts.body,
    fontSize: 12,
    fontWeight: "800",
    lineHeight: 17,
  },
  shoutoutAmountChip: {
    alignItems: "center",
    backgroundColor: "rgba(47, 95, 190, 0.08)",
    borderColor: "rgba(47, 95, 190, 0.18)",
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 34,
    minWidth: 58,
    paddingHorizontal: 12,
  },
  shoutoutAmountChipSelected: {
    backgroundColor: "#2F5FBE",
    borderColor: "#2F5FBE",
  },
  shoutoutAmountChipText: {
    color: "#2F5FBE",
    fontFamily: premiumTheme.fonts.body,
    fontSize: 12,
    fontWeight: "800",
  },
  shoutoutAmountChipTextSelected: {
    color: "#FFFFFF",
  },
  shoutoutAmountInput: {
    color: "#2F5FBE",
    flex: 1,
    fontFamily: premiumTheme.fonts.body,
    fontSize: 13,
    fontWeight: "800",
    paddingVertical: 8,
  },
  shoutoutAmountPrefix: {
    color: "#2F5FBE",
    fontFamily: premiumTheme.fonts.body,
    fontSize: 16,
    fontWeight: "800",
  },
  shoutoutAmountRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  shoutoutAmountWrap: {
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.72)",
    borderColor: "rgba(47, 95, 190, 0.18)",
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    gap: 4,
    paddingHorizontal: 12,
  },
  shoutoutMessageInput: {
    color: "#2F5FBE",
    backgroundColor: "rgba(255, 255, 255, 0.72)",
    borderColor: "rgba(47, 95, 190, 0.16)",
    borderRadius: 14,
    borderWidth: 1,
    fontFamily: premiumTheme.fonts.body,
    fontSize: 13,
    fontWeight: "700",
    minHeight: 74,
    paddingHorizontal: 12,
    paddingVertical: 10,
    textAlignVertical: "top",
  },
  shoutoutPanel: {
    backgroundColor: "rgba(47, 95, 190, 0.08)",
    borderColor: "rgba(47, 95, 190, 0.16)",
    borderRadius: 16,
    borderWidth: 1,
    gap: 10,
    padding: 10,
  },
  smallButton: {
    alignItems: "center",
    backgroundColor: premiumTheme.colors.coral,
    borderRadius: 999,
    justifyContent: "center",
    minWidth: 76,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  smallButtonDisabled: {
    backgroundColor: "#5C5E6C",
    borderColor: "transparent",
  },
  smallButtonText: {
    color: premiumTheme.colors.text,
    fontFamily: premiumTheme.fonts.body,
    fontSize: 12,
    fontWeight: "700",
  },
  songArtist: {
    color: premiumTheme.colors.inkMuted,
    fontFamily: premiumTheme.fonts.body,
    fontSize: 12,
  },
  songCard: {
    alignItems: "center",
    backgroundColor: premiumTheme.colors.surfaceElevated,
    flexDirection: "row",
    gap: 10,
    minHeight: 66,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  songCardSelected: {
    backgroundColor: "rgba(224, 90, 71, 0.08)",
  },
  songCopy: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  songImage: {
    borderRadius: 8,
    height: 46,
    width: 46,
  },
  songList: {
    backgroundColor: premiumTheme.colors.surfaceElevated,
    borderColor: premiumTheme.colors.border,
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
  },
  songResult: {
    borderRadius: 0,
  },
  songStatus: {
    alignItems: "center",
    backgroundColor: premiumTheme.colors.backgroundSecondary,
    borderRadius: 999,
    height: 32,
    justifyContent: "center",
    width: 32,
  },
  songStatusSelected: {
    backgroundColor: premiumTheme.colors.coral,
  },
  songTitle: {
    color: premiumTheme.colors.ink,
    fontFamily: premiumTheme.fonts.body,
    fontSize: 15,
    fontWeight: "700",
  },
  topResultCard: {
    gap: 12,
    minHeight: 84,
    paddingBottom: 12,
    paddingTop: 10,
  },
  topResultImage: {
    borderRadius: 12,
    height: 60,
    width: 60,
  },
  topResultArtistImage: {
    borderRadius: 30,
  },
  topResultTitle: {
    fontFamily: premiumTheme.fonts.display,
    fontSize: 19,
    fontWeight: "800",
  },
});
