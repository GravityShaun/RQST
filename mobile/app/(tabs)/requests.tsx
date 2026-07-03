import { startTransition, useDeferredValue, useEffect, useMemo, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Image, Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { formatUsd } from "@rqst/shared-config";
import { apiRouteBuilders, apiRoutes, type SongRequestSummary } from "@rqst/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { ScreenShell, SectionTitle, SurfaceCard, Tag, premiumTheme } from "../../src/components/premium-ui";
import { activeSession, initialUserRequests, songLibrary, type UserRequest } from "../../src/features/rqst/mock-data";
import {
  apiBaseUrl,
  hasApiAccessToken,
  rqstApi,
  type ContributionCreatePayload,
  type RequestCreatePayload,
} from "../../src/lib/rqst-api";
import { unsplashImages } from "../../src/lib/unsplash";

const quickAmounts = ["5", "10", "15"] as const;
const customAmountValue = "custom";
const requestTabs = ["queued", "played"] as const;

type SearchSong = {
  result_type?: "song";
  id: number | string;
  title: string;
  artist: string;
  album?: string | null;
  imageUri?: string | null;
  album_art_url?: string | null;
  external_source?: string;
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

function mapRequestStatus(status: SongRequestSummary["status"]): UserRequest["status"] {
  if (status === "played") {
    return "Played";
  }

  if (status === "locked" || status === "confirmed_by_dj") {
    return "Locked";
  }

  if (status === "cancelled" || status === "refunded" || status === "rejected" || status === "expired") {
    return "Canceled";
  }

  if (status === "pending_payment") {
    return "Pending";
  }

  return "Open";
}

function mapBackendRequest(request: SongRequestSummary): UserRequest {
  return {
    id: String(request.id),
    title: request.songTitle ?? `Song #${request.songId}`,
    artist: request.songArtist ?? "Unknown artist",
    imageUri: request.songAlbumArtUrl ?? undefined,
    submittedAt: request.createdAt,
    djName: request.djArtistName ?? activeSession.djName,
    venue: request.venueName ?? activeSession.venue,
    requestedAmountCents: request.originalAmountCents,
    totalCents: request.totalAmountCents || request.originalAmountCents,
    myContributionCents: request.myContributionCents || request.originalAmountCents,
    status: mapRequestStatus(request.status),
    canCancel: request.status === "pending_payment" || request.status === "open",
  };
}

function createLocalRequest(song: SearchSong, amountCents: number): UserRequest {
  return {
    id: `request-${Date.now()}`,
    title: song.title,
    artist: song.artist,
    imageUri: getSongImageUri(song),
    submittedAt: new Date().toISOString(),
    djName: activeSession.djName,
    venue: activeSession.venue,
    requestedAmountCents: amountCents,
    totalCents: amountCents,
    myContributionCents: amountCents,
    status: "Open",
    canCancel: false,
  };
}

export default function RequestsScreen() {
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  const [selectedArtistName, setSelectedArtistName] = useState("");
  const [selectedAlbumName, setSelectedAlbumName] = useState("");
  const [selectedSongId, setSelectedSongId] = useState<number | string>("");
  const [selectedAmount, setSelectedAmount] = useState<(typeof quickAmounts)[number] | typeof customAmountValue>("10");
  const [customAmount, setCustomAmount] = useState("");
  const [localRequests, setLocalRequests] = useState(initialUserRequests);
  const [requestTab, setRequestTab] = useState<RequestTab>("queued");
  const [contributionDraft, setContributionDraft] = useState<ContributionDraft | null>(null);
  const [customContributionAmount, setCustomContributionAmount] = useState("");
  const [musicSearchResults, setMusicSearchResults] = useState<SearchResult[]>([]);
  const [hasFetchedAppleMusic, setHasFetchedAppleMusic] = useState(false);
  const [isSearchingSongs, setIsSearchingSongs] = useState(false);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [songSearchError, setSongSearchError] = useState("");
  const sessionId = activeSession.id;
  const myRequestsQuery = useQuery({
    queryKey: ["meRequests"],
    queryFn: () => rqstApi<SongRequestSummary[]>(apiRoutes.meRequests.replace("/api/v1", "")),
    enabled: hasApiAccessToken,
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
      queryClient.setQueryData<SongRequestSummary[]>(["meRequests"], (currentRequests = []) => [
        updatedRequest,
        ...currentRequests.filter((request) => request.id !== updatedRequest.id),
      ]);
      queryClient.invalidateQueries({ queryKey: ["sessionRequests", sessionId] });
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
  const bidAmount = selectedAmount === customAmountValue ? customAmount : selectedAmount;
  const bidCents = Math.max(Number(bidAmount || 0), 0) * 100;
  const canSubmit = Boolean(selectedSong) && Number.isFinite(bidCents) && bidCents >= activeSession.requestFloorCents;
  const requests = myRequestsQuery.data?.map(mapBackendRequest) ?? localRequests;
  const queuedRequests = requests.filter((request) => request.status !== "Played");
  const playedRequests = requests.filter((request) => request.status === "Played");
  const visibleRequests = requestTab === "queued" ? queuedRequests : playedRequests;
  const contributionRequest = contributionDraft
    ? requests.find((request) => request.id === contributionDraft.requestId)
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
    setSelectedSongId(songId);
    if (selectedAmount === customAmountValue && !customAmount) {
      setSelectedAmount("10");
    }
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
          <View style={[styles.songStatus, selected && styles.songStatusSelected]}>
            <Ionicons
              name={selected ? "checkmark" : song.external_source === "apple_music" ? "musical-notes" : "add"}
              size={17}
              color={selected ? premiumTheme.colors.text : premiumTheme.colors.inkMuted}
            />
          </View>
        </View>
      </Pressable>
    );
  }

  function openContributionModal(requestId: string, amountCents: number, isCustom = false) {
    setCustomContributionAmount("");
    setContributionDraft({ requestId, amountCents, isCustom });
  }

  function closeContributionModal() {
    setContributionDraft(null);
    setCustomContributionAmount("");
  }

  async function handleConfirmContribution() {
    if (!contributionDraft || !canConfirmContribution) {
      return;
    }

    const requestId = contributionDraft.requestId;
    const numericRequestId = Number(requestId);

    if (hasApiAccessToken && Number.isInteger(numericRequestId)) {
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

    const numericSongId = Number(selectedSong.id);
    if (hasApiAccessToken && Number.isInteger(numericSongId)) {
      try {
        await createRequestMutation.mutateAsync({
          song_id: numericSongId,
          amount_cents: bidCents,
        });
        setQuery("");
        setSelectedSongId("");
        setSelectedAmount("10");
        setCustomAmount("");
        return;
      } catch {
        // Keep the demo/local flow usable when the authenticated backend is not available.
      }
    }

    setLocalRequests((current) => [createLocalRequest(selectedSong, bidCents), ...current]);
    setQuery("");
    setSelectedSongId("");
    setSelectedAmount("10");
    setCustomAmount("");
  }

  return (
    <ScreenShell contentContainerStyle={styles.content}>
      <LinearGradient
        colors={isSearchFocused ? ["#FF6B5A", "#F2C6A6", "#4D86F7"] : ["#E05A47", "#FFF7F1", "#5C93FF"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.searchBarShell, isSearchFocused && styles.searchBarShellFocused]}
      >
        <View style={styles.searchBar}>
          <View style={styles.searchIconBadge}>
            <Ionicons name="search" size={20} color="#FFF9F7" />
          </View>
          <TextInput
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

      {selectedSong ? (
        <SurfaceCard style={styles.bidCard}>
          <View style={styles.bidHeader}>
            <View style={styles.bidHeaderCopy}>
              <Text style={styles.bidTitle}>Choose an amount</Text>
              <Text style={styles.bidSubtitle}>{`${selectedSong.title} · ${selectedSong.artist}`}</Text>
            </View>
            <Image source={{ uri: getSongImageUri(selectedSong) }} style={styles.bidImage} />
          </View>

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
            <View style={styles.customInputWrap}>
              <Text style={styles.customPrefix}>$</Text>
              <TextInput
                value={customAmount}
                onChangeText={setCustomAmount}
                keyboardType="numeric"
                placeholder="Enter amount"
                placeholderTextColor="#8F9099"
                style={styles.customInput}
              />
            </View>
          ) : null}

          <Text style={styles.floorCopy}>
            {canSubmit
              ? `Your bid: ${formatUsd(bidCents)}`
              : `Minimum bid is ${formatUsd(activeSession.requestFloorCents)}`}
          </Text>

          <Pressable
            disabled={!canSubmit || createRequestMutation.isPending}
            onPress={handleSubmitRequest}
            style={[styles.cta, (!canSubmit || createRequestMutation.isPending) && styles.ctaDisabled]}
          >
            <Text style={styles.ctaText}>{createRequestMutation.isPending ? "Placing bid" : "Place bid"}</Text>
            <Ionicons name="arrow-forward" size={18} color={premiumTheme.colors.background} />
          </Pressable>
        </SurfaceCard>
      ) : null}

      <View style={styles.requestsSectionHeader}>
        <SectionTitle title="My requests" subtitle="Add money to open songs while they are still eligible." />
      </View>
      <View style={styles.requestTabs}>
        {requestTabs.map((tab) => {
          const selected = requestTab === tab;
          const count = tab === "queued" ? queuedRequests.length : playedRequests.length;

          return (
            <Pressable
              key={tab}
              onPress={() => setRequestTab(tab)}
              style={[styles.requestTab, selected && styles.requestTabSelected]}
            >
              <Text style={[styles.requestTabText, selected && styles.requestTabTextSelected]}>
                {`${tab === "queued" ? "Queued" : "Played"} ${count}`}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <View style={styles.requestList}>
        {visibleRequests.map((request) => (
          <SurfaceCard key={request.id} style={styles.requestCard}>
            <View style={styles.requestTop}>
              <View style={styles.requestTitleWrap}>
                <Image
                  source={{
                    uri: request.imageUri ?? songLibrary.find((song) => song.title === request.title)?.imageUri ?? unsplashImages.queueAccent,
                  }}
                  style={styles.requestImage}
                />
                <View>
                  <Text numberOfLines={1} style={styles.requestTitle}>
                    {request.title}
                  </Text>
                  <Text numberOfLines={1} style={styles.requestSubtitle}>
                    {request.artist}
                  </Text>
                </View>
              </View>
              <Tag
                label={request.status}
                tone={request.status === "Played" ? "slate" : "mint"}
              />
            </View>
            <View style={styles.requestDetailGrid}>
              <View style={styles.requestDetailItem}>
                <Text style={styles.requestDetailLabel}>When</Text>
                <Text style={styles.requestDetailValue}>{formatRequestDateTime(request.submittedAt)}</Text>
              </View>
              <View style={styles.requestDetailItem}>
                <Text style={styles.requestDetailLabel}>To</Text>
                <Text style={styles.requestDetailValue}>{request.djName}</Text>
              </View>
              <View style={styles.requestDetailItem}>
                <Text style={styles.requestDetailLabel}>Venue</Text>
                <Text style={styles.requestDetailValue}>{request.venue}</Text>
              </View>
              <View style={styles.requestDetailItem}>
                <Text style={styles.requestDetailLabel}>Requested</Text>
                <Text style={styles.requestDetailValue}>{formatUsd(request.requestedAmountCents)}</Text>
              </View>
            </View>
            <View style={styles.requestMetaRow}>
              <Text style={styles.requestMeta}>{`Total ${formatUsd(request.totalCents)}`}</Text>
              <Text style={styles.requestMeta}>{`You ${formatUsd(request.myContributionCents)}`}</Text>
            </View>
            {request.status === "Open" ? (
              <View style={styles.requestButtons}>
                <Pressable onPress={() => openContributionModal(request.id, 500)} style={styles.smallButton}>
                  <Text style={styles.smallButtonText}>Add $5</Text>
                </Pressable>
                <Pressable onPress={() => openContributionModal(request.id, 0, true)} style={styles.customAmountButton}>
                  <Text style={styles.customAmountButtonText}>Custom amount</Text>
                </Pressable>
              </View>
            ) : null}
          </SurfaceCard>
        ))}
      </View>
      <Modal
        animationType="fade"
        transparent
        visible={Boolean(contributionDraft)}
        onRequestClose={closeContributionModal}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.confirmModal}>
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
          </View>
        </View>
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
    paddingBottom: 112,
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
  confirmModal: {
    backgroundColor: "#FFFFFF",
    borderColor: "rgba(255, 255, 255, 0.72)",
    borderRadius: 28,
    borderWidth: 1,
    gap: 12,
    padding: 18,
    shadowColor: "#1E1717",
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.22,
    shadowRadius: 34,
    width: "100%",
  },
  modalActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 2,
  },
  modalBackdrop: {
    alignItems: "center",
    backgroundColor: "rgba(30, 23, 23, 0.42)",
    flex: 1,
    justifyContent: "center",
    padding: 20,
  },
  modalClose: {
    alignItems: "center",
    backgroundColor: premiumTheme.colors.backgroundSecondary,
    borderRadius: 999,
    height: 32,
    justifyContent: "center",
    width: 32,
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
    borderRadius: 22,
    gap: 10,
    padding: 12,
    shadowOffset: { width: 0, height: 9 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
  },
  requestImage: {
    borderRadius: 12,
    height: 46,
    width: 46,
  },
  requestList: {
    gap: 10,
  },
  requestDetailGrid: {
    columnGap: 8,
    flexDirection: "row",
    flexWrap: "wrap",
    rowGap: 8,
  },
  requestDetailItem: {
    backgroundColor: premiumTheme.colors.backgroundSecondary,
    borderRadius: 14,
    gap: 2,
    paddingHorizontal: 10,
    paddingVertical: 8,
    width: "48.5%",
  },
  requestDetailLabel: {
    color: premiumTheme.colors.inkMuted,
    fontFamily: premiumTheme.fonts.body,
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  requestDetailValue: {
    color: premiumTheme.colors.ink,
    fontFamily: premiumTheme.fonts.body,
    fontSize: 12,
    fontWeight: "800",
  },
  requestMeta: {
    color: premiumTheme.colors.inkMuted,
    fontFamily: premiumTheme.fonts.body,
    fontSize: 12,
    fontWeight: "600",
  },
  requestMetaRow: {
    flexDirection: "row",
    gap: 12,
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
    flex: 1,
    justifyContent: "center",
    paddingVertical: 9,
  },
  requestTabSelected: {
    backgroundColor: "#FFFFFF",
    shadowColor: "#768190",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
  },
  requestTabs: {
    backgroundColor: "rgba(255, 255, 255, 0.45)",
    borderColor: premiumTheme.colors.border,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    gap: 4,
    padding: 4,
  },
  requestTabText: {
    color: premiumTheme.colors.inkMuted,
    fontFamily: premiumTheme.fonts.body,
    fontSize: 12,
    fontWeight: "800",
  },
  requestTabTextSelected: {
    color: premiumTheme.colors.ink,
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
    backgroundColor: "#FFFFFF",
    borderColor: "rgba(255, 255, 255, 0.84)",
    borderRadius: 26,
    borderRightColor: "#4D86F7",
    borderRightWidth: 4,
    borderWidth: 2,
    flexDirection: "row",
    gap: 12,
    minHeight: 64,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  searchBarShell: {
    borderRadius: 30,
    elevation: 7,
    padding: 3,
    shadowColor: "#5C3EFF",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.16,
    shadowRadius: 20,
  },
  searchBarShellFocused: {
    elevation: 10,
    shadowOpacity: 0.26,
  },
  searchIconBadge: {
    alignItems: "center",
    backgroundColor: premiumTheme.colors.coral,
    borderRadius: 19,
    height: 38,
    justifyContent: "center",
    shadowColor: premiumTheme.colors.coral,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.28,
    shadowRadius: 8,
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
  sessionNote: {
    color: premiumTheme.colors.inkMuted,
    fontFamily: premiumTheme.fonts.body,
    fontSize: 13,
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
