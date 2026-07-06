import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, router, type Href } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { apiRoutes } from "@rqst/contracts";
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import { SurfaceCard, premiumTheme } from "../../components/premium-ui";
import {
  listDiscoverDjs,
  listDiscoverVenues,
  type DiscoverDj,
  type DiscoverVenue,
} from "../../lib/discover-api";
import { rqstApi } from "../../lib/rqst-api";
import { useAppStore } from "../../store/app";

type ViewMode = "search" | "browse";
type BrowseTab = "djs" | "venues";

type LiveSessionSummary = {
  id: number;
  venueId: number;
};

const COPY = {
  searchPlaceholder: "Search DJs, artists, and venues",
  filterPlaceholder: "Filter DJs, artists, and venues",
  liveSearchPlaceholder: "Search live DJs, artists, and venues",
  liveFilterPlaceholder: "Filter live DJs, artists, and venues",
  djsArtistsLabel: "DJs & artists",
  venuesLabel: "Venues",
  emptySearch: "No DJs, artists, or venues match that search yet.",
  emptyBrowse: "No registered DJs, artists, or venues match that filter yet.",
  emptyLiveSearch: "No live DJs, artists, or venues match that search yet.",
  emptyLiveBrowse: "No live DJs, artists, or venues match that filter yet.",
} as const;

function DjResultRow({
  dj,
  onLiveSessionSelected,
  hideActions = false,
  selectOnly = false,
}: {
  dj: DiscoverDj;
  onLiveSessionSelected?: () => void;
  hideActions?: boolean;
  selectOnly?: boolean;
}) {
  const setSelectedSession = useAppStore((state) => state.setSelectedSession);

  function openQueue() {
    if (!dj.liveSessionId) {
      return;
    }

    setSelectedSession({
      sessionId: dj.liveSessionId,
      djName: dj.artistName,
      venueName: dj.venueName ?? "Live venue",
      slug: dj.slug,
    });
    onLiveSessionSelected?.();
    if (!selectOnly) {
      router.push("/(tabs)/list" as Href);
    }
  }

  const canSelect = dj.isLive && Boolean(dj.liveSessionId);

  if (hideActions) {
    return (
      <Pressable
        accessibilityLabel={`Open ${dj.artistName} live queue`}
        disabled={!canSelect}
        onPress={openQueue}
        style={[styles.resultRow, !canSelect && styles.resultRowDisabled]}
      >
        <Image source={{ uri: dj.imageUri }} style={styles.resultAvatar} />
        <View style={styles.resultCopy}>
          <Text style={styles.resultTitle}>{dj.artistName}</Text>
          <Text numberOfLines={1} style={styles.resultSubtitle}>
            {dj.detail}
          </Text>
        </View>
        {canSelect ? <Ionicons color={premiumTheme.colors.muted} name="chevron-forward" size={18} /> : null}
      </Pressable>
    );
  }

  return (
    <View style={styles.resultRow}>
      <Image source={{ uri: dj.imageUri }} style={styles.resultAvatar} />
      <View style={styles.resultCopy}>
        <Text style={styles.resultTitle}>{dj.artistName}</Text>
        <Text numberOfLines={1} style={styles.resultSubtitle}>
          {dj.detail}
        </Text>
      </View>
      <View style={styles.resultActions}>
        <Link href={`/dj?slug=${encodeURIComponent(dj.slug)}` as Href} asChild>
          <Pressable accessibilityLabel={`Open ${dj.artistName} profile`} style={styles.resultActionButton}>
            <Ionicons color={premiumTheme.colors.ink} name="person-outline" size={12} />
            <Text style={styles.resultActionText}>Profile</Text>
          </Pressable>
        </Link>
        {dj.isLive && dj.liveSessionId ? (
          <Pressable
            accessibilityLabel={`Open ${dj.artistName} live queue`}
            onPress={openQueue}
            style={[styles.resultActionButton, styles.resultActionButtonPrimary]}
          >
            <Ionicons color="#FFFFFF" name="list-outline" size={12} />
            <Text style={[styles.resultActionText, styles.resultActionTextPrimary]}>List</Text>
          </Pressable>
        ) : (
          <View style={styles.playingSoonButton}>
            <Text style={styles.playingSoonText}>Playing soon</Text>
          </View>
        )}
      </View>
    </View>
  );
}

