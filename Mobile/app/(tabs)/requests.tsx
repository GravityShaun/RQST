import { startTransition, useDeferredValue, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { formatUsd } from "@rqst/shared-config";

import { ScreenShell, SectionTitle, SurfaceCard, Tag, premiumTheme } from "../../src/components/premium-ui";
import { activeSession, initialUserRequests, songLibrary } from "../../src/features/rqst/mock-data";

const quickAmounts = ["5", "8", "10", "15"];

export default function RequestsScreen() {
  const [query, setQuery] = useState("");
  const [amount, setAmount] = useState("10");
  const [selectedSongId, setSelectedSongId] = useState(songLibrary[0]?.id ?? "");
  const [requests, setRequests] = useState(initialUserRequests);

  const deferredQuery = useDeferredValue(query);
  const normalizedQuery = deferredQuery.trim().toLowerCase();
  const bidCents = Math.max(Number(amount || 0), 0) * 100;
  const filteredSongs = songLibrary.filter((song) => {
    if (!normalizedQuery) {
      return true;
    }

    return `${song.title} ${song.artist}`.toLowerCase().includes(normalizedQuery);
  });

  const selectedSong =
    filteredSongs.find((song) => song.id === selectedSongId) ??
    songLibrary.find((song) => song.id === selectedSongId) ??
    filteredSongs[0] ??
    songLibrary[0];
  const canSubmit = Boolean(selectedSong) && Number.isFinite(bidCents) && bidCents >= activeSession.requestFloorCents;

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
        venue: activeSession.venue,
        totalCents: bidCents,
        myContributionCents: bidCents,
        status: "Open",
        canCancel: true,
      },
      ...current,
    ]);
    setQuery("");
  }

  return (
    <ScreenShell>
      <View style={styles.topRow}>
        <View>
          <Text style={styles.eyebrow}>Send a request</Text>
          <Text style={styles.title}>What should play?</Text>
        </View>
        <Tag label={`Min ${formatUsd(activeSession.requestFloorCents)}`} tone="gold" icon="wallet-outline" />
      </View>

      <SurfaceCard style={styles.composerCard}>
        <View style={styles.progressRow}>
          <View style={styles.progressActive} />
          <View style={styles.progressActive} />
          <View style={styles.progressInactive} />
        </View>

        <Text style={styles.composerTitle}>Search songs and place your bid</Text>
        <Text style={styles.composerSubtitle}>{`${activeSession.djName} is live at ${activeSession.venue}.`}</Text>

        <View style={styles.inputWrap}>
          <Ionicons name="search" size={18} color={premiumTheme.colors.muted} />
          <TextInput
            value={query}
            onChangeText={(text) => startTransition(() => setQuery(text))}
            placeholder="Artist or song"
            placeholderTextColor="#8F9099"
            style={styles.input}
          />
        </View>

        <View style={styles.songGrid}>
          {filteredSongs.slice(0, 6).map((song, index) => {
            const selected = selectedSong?.id === song.id;

            return (
              <Pressable
                key={song.id}
                onPress={() => setSelectedSongId(song.id)}
                style={[styles.songChip, selected && styles.songChipSelected, index % 3 === 0 && styles.songChipWide]}
              >
                <Text style={[styles.songChipTitle, selected && styles.songChipTitleSelected]}>{song.title}</Text>
                <Text style={[styles.songChipArtist, selected && styles.songChipArtistSelected]}>{song.artist}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.amountTitle}>Choose your amount</Text>
        <View style={styles.amountRow}>
          {quickAmounts.map((value) => {
            const selected = amount === value;
            return (
              <Pressable
                key={value}
                onPress={() => setAmount(value)}
                style={[styles.amountChip, selected && styles.amountChipSelected]}
              >
                <Text style={[styles.amountChipText, selected && styles.amountChipTextSelected]}>{`$${value}`}</Text>
              </Pressable>
            );
          })}
        </View>

        <Pressable disabled={!canSubmit} onPress={handleSubmitRequest} style={[styles.cta, !canSubmit && styles.ctaDisabled]}>
          <Text style={styles.ctaText}>Send request</Text>
          <Ionicons name="arrow-forward" size={18} color={premiumTheme.colors.background} />
        </Pressable>
      </SurfaceCard>

      <SectionTitle title="My requests" subtitle="Add money to open songs or cancel while they are still eligible." />
      <View style={styles.requestList}>
        {requests.map((request) => (
          <SurfaceCard key={request.id}>
            <View style={styles.requestTop}>
              <View>
                <Text style={styles.requestTitle}>{request.title}</Text>
                <Text style={styles.requestSubtitle}>{`${request.artist} · ${request.venue}`}</Text>
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
    backgroundColor: "#484B5E",
    borderRadius: 999,
    justifyContent: "center",
    minWidth: 66,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  amountChipSelected: {
    backgroundColor: "#A7E6F7",
  },
  amountChipText: {
    color: premiumTheme.colors.text,
    fontSize: 15,
    fontWeight: "700",
  },
  amountChipTextSelected: {
    color: premiumTheme.colors.background,
  },
  amountRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  amountTitle: {
    color: premiumTheme.colors.text,
    fontSize: 16,
    fontWeight: "700",
    marginTop: 4,
  },
  composerCard: {
    backgroundColor: "#343748",
    gap: 16,
  },
  composerSubtitle: {
    color: premiumTheme.colors.muted,
    fontSize: 14,
  },
  composerTitle: {
    color: premiumTheme.colors.text,
    fontSize: 32,
    fontWeight: "800",
    lineHeight: 36,
  },
  cta: {
    alignItems: "center",
    alignSelf: "stretch",
    backgroundColor: "#FFFFFF",
    borderRadius: 999,
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    paddingVertical: 16,
  },
  ctaDisabled: {
    backgroundColor: "#9494A1",
  },
  ctaText: {
    color: premiumTheme.colors.background,
    fontSize: 16,
    fontWeight: "800",
  },
  eyebrow: {
    color: premiumTheme.colors.muted,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.2,
    textTransform: "uppercase",
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
    color: premiumTheme.colors.text,
    fontSize: 14,
    fontWeight: "700",
  },
  input: {
    color: premiumTheme.colors.text,
    flex: 1,
    fontSize: 15,
  },
  inputWrap: {
    alignItems: "center",
    backgroundColor: "#45495D",
    borderRadius: 18,
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  progressActive: {
    backgroundColor: "#FFFFFF",
    borderRadius: 999,
    flex: 1,
    height: 4,
  },
  progressInactive: {
    backgroundColor: "#4A4C5A",
    borderRadius: 999,
    flex: 1,
    height: 4,
  },
  progressRow: {
    flexDirection: "row",
    gap: 10,
  },
  requestButtons: {
    flexDirection: "row",
    gap: 10,
  },
  requestList: {
    gap: 14,
  },
  requestMeta: {
    color: premiumTheme.colors.muted,
    fontSize: 13,
    fontWeight: "600",
  },
  requestMetaRow: {
    flexDirection: "row",
    gap: 16,
  },
  requestSubtitle: {
    color: premiumTheme.colors.muted,
    fontSize: 13,
  },
  requestTitle: {
    color: premiumTheme.colors.text,
    fontSize: 20,
    fontWeight: "700",
  },
  requestTop: {
    alignItems: "flex-start",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  smallButton: {
    alignItems: "center",
    backgroundColor: premiumTheme.colors.text,
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
    color: premiumTheme.colors.background,
    fontSize: 14,
    fontWeight: "700",
  },
  songChip: {
    backgroundColor: "#4A4D60",
    borderRadius: 22,
    gap: 4,
    padding: 14,
    width: "48%",
  },
  songChipArtist: {
    color: premiumTheme.colors.muted,
    fontSize: 12,
  },
  songChipArtistSelected: {
    color: premiumTheme.colors.background,
  },
  songChipSelected: {
    backgroundColor: "#A7E6F7",
  },
  songChipTitle: {
    color: premiumTheme.colors.text,
    fontSize: 15,
    fontWeight: "700",
  },
  songChipTitleSelected: {
    color: premiumTheme.colors.background,
  },
  songChipWide: {
    width: "100%",
  },
  songGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  title: {
    color: premiumTheme.colors.text,
    fontSize: 34,
    fontWeight: "800",
    lineHeight: 38,
    marginTop: 6,
  },
  topRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
});
