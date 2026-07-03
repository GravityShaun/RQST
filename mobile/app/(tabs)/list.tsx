import { useMemo, useState } from "react";
import { Link, router, type Href } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type StyleProp, type ViewStyle } from "react-native";
import { formatUsd } from "@rqst/shared-config";
import { apiRouteBuilders, type SongRequestSummary } from "@rqst/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";

import { ScreenShell, SectionTitle, SurfaceCard, Tag, premiumTheme } from "../../src/components/premium-ui";
import { activeSession, liveQueue, type QueueItem, type RequesterContribution } from "../../src/features/rqst/mock-data";
import { hasApiAccessToken, rqstApi, type ContributionCreatePayload } from "../../src/lib/rqst-api";
import { unsplashImages } from "../../src/lib/unsplash";

const quickAmounts = [5, 10, 15, 20, 25, 50];
type SortKey = "song" | "price" | "rqsts";
type SortDirection = "asc" | "desc";
type RequesterSortKey = "chronological" | "price";

function mapBackendQueueItem(request: SongRequestSummary, index: number): QueueItem {
  const mappedContributors = request.contributors.map<RequesterContribution>((contributor) => ({
    id: String(contributor.userId),
    name: contributor.displayName,
    handle: `@${contributor.displayName.toLowerCase().replace(/[^a-z0-9]+/g, "") || "rqst"}`,
    imageUri: contributor.avatarUrl ?? unsplashImages.djPortrait,
    bio: "",
    neighborhood: "",
    favoriteGenres: [],
    requestsMade: 0,
    boostsGiven: 0,
    topSong: request.songTitle ?? "Requested song",
    paidCents: contributor.amountCents,
  }));
  const fallbackRequester: RequesterContribution = {
    id: String(request.requestedByUserId),
    name: request.requesterDisplayName ?? "RQST listener",
    handle: "@rqst",
    imageUri: request.requesterAvatarUrl ?? unsplashImages.djPortrait,
    bio: "",
    neighborhood: "",
    favoriteGenres: [],
    requestsMade: 0,
    boostsGiven: 0,
    topSong: request.songTitle ?? "Requested song",
    paidCents: request.originalAmountCents,
  };
  const requestedBy = mappedContributors.length ? mappedContributors : [fallbackRequester];

  return {
    id: String(request.id),
    rank: index + 1,
    title: request.songTitle ?? `Song #${request.songId}`,
    artist: request.songArtist ?? "Unknown artist",
    totalCents: request.totalAmountCents || request.originalAmountCents,
    contributors: request.contributorCount || requestedBy.length,
    requestedBy,
    status: request.status === "pending_payment" ? "Pending" : request.status === "open" ? "Open" : request.status,
    momentum: request.createdAt,
    imageUri: request.songAlbumArtUrl ?? undefined,
    uploadedBy:
      requestedBy[0] ??
      fallbackRequester,
  };
}