function VenueResultRow({
  venue,
  onVenuePress,
}: {
  venue: DiscoverVenue;
  onVenuePress?: (venue: DiscoverVenue) => void;
}) {
  if (onVenuePress) {
    return (
      <Pressable onPress={() => onVenuePress(venue)} style={styles.resultRow}>
        <Image source={{ uri: venue.imageUri }} style={styles.resultAvatar} />
        <View style={styles.resultCopy}>
          <Text style={styles.resultTitle}>{venue.name}</Text>
          <Text numberOfLines={1} style={styles.resultSubtitle}>
            {venue.detail}
          </Text>
        </View>
        <Ionicons color={premiumTheme.colors.muted} name="chevron-forward" size={18} />
      </Pressable>
    );
  }

  return (
    <Link href="/(tabs)/find" asChild>
      <Pressable style={styles.resultRow}>
        <Image source={{ uri: venue.imageUri }} style={styles.resultAvatar} />
        <View style={styles.resultCopy}>
          <Text style={styles.resultTitle}>{venue.name}</Text>
          <Text numberOfLines={1} style={styles.resultSubtitle}>
            {venue.detail}
          </Text>
        </View>
        <Ionicons color={premiumTheme.colors.muted} name="chevron-forward" size={18} />
      </Pressable>
    </Link>
  );
}

type DirectorySearchProps = {
  variant?: "default" | "overlay";
  defaultViewMode?: ViewMode;
  hideDjActions?: boolean;
  liveOnly?: boolean;
  selectOnly?: boolean;
  trailingAction?: ReactNode;
  onVenuePress?: (venue: DiscoverVenue) => void;
  onLiveSessionSelected?: () => void;
  style?: StyleProp<ViewStyle>;
};

