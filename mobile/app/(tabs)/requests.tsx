import { startTransition, useDeferredValue, useEffect, useMemo, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { Image, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { formatUsd } from "@rqst/shared-config";

import { ScreenShell, SectionTitle, SurfaceCard, Tag, premiumTheme } from "../../src/components/premium-ui";
import { activeSession, initialUserRequests, songLibrary } from "../../src/features/rqst/mock-data";
import { unsplashImages } from "../../src/lib/unsplash";

const quickAmounts = ["5", "10", "15"] as const;
const customAmountValue = "custom";
const apiBaseUrl = process.env.EXPO_PUBLIC_RQST_API_URL ?? "http://127.0.0.1:8000/api/v1";

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

export default function RequestsScreen() {
  const [query, setQuery] = useState("");
  const [selectedArtistName, setSelectedArtistName] = useState("");
  const [selectedAlbumName, setSelectedAlbumName] = useState("");
  const [selectedSongId, setSelectedSongId] = useState<number | string>("");
  const [selectedAmount, setSelectedAmount] = useState<(typeof quickAmounts)[number] | typeof customAmountValue>("10");
  const [customAmount, setCustomAmount] = useState("");
  const [requests, setRequests] = useState(initialUserRequests);
  const [musicSearchResults, setMusicSearchResults] = useState<SearchResult[]>([]);
  const [hasFetchedAppleMusic, setHasFetchedAppleMusic] = useState(false);
  const [isSearchingSongs, setIsSearchingSongs] = useState(false);
  const [songSearchError, setSongSearchError] = useState("");

  const deferredQuery = useDeferredValue(query);
  const normalizedQuery = normalizeSearchValue(deferredQuery);
  const selectedArtistQuery = normalizeSearchValue(selectedArtistName);
  const localResults = useMemo<SearchResult[]>(() => {
    const songs = songLibrary.filter((song) => {
      if (!normalizedQuery) {
        return true;
      }

      return `${song.title} ${song.artist}`.toLowerCase().includes(normalizedQuery);
    });
    const artistMap = new Map<string, SearchArtist>();

    songLibrary.forEach((song) => {
      const key = song.artist.toLowerCase();
      if (!artistMap.has(key) && (!normalizedQuery || song.artist.toLowerCase().includes(normalizedQuery))) {
        artistMap.set(key, {
          result_type: "artist",
          id: `artist-${key}`,
          name: song.artist,
          image_url: song.imageUri,
          artist_type: "Artist",
          external_source: "local",
        });
      }
    });

    return [...artistMap.values(), ...songs.map((song) => ({ ...song, result_type: "song" as const }))];
  }, [normalizedQuery]);
  const shouldShowAppleMusicResults = normalizedQuery.length >= 2 && hasFetchedAppleMusic && !songSearchError;
  const filteredResults = shouldShowAppleMusicResults ? musicSearchResults : localResults;
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
  const songResults = selectedArtistQuery
    ? artistFilteredSongs
    : filteredSongs.filter((song) => !topResult || !isSongResult(topResult) || song.id !== topResult.id);
  const artistResults = selectedArtistQuery
    ? []
    : filteredResults.filter(isArtistResult).filter((artist) => !topResult || !isArtistResult(topResult) || artist.id !== topResult.id);
  const hasVisibleResults = selectedArtistQuery ? artistFilteredSongs.length > 0 : filteredResults.length > 0;
  const bidAmount = selectedAmount === customAmountValue ? customAmount : selectedAmount;
  const bidCents = Math.max(Number(bidAmount || 0), 0) * 100;
  const canSubmit = Boolean(selectedSong) && Number.isFinite(bidCents) && bidCents >= activeSession.requestFloorCents;

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

      const resultLimit = selectedArtistName ? 25 : 12;
      const searchUrl = `${apiBaseUrl}/songs/search?q=${encodeURIComponent(normalizedQuery)}&limit=${resultLimit}${
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
    }, 1000);

    return () => {
      controller.abort();
      clearTimeout(searchTimeout);
    };
  }, [normalizedQuery, selectedArtistName]);

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

  function handleAddMoney(requestId: string) {
    setRequests((current) =>
      current.map((request) =>
        request.id === requestId && request.status === "Open"
          ? {
              ...request,
              totalCents: request.totalCents + 500,
              myContributionCents: request.myContributionCents + 500,
            }
          : request,
      ),
    );
  }

  function handleCancel(requestId: string) {
    setRequests((current) =>
      current.map((request) =>
        request.id === requestId
          ? {
              ...request,
              status: "Canceled",
              canCancel: false,
            }
          : request,
      ),
    );
  }

  function handleSubmitRequest() {
    if (!selectedSong || !canSubmit) {
      return;
    }

    setRequests((current) => [
      {
        id: `request-${Date.now()}`,
        title: selectedSong.title,
        artist: selectedSong.artist,
        imageUri: getSongImageUri(selectedSong),
        venue: activeSession.venue,
        totalCents: bidCents,
        myContributionCents: bidCents,
        status: "Open",
        canCancel: true,
      },
      ...current,
    ]);
    setQuery("");
    setSelectedSongId("");
    setSelectedAmount("10");
    setCustomAmount("");
  }

  return (
    <ScreenShell contentContainerStyle={styles.content}>
      <View style={styles.searchHeader}>
        <Text style={styles.searchLabel}>search songs and place bids</Text>
        <Tag label={`Min ${formatUsd(activeSession.requestFloorCents)}`} tone="gold" icon="wallet-outline" />
      </View>

      <View style={styles.searchBar}>
        <Ionicons name="search" size={18} color={premiumTheme.colors.inkMuted} />
        <TextInput
          value={query}
          onChangeText={handleChangeQuery}
          placeholder="Search by song or artist"
          placeholderTextColor="#8F9099"
          style={styles.searchInput}
        />
      </View>

      <Text style={styles.sessionNote}>{`${activeSession.djName} is live at ${activeSession.venue}.`}</Text>
      {isSearchingSongs ? <Text style={styles.sessionNote}>Searching Apple Music...</Text> : null}
      {shouldShowAppleMusicResults ? (
        <Text style={styles.sessionNote}>{`${musicSearchResults.length} Apple Music result${
          musicSearchResults.length === 1 ? "" : "s"
        }`}</Text>
      ) : null}
      {songSearchError ? <Text style={styles.searchError}>{songSearchError}</Text> : null}

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

      {!hasVisibleResults ? (
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
            disabled={!canSubmit}
            onPress={handleSubmitRequest}
            style={[styles.cta, !canSubmit && styles.ctaDisabled]}
          >
            <Text style={styles.ctaText}>Place bid</Text>
            <Ionicons name="arrow-forward" size={18} color={premiumTheme.colors.background} />
          </Pressable>
        </SurfaceCard>
      ) : null}

      <SectionTitle title="My requests" subtitle="Add money to open songs or cancel while they are still eligible." />
      <View style={styles.requestList}>
        {requests.map((request) => (
          <SurfaceCard key={request.id}>
            <View style={styles.requestTop}>
              <View style={styles.requestTitleWrap}>
                <Image
                  source={{
                    uri: request.imageUri ?? songLibrary.find((song) => song.title === request.title)?.imageUri ?? unsplashImages.queueAccent,
                  }}
                  style={styles.requestImage}
                />
                <View>
                  <Text style={styles.requestTitle}>{request.title}</Text>
                  <Text style={styles.requestSubtitle}>{`${request.artist} · ${request.venue}`}</Text>
                </View>
              </View>
              <Tag
                label={request.status}
                tone={request.status === "Open" ? "mint" : request.status === "Canceled" ? "coral" : "slate"}
              />
            </View>
            <View style={styles.requestMetaRow}>
              <Text style={styles.requestMeta}>{`Total ${formatUsd(request.totalCents)}`}</Text>
              <Text style={styles.requestMeta}>{`You ${formatUsd(request.myContributionCents)}`}</Text>
            </View>
            <View style={styles.requestButtons}>
              <Pressable
                disabled={request.status !== "Open"}
                onPress={() => handleAddMoney(request.id)}
                style={[styles.smallButton, request.status !== "Open" && styles.smallButtonDisabled]}
              >
                <Text style={styles.smallButtonText}>Add $5</Text>
              </Pressable>
              <Pressable
                disabled={!request.canCancel}
                onPress={() => handleCancel(request.id)}
                style={[styles.ghostButton, !request.canCancel && styles.smallButtonDisabled]}
              >
                <Text style={styles.ghostButtonText}>Cancel</Text>
              </Pressable>
            </View>
          </SurfaceCard>
        ))}
      </View>
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
  ghostButton: {
    alignItems: "center",
    borderColor: premiumTheme.colors.border,
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: "center",
    minWidth: 96,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  ghostButtonText: {
    color: premiumTheme.colors.ink,
    fontFamily: premiumTheme.fonts.body,
    fontSize: 14,
    fontWeight: "700",
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
    gap: 10,
  },
  requestImage: {
    borderRadius: 14,
    height: 56,
    width: 56,
  },
  requestList: {
    gap: 14,
  },
  requestMeta: {
    color: premiumTheme.colors.inkMuted,
    fontFamily: premiumTheme.fonts.body,
    fontSize: 13,
    fontWeight: "600",
  },
  requestMetaRow: {
    flexDirection: "row",
    gap: 16,
  },
  requestSubtitle: {
    color: premiumTheme.colors.inkMuted,
    fontFamily: premiumTheme.fonts.body,
    fontSize: 13,
  },
  requestTitle: {
    color: premiumTheme.colors.ink,
    fontFamily: premiumTheme.fonts.display,
    fontSize: 20,
    fontWeight: "700",
  },
  requestTitleWrap: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
  },
  requestTop: {
    alignItems: "flex-start",
    flexDirection: "row",
    justifyContent: "space-between",
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
    backgroundColor: premiumTheme.colors.surfaceElevated,
    borderColor: premiumTheme.colors.border,
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  searchHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  searchInput: {
    color: premiumTheme.colors.ink,
    flex: 1,
    fontFamily: premiumTheme.fonts.body,
    fontSize: 16,
  },
  searchError: {
    color: premiumTheme.colors.coral,
    fontFamily: premiumTheme.fonts.body,
    fontSize: 13,
    fontWeight: "600",
  },
  searchLabel: {
    color: premiumTheme.colors.inkMuted,
    fontFamily: premiumTheme.fonts.body,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.4,
    textTransform: "lowercase",
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
    minWidth: 96,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  smallButtonDisabled: {
    backgroundColor: "#5C5E6C",
    borderColor: "transparent",
  },
  smallButtonText: {
    color: premiumTheme.colors.text,
    fontFamily: premiumTheme.fonts.body,
    fontSize: 14,
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