export default function ListScreen() {
  const queryClient = useQueryClient();
  const [selectedSongId, setSelectedSongId] = useState<string | null>(null);
  const [selectedRequesterSongId, setSelectedRequesterSongId] = useState<string | null>(null);
  const [selectedAmount, setSelectedAmount] = useState("10");
  const [customAmount, setCustomAmount] = useState("");
  const [localQueue, setLocalQueue] = useState(liveQueue);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("price");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [requesterSortKey, setRequesterSortKey] = useState<RequesterSortKey>("chronological");
  const [requesterSortDirection, setRequesterSortDirection] = useState<SortDirection>("asc");
  const sessionId = activeSession.id;
  const sessionRequestsQuery = useQuery({
    queryKey: ["sessionRequests", sessionId],
    queryFn: () => rqstApi<SongRequestSummary[]>(apiRouteBuilders.sessionRequests(sessionId).replace("/api/v1", ""), { auth: false }),
    retry: false,
  });
  const contributeMutation = useMutation({
    mutationFn: ({ requestId, amountCents }: { requestId: string; amountCents: number }) =>
      rqstApi<SongRequestSummary>(apiRouteBuilders.contributeToRequest(requestId).replace("/api/v1", ""), {
        method: "POST",
        body: JSON.stringify({ amount_cents: amountCents } satisfies ContributionCreatePayload),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sessionRequests", sessionId] });
      queryClient.invalidateQueries({ queryKey: ["meRequests"] });
    },
    retry: false,
  });
  const queue = sessionRequestsQuery.data?.map(mapBackendQueueItem) ?? localQueue;

  const sortedQueue = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    const filteredQueue = normalizedQuery
      ? queue.filter((item) =>
          [
            item.title,
            item.artist,
            ...item.requestedBy.map((requester) => requester.name),
            String(item.requestedBy.length),
            formatUsd(item.totalCents),
          ]
            .join(" ")
            .toLowerCase()
            .includes(normalizedQuery),
        )
      : queue;

    return [...filteredQueue].sort((left, right) => {
      const directionMultiplier = sortDirection === "asc" ? 1 : -1;
      const fallbackSort = left.rank - right.rank;
      let result = 0;

      if (sortKey === "song") {
        result = `${left.title} ${left.artist}`.localeCompare(`${right.title} ${right.artist}`);
      } else if (sortKey === "rqsts") {
        result = left.requestedBy.length - right.requestedBy.length;
      } else {
        result = left.totalCents - right.totalCents;
      }

      return result === 0 ? fallbackSort : result * directionMultiplier;
    });
  }, [queue, searchQuery, sortDirection, sortKey]);

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
  const canSubmitContribution = Boolean(selectedSong) && selectedSong?.status === "Open" && modalAmountCents > 0;
  const handleSubmitContribution = async () => {
    if (!selectedSong || !canSubmitContribution) {
      return;
    }

    const numericRequestId = Number(selectedSong.id);
    if (hasApiAccessToken && Number.isInteger(numericRequestId)) {
      try {
        await contributeMutation.mutateAsync({ requestId: selectedSong.id, amountCents: modalAmountCents });
        setSelectedSongId(null);
        return;
      } catch {
        // Keep local demo mode responsive when auth/backend checkout is unavailable.
      }
    }

    setLocalQueue((currentQueue) =>
      currentQueue.map((item) =>
        item.id === selectedSong.id
          ? {
              ...item,
              totalCents: item.totalCents + modalAmountCents,
            }
          : item,
      ),
    );
    setSelectedSongId(null);
  };
  const openRequesters = (itemId: string) => {
    const item = queue.find((queueItem) => queueItem.id === itemId);
    if (!item) {
      return;
    }

    if (item.requestedBy.length === 0) {
      return;
    }

    if (item.requestedBy.length === 1) {
      router.push(`/profile/${item.requestedBy[0].id}` as Href);
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
          color={sortKey === key ? "#C95A52" : premiumTheme.colors.inkMuted}
        />
      ) : null}
    </Pressable>
  );

  return (
    <ScreenShell contentContainerStyle={styles.screenContent}>
      <View style={styles.contentInset}>
        <View style={styles.topBar}>
          <View style={styles.topBarLeft}>
            <Pressable style={[styles.circleButton, styles.circleButtonLight]}>
              <Ionicons name="sparkles" size={20} color={premiumTheme.colors.background} />
            </Pressable>
            <Pressable
              accessibilityLabel="Search queue"
              accessibilityRole="button"
              onPress={() => setIsSearchOpen((currentValue) => !currentValue)}
              style={[styles.circleButton, isSearchOpen && styles.circleButtonActive]}
            >
              <Ionicons name="search" size={20} color={premiumTheme.colors.ink} />
            </Pressable>
          </View>
          <Tag label={activeSession.venue} tone="gold" icon="location-outline" />
        </View>
      </View>

      {isSearchOpen ? (
        <View style={styles.contentInset}>
          <View style={styles.searchPanel}>
            <Ionicons name="search" size={18} color={premiumTheme.colors.inkMuted} />
            <TextInput
              autoCapitalize="none"
              autoCorrect={false}
              clearButtonMode="while-editing"
              onChangeText={setSearchQuery}
              placeholder="Search songs, artists, requesters"
              placeholderTextColor={premiumTheme.colors.inkMuted}
              style={styles.searchInput}
              value={searchQuery}
            />
            {searchQuery ? (
              <Pressable accessibilityLabel="Clear search" onPress={() => setSearchQuery("")} style={styles.searchClearButton}>
                <Ionicons name="close" size={16} color={premiumTheme.colors.ink} />
              </Pressable>
            ) : null}
          </View>
        </View>
      ) : null}

      <View style={styles.contentInset}>
        <Link href="/dj" asChild>
          <Pressable style={styles.identityPanel}>
            <LinearGradient colors={["#FFD2C8", "#F4B8CF", "#E8D9FF"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.identityPill, styles.identityPillDj]}>
              <Text style={styles.identityEyebrow}>DJ playing</Text>
              <Text style={styles.identityValue}>{activeSession.djName}</Text>
            </LinearGradient>
            <LinearGradient colors={["#CFE8FF", "#D9F3F0"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.identityPill, styles.identityPillVenue]}>
              <Text style={styles.identityEyebrow}>Venue</Text>
            </LinearGradient>
          </Pressable>
        </Link>
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

          {sortedQueue.map((item, index) => (
            <View
              key={item.id}
              style={[styles.tableRow, styles.tableBodyDivider]}
            >
              <Pressable
                accessibilityLabel={
                  item.requestedBy.length === 1
                    ? `Open ${item.requestedBy[0].name}'s profile`
                    : `Show ${item.requestedBy.length} requesters for ${item.title}`
                }
                accessibilityRole="button"
                onPress={() => openRequesters(item.id)}
                style={styles.rqstsButton}
              >
                <Text style={styles.rqstsCell}>{item.requestedBy.length}</Text>
                <Image
                  resizeMode="cover"
                  source={{ uri: item.requestedBy[0]?.imageUri ?? item.uploadedBy.imageUri }}
                  style={styles.requesterAvatar}
                />
              </Pressable>
              <View style={styles.songColumn}>
                <Text style={styles.songTitle}>
                  {item.title}
                </Text>
                <Text style={styles.songArtist} numberOfLines={1}>
                  {item.artist}
                </Text>
              </View>
              <Text style={[styles.tableCell, styles.priceColumn, styles.supportCell]}>
                {formatUsd(item.totalCents)}
              </Text>
              <View style={styles.actionColumn}>
                <Pressable
                  onPress={() => {
                    setSelectedSongId(item.id);
                    setSelectedAmount("10");
                    setCustomAmount("");
                  }}
                  style={styles.arrowButton}
                >
                  <Ionicons name="arrow-up" size={13} color="#C95A52" />
                </Pressable>
              </View>
            </View>
          ))}
          {sortedQueue.length === 0 ? (
            <View style={styles.emptyRow}>
              <Text style={styles.emptyTitle}>No songs found</Text>
              <Text style={styles.emptySubtitle}>Try searching by song, artist, requester, or price.</Text>
            </View>
          ) : null}
        </View>
      </SurfaceCard>

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
                <Ionicons name="close" size={18} color={premiumTheme.colors.ink} />
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
                  placeholderTextColor={premiumTheme.colors.inkMuted}
                  style={styles.customAmountInput}
                  value={customAmount}
                />
              </View>
            </ScrollView>

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
                  {selectedRequesterSong?.requestedBy.length ?? 0} paid rqsts
                </Text>
              </View>
              <Pressable onPress={() => setSelectedRequesterSongId(null)} style={styles.modalCloseButton}>
                <Ionicons name="close" size={18} color={premiumTheme.colors.ink} />
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
                  color={requesterSortKey === "chronological" ? "#A3485B" : premiumTheme.colors.inkMuted}
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
                  color={requesterSortKey === "price" ? "#A3485B" : premiumTheme.colors.inkMuted}
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
                <Link key={requester.id} href={`/profile/${requester.id}` as Href} asChild>
                  <Pressable onPress={() => setSelectedRequesterSongId(null)} style={styles.requesterListItem}>
                    <Image source={{ uri: requester.imageUri }} style={styles.requesterListAvatar} />
                    <View style={styles.requesterListCopy}>
                      <Text style={styles.requesterListName}>{requester.name}</Text>
                      <Text style={styles.requesterListHandle}>{requester.handle}</Text>
                    </View>
                    <Text style={styles.requesterListAmount}>{formatUsd(requester.paidCents)}</Text>
                    <Ionicons name="chevron-forward" size={18} color={premiumTheme.colors.inkMuted} />
                  </Pressable>
                </Link>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  actionColumn: {
    alignItems: "flex-end",
    width: 30,
  },
  amountOption: {
    backgroundColor: premiumTheme.colors.surface,
    borderColor: premiumTheme.colors.border,
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
    color: premiumTheme.colors.ink,
    fontFamily: premiumTheme.fonts.display,
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
    backgroundColor: "#FFFFFF",
    borderColor: "#D98A84",
    borderRadius: 999,
    borderWidth: 1,
    height: 28,
    justifyContent: "center",
    width: 28,
  },
  circleButton: {
    alignItems: "center",
    backgroundColor: "#F7F5F2",
    borderColor: premiumTheme.colors.border,
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
    backgroundColor: "#FFFFFF",
    borderColor: "#E2AAB1",
  },
  customAmountInput: {
    backgroundColor: premiumTheme.colors.surface,
    borderColor: premiumTheme.colors.border,
    borderRadius: 18,
    borderWidth: 1,
    color: premiumTheme.colors.ink,
    fontFamily: premiumTheme.fonts.body,
    fontSize: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  customAmountLabel: {
    color: premiumTheme.colors.inkMuted,
    fontFamily: premiumTheme.fonts.body,
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
  emptyRow: {
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 24,
    paddingVertical: 28,
  },
  emptySubtitle: {
    color: premiumTheme.colors.inkMuted,
    fontFamily: premiumTheme.fonts.body,
    fontSize: 13,
    textAlign: "center",
  },
  emptyTitle: {
    color: premiumTheme.colors.ink,
    fontFamily: premiumTheme.fonts.display,
    fontSize: 16,
    fontWeight: "800",
  },
  identityEyebrow: {
    color: premiumTheme.colors.inkMuted,
    fontFamily: premiumTheme.fonts.body,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  identityPanel: {
    flexDirection: "row",
    gap: 10,
  },
  identityPill: {
    borderColor: premiumTheme.colors.border,
    borderRadius: 999,
    borderWidth: 1,
    gap: 4,
    overflow: "hidden",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  identityPillDj: {
    flex: 0.8,
  },
  identityPillVenue: {
    flex: 0.2,
  },
  identityValue: {
    color: premiumTheme.colors.ink,
    fontFamily: premiumTheme.fonts.display,
    fontSize: 15,
    fontWeight: "700",
  },
  modalBackdrop: {
    backgroundColor: "rgba(30,23,23,0.4)",
    flex: 1,
    justifyContent: "flex-end",
    padding: 16,
  },
  modalCard: {
    backgroundColor: premiumTheme.colors.surfaceElevated,
    borderRadius: 24,
    gap: 14,
    maxHeight: "88%",
    padding: 20,
  },
  modalCloseButton: {
    alignItems: "center",
    backgroundColor: premiumTheme.colors.surface,
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
    color: premiumTheme.colors.text,
    fontFamily: premiumTheme.fonts.body,
    fontSize: 15,
    fontWeight: "800",
  },
  modalEyebrow: {
    color: premiumTheme.colors.inkMuted,
    fontFamily: premiumTheme.fonts.body,
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
    color: premiumTheme.colors.inkMuted,
    fontFamily: premiumTheme.fonts.body,
    fontSize: 14,
  },
  modalTitle: {
    color: premiumTheme.colors.ink,
    fontFamily: premiumTheme.fonts.display,
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
    fontFamily: premiumTheme.fonts.display,
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
    color: premiumTheme.colors.inkMuted,
    fontFamily: premiumTheme.fonts.body,
    fontSize: 13,
  },
  requesterListItem: {
    alignItems: "center",
    backgroundColor: premiumTheme.colors.surface,
    borderColor: premiumTheme.colors.border,
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    padding: 12,
  },
  requesterListName: {
    color: premiumTheme.colors.ink,
    fontFamily: premiumTheme.fonts.display,
    fontSize: 15,
    fontWeight: "800",
  },
  requesterListScroll: {
    maxHeight: 480,
  },
  requesterSortControl: {
    alignSelf: "flex-start",
    backgroundColor: premiumTheme.colors.surface,
    borderColor: premiumTheme.colors.border,
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
    backgroundColor: "#FFFFFF",
    shadowColor: "#5B6474",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
  },
  requesterSortText: {
    color: premiumTheme.colors.inkMuted,
    fontFamily: premiumTheme.fonts.body,
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
    color: premiumTheme.colors.inkMuted,
    fontFamily: premiumTheme.fonts.body,
    fontSize: 12,
    marginTop: 2,
  },
  songColumn: {
    flex: 1,
    minWidth: 0,
    paddingRight: 4,
  },
  songTitle: {
    color: premiumTheme.colors.ink,
    fontFamily: premiumTheme.fonts.display,
    fontSize: 16,
    fontWeight: "700",
    lineHeight: 19,
  },
  rqstsCell: {
    color: "#A3485B",
    fontFamily: premiumTheme.fonts.display,
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
    backgroundColor: premiumTheme.colors.surface,
    borderRadius: 999,
    height: 30,
    justifyContent: "center",
    width: 30,
  },
  searchInput: {
    color: premiumTheme.colors.ink,
    flex: 1,
    fontFamily: premiumTheme.fonts.body,
    fontSize: 15,
    minWidth: 0,
    paddingVertical: 0,
  },
  searchPanel: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderColor: premiumTheme.colors.border,
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
    borderBottomColor: premiumTheme.colors.border,
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
    color: premiumTheme.colors.ink,
    fontFamily: premiumTheme.fonts.body,
    fontSize: 14,
  },
  tableHeaderCell: {
    color: premiumTheme.colors.inkMuted,
    fontFamily: premiumTheme.fonts.body,
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
});