export function DirectorySearch({
  variant = "default",
  defaultViewMode = "search",
  hideDjActions = false,
  liveOnly = false,
  selectOnly = false,
  trailingAction,
  onVenuePress,
  onLiveSessionSelected,
  style,
}: DirectorySearchProps) {
  const setSelectedSession = useAppStore((state) => state.setSelectedSession);
  const [viewMode, setViewMode] = useState<ViewMode>(defaultViewMode);
  const [browseTab, setBrowseTab] = useState<BrowseTab>("djs");
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => clearTimeout(timer);
  }, [query]);

  const shouldFetch = viewMode === "browse" || debouncedQuery.length > 0;

  const djsQuery = useQuery({
    queryKey: ["discover", "djs", viewMode, debouncedQuery],
    queryFn: () => listDiscoverDjs(debouncedQuery || undefined),
    enabled: shouldFetch,
    staleTime: 30_000,
    refetchOnMount: "always",
  });
  const venuesQuery = useQuery({
    queryKey: ["discover", "venues", viewMode, debouncedQuery],
    queryFn: () => listDiscoverVenues(debouncedQuery || undefined),
    enabled: shouldFetch,
    staleTime: 30_000,
    refetchOnMount: "always",
  });
  const liveSessionsQuery = useQuery({
    queryKey: ["liveSessions"],
    queryFn: () =>
      rqstApi<LiveSessionSummary[]>(apiRoutes.sessionsNearby.replace("/api/v1", ""), { auth: false }),
    enabled: liveOnly && shouldFetch,
    staleTime: 30_000,
    refetchOnMount: "always",
  });

  const liveVenueIds = useMemo(
    () => new Set((liveSessionsQuery.data ?? []).map((session) => session.venueId)),
    [liveSessionsQuery.data],
  );

  const filteredDjs = djsQuery.data ?? [];
  const filteredVenues = venuesQuery.data ?? [];
  const visibleDjs = useMemo(
    () => (liveOnly ? filteredDjs.filter((dj) => dj.isLive && dj.liveSessionId) : filteredDjs),
    [filteredDjs, liveOnly],
  );
  const visibleVenues = useMemo(
    () => (liveOnly ? filteredVenues.filter((venue) => liveVenueIds.has(venue.id)) : filteredVenues),
    [filteredVenues, liveOnly, liveVenueIds],
  );

  const showResults = viewMode === "browse" || query.trim().length > 0;
  const searchResultCount = visibleDjs.length + visibleVenues.length;
  const resultsLabel =
    viewMode === "browse"
      ? browseTab === "djs"
        ? liveOnly
          ? `${visibleDjs.length} live DJ${visibleDjs.length === 1 ? "" : "s"} and artist${visibleDjs.length === 1 ? "" : "s"}`
          : `${visibleDjs.length} DJ${visibleDjs.length === 1 ? "" : "s"} and artist${visibleDjs.length === 1 ? "" : "s"} on RQST`
        : liveOnly
          ? `${visibleVenues.length} live venue${visibleVenues.length === 1 ? "" : "s"}`
          : `${visibleVenues.length} venue${visibleVenues.length === 1 ? "" : "s"} on RQST`
      : liveOnly
        ? `${searchResultCount} live match${searchResultCount === 1 ? "" : "es"}`
        : `${searchResultCount} match${searchResultCount === 1 ? "" : "es"}`;

  const isOverlay = variant === "overlay";
  const isLoading =
    djsQuery.isLoading || venuesQuery.isLoading || (liveOnly && liveSessionsQuery.isLoading);
  const emptySearchCopy = liveOnly ? COPY.emptyLiveSearch : COPY.emptySearch;
  const emptyBrowseCopy = liveOnly ? COPY.emptyLiveBrowse : COPY.emptyBrowse;
  const searchPlaceholder = liveOnly ? COPY.liveSearchPlaceholder : COPY.searchPlaceholder;
  const filterPlaceholder = liveOnly ? COPY.liveFilterPlaceholder : COPY.filterPlaceholder;

  function handleVenuePress(venue: DiscoverVenue) {
    if (liveOnly) {
      const session = liveSessionsQuery.data?.find((item) => item.venueId === venue.id);
      const dj = filteredDjs.find((item) => item.liveSessionId === session?.id);
      if (!session || !dj) {
        return;
      }

      setSelectedSession({
        sessionId: session.id,
        djName: dj.artistName,
        venueName: venue.name,
        slug: dj.slug,
      });
      onLiveSessionSelected?.();
      return;
    }

    onVenuePress?.(venue);
  }

  const venuePressHandler = liveOnly || onVenuePress ? handleVenuePress : undefined;

  function renderSearchResults() {
    return (
      <>
        {visibleDjs.length > 0 ? (
          <View style={styles.resultSection}>
            <Text style={styles.resultSectionLabel}>{COPY.djsArtistsLabel}</Text>
            {visibleDjs.map((dj) => (
              <DjResultRow
                key={dj.id}
                dj={dj}
                hideActions={hideDjActions}
                onLiveSessionSelected={onLiveSessionSelected}
                selectOnly={selectOnly}
              />
            ))}
          </View>
        ) : null}
        {visibleVenues.length > 0 ? (
          <View style={styles.resultSection}>
            <Text style={styles.resultSectionLabel}>{COPY.venuesLabel}</Text>
            {visibleVenues.map((venue) => (
              <VenueResultRow key={venue.id} onVenuePress={venuePressHandler} venue={venue} />
            ))}
          </View>
        ) : null}
      </>
    );
  }

  function toggleBrowseMode() {
    setViewMode((current) => (current === "browse" ? "search" : "browse"));
  }

  return (
    <View style={[styles.wrap, style]}>
      <View style={styles.searchRow}>
        <View style={[styles.searchField, isOverlay && styles.searchFieldOverlay]}>
          <View style={styles.searchIcon}>
            <Ionicons color={premiumTheme.colors.ink} name="search" size={18} />
          </View>
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            clearButtonMode="while-editing"
            onChangeText={setQuery}
            placeholder={viewMode === "browse" ? filterPlaceholder : searchPlaceholder}
            placeholderTextColor={premiumTheme.colors.inkMuted}
            style={styles.searchInput}
            value={query}
          />
          <Pressable
            accessibilityLabel={viewMode === "browse" ? "Switch to search mode" : "Show full directory"}
            accessibilityRole="button"
            onPress={toggleBrowseMode}
            style={[styles.listAction, viewMode === "browse" && styles.listActionActive]}
          >
            <Ionicons
              color={viewMode === "browse" ? "#FFFFFF" : premiumTheme.colors.ink}
              name={viewMode === "browse" ? "list" : "list-outline"}
              size={18}
            />
          </Pressable>
        </View>
        {trailingAction}
      </View>

      {viewMode === "browse" ? (
        <View style={styles.toggleRow}>
          <Pressable
            accessibilityRole="button"
            onPress={() => setBrowseTab("djs")}
            style={[styles.togglePill, browseTab === "djs" && styles.togglePillActive]}
          >
            <Ionicons
              color={browseTab === "djs" ? "#FFFFFF" : premiumTheme.colors.ink}
              name="musical-notes-outline"
              size={14}
            />
            <Text style={[styles.togglePillText, browseTab === "djs" && styles.togglePillTextActive]}>
              {COPY.djsArtistsLabel}
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => setBrowseTab("venues")}
            style={[styles.togglePill, browseTab === "venues" && styles.togglePillActive]}
          >
            <Ionicons
              color={browseTab === "venues" ? "#FFFFFF" : premiumTheme.colors.ink}
              name="business-outline"
              size={14}
            />
            <Text style={[styles.togglePillText, browseTab === "venues" && styles.togglePillTextActive]}>
              {COPY.venuesLabel}
            </Text>
          </Pressable>
        </View>
      ) : null}

      {showResults ? (
        <SurfaceCard style={[styles.resultsCard, isOverlay && styles.resultsCardOverlay]}>
          <View style={styles.resultsHeader}>
            <Text style={styles.resultsEyebrow}>
              {liveOnly ? "Live on RQST" : viewMode === "browse" ? "Registered on RQST" : "Search results"}
            </Text>
            <Text style={styles.resultsCount}>{resultsLabel}</Text>
          </View>

          {isLoading ? (
            <Text style={styles.emptyState}>Loading directory...</Text>
          ) : djsQuery.isError || venuesQuery.isError || liveSessionsQuery.isError ? (
            <Text style={styles.emptyState}>Could not reach the RQST API. Make sure the backend is running.</Text>
          ) : viewMode === "search" && searchResultCount === 0 ? (
            <Text style={styles.emptyState}>{emptySearchCopy}</Text>
          ) : viewMode === "browse" && (browseTab === "venues" ? visibleVenues : visibleDjs).length === 0 ? (
            <Text style={styles.emptyState}>{emptyBrowseCopy}</Text>
          ) : (
            <ScrollView
              keyboardShouldPersistTaps="handled"
              nestedScrollEnabled
              showsVerticalScrollIndicator={false}
              style={isOverlay ? styles.resultsScrollOverlay : undefined}
            >
              {viewMode === "search"
                ? renderSearchResults()
                : browseTab === "venues"
                  ? visibleVenues.map((venue) => (
                      <VenueResultRow key={venue.id} onVenuePress={venuePressHandler} venue={venue} />
                    ))
                  : visibleDjs.map((dj) => (
                      <DjResultRow
                        key={dj.id}
                        dj={dj}
                        hideActions={hideDjActions}
                        onLiveSessionSelected={onLiveSessionSelected}
                        selectOnly={selectOnly}
                      />
                    ))}
            </ScrollView>
          )}
        </SurfaceCard>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  emptyState: {
    color: premiumTheme.colors.inkMuted,
    fontFamily: premiumTheme.fonts.body,
    fontSize: 14,
    lineHeight: 20,
    paddingVertical: 8,
  },
  listAction: {
    alignItems: "center",
    backgroundColor: "rgba(224, 90, 71, 0.08)",
    borderRadius: 16,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  listActionActive: {
    backgroundColor: premiumTheme.colors.coral,
  },
  resultAvatar: {
    borderColor: "rgba(255,255,255,0.72)",
    borderRadius: 18,
    borderWidth: 1,
    height: 44,
    width: 44,
  },
  resultCopy: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  resultActions: {
    alignItems: "center",
    flexDirection: "row",
    flexShrink: 0,
    gap: 6,
  },
  resultActionButton: {
    alignItems: "center",
    backgroundColor: "#F7F5F2",
    borderColor: premiumTheme.colors.border,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  resultActionButtonPrimary: {
    backgroundColor: premiumTheme.colors.coral,
    borderColor: premiumTheme.colors.coral,
  },
  resultActionText: {
    color: premiumTheme.colors.ink,
    fontFamily: premiumTheme.fonts.body,
    fontSize: 9,
    fontWeight: "700",
  },
  resultActionTextPrimary: {
    color: "#FFFFFF",
  },
  playingSoonButton: {
    alignItems: "center",
    backgroundColor: "#2F5FBE",
    borderColor: "#2F5FBE",
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: "center",
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  playingSoonText: {
    color: "#FFFFFF",
    fontFamily: premiumTheme.fonts.body,
    fontSize: 9,
    fontWeight: "700",
  },
  resultRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    paddingVertical: 10,
  },
  resultRowDisabled: {
    opacity: 0.55,
  },
  resultSection: {
    gap: 2,
  },
  resultSectionLabel: {
    color: premiumTheme.colors.inkMuted,
    fontFamily: premiumTheme.fonts.body,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.8,
    marginBottom: 2,
    marginTop: 4,
    textTransform: "uppercase",
  },
  resultSubtitle: {
    color: premiumTheme.colors.inkMuted,
    fontFamily: premiumTheme.fonts.body,
    fontSize: 13,
    lineHeight: 18,
  },
  resultTitle: {
    color: premiumTheme.colors.ink,
    fontFamily: premiumTheme.fonts.display,
    fontSize: 17,
    fontWeight: "700",
    lineHeight: 22,
  },
  resultsCard: {
    gap: 4,
  },
  resultsCardOverlay: {
    maxHeight: 280,
  },
  resultsCount: {
    color: premiumTheme.colors.inkMuted,
    fontFamily: premiumTheme.fonts.body,
    fontSize: 12,
    fontWeight: "700",
  },
  resultsEyebrow: {
    color: premiumTheme.colors.inkMuted,
    fontFamily: premiumTheme.fonts.body,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.1,
    textTransform: "uppercase",
  },
  resultsHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  resultsScrollOverlay: {
    maxHeight: 220,
  },
  searchField: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderColor: premiumTheme.colors.border,
    borderRadius: premiumTheme.radii.md,
    borderWidth: 1.5,
    flex: 1,
    flexDirection: "row",
    gap: 14,
    padding: 12,
    shadowColor: "#5A6575",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.1,
    shadowRadius: 22,
  },
  searchFieldOverlay: {
    shadowOpacity: 0.18,
    shadowRadius: 18,
  },
  searchIcon: {
    alignItems: "center",
    backgroundColor: "rgba(224, 90, 71, 0.08)",
    borderRadius: 16,
    borderColor: "rgba(224, 90, 71, 0.14)",
    borderWidth: 1,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  searchInput: {
    color: premiumTheme.colors.ink,
    flex: 1,
    fontFamily: premiumTheme.fonts.display,
    fontSize: 15,
    fontWeight: "600",
    minHeight: 44,
    paddingVertical: 0,
  },
  searchRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 12,
  },
  togglePill: {
    alignItems: "center",
    backgroundColor: "#F7F5F2",
    borderColor: premiumTheme.colors.border,
    borderRadius: 999,
    borderWidth: 1,
    flex: 1,
    flexDirection: "row",
    gap: 6,
    justifyContent: "center",
    minHeight: 42,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  togglePillActive: {
    backgroundColor: premiumTheme.colors.coral,
    borderColor: premiumTheme.colors.coral,
  },
  togglePillText: {
    color: premiumTheme.colors.ink,
    fontFamily: premiumTheme.fonts.body,
    fontSize: 13,
    fontWeight: "700",
  },
  togglePillTextActive: {
    color: "#FFFFFF",
  },
  toggleRow: {
    flexDirection: "row",
    gap: 10,
  },
  wrap: {
    gap: 12,
  },
});
