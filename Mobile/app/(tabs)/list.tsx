import { Link, type Href } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { formatUsd } from "@rqst/shared-config";

import {
  ScreenShell,
  SectionTitle,
  StatPill,
  SurfaceCard,
  Tag,
  premiumTheme,
} from "../../src/components/premium-ui";
import { activeSession, liveQueue } from "../../src/features/rqst/mock-data";

export default function ListScreen() {
  const leader = liveQueue[0];

  return (
    <ScreenShell>
      <View style={styles.topBar}>
        <View style={styles.topBarLeft}>
          <Pressable style={[styles.circleButton, styles.circleButtonLight]}>
            <Ionicons name="sparkles" size={20} color={premiumTheme.colors.background} />
          </Pressable>
          <Pressable style={styles.circleButton}>
            <Ionicons name="search" size={20} color={premiumTheme.colors.text} />
          </Pressable>
        </View>
        <Tag label={activeSession.venue} tone="gold" icon="location-outline" />
      </View>

      <Link href="/dj" asChild>
        <Pressable style={styles.spotlightCard}>
          <View style={styles.spotlightTop}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>DS</Text>
            </View>
            <View>
              <Text style={styles.spotlightName}>{activeSession.djName}</Text>
              <Text style={styles.spotlightMeta}>{activeSession.event}</Text>
            </View>
          </View>
          <Text style={styles.spotlightTitle}>{leader?.title ?? "Live queue"}</Text>
          <Text style={styles.spotlightSubtitle}>{leader?.artist ?? activeSession.venue}</Text>
          <Text style={styles.spotlightAmount}>{leader ? formatUsd(leader.totalCents) : formatUsd(activeSession.requestFloorCents)}</Text>
        </Pressable>
      </Link>

      <View style={styles.pillRow}>
        <StatPill label="Min request" value={formatUsd(activeSession.requestFloorCents)} tone="gold" />
        <StatPill label="Window" value="Open now" tone="mint" />
        <StatPill label="Venue" value={activeSession.venue} tone="slate" />
      </View>

      <SectionTitle title="Queue" subtitle="Highest support wins, and anybody can keep boosting a song upward." />
      <SurfaceCard style={styles.tableCard}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.table}>
            <View style={[styles.tableRow, styles.tableHeaderRow]}>
              <Text style={[styles.tableHeaderCell, styles.rankColumn]}>Rank</Text>
              <Text style={[styles.tableHeaderCell, styles.songColumn]}>Song</Text>
              <Text style={[styles.tableHeaderCell, styles.supportColumn]}>Support</Text>
              <Text style={[styles.tableHeaderCell, styles.fansColumn]}>Fans</Text>
              <Text style={[styles.tableHeaderCell, styles.statusColumn]}>Status</Text>
            </View>
            {liveQueue.map((item, index) => (
              <View
                key={item.id}
                style={[
                  styles.tableRow,
                  index < liveQueue.length - 1 ? styles.tableBodyDivider : null,
                ]}
              >
                <Text style={[styles.tableCell, styles.rankColumn, styles.rankCell]}>#{item.rank}</Text>
                <View style={styles.songColumn}>
                  <Text style={styles.songTitle}>{item.title}</Text>
                  <Text style={styles.songArtist}>{item.artist}</Text>
                </View>
                <Text style={[styles.tableCell, styles.supportColumn, styles.supportCell]}>
                  {formatUsd(item.totalCents)}
                </Text>
                <Text style={[styles.tableCell, styles.fansColumn]}>{item.contributors}</Text>
                <View style={styles.statusColumn}>
                  <Tag label={item.status} tone={item.status === "Open" ? "mint" : "coral"} />
                </View>
              </View>
            ))}
          </View>
        </ScrollView>
      </SurfaceCard>

      <Link href={"/find" as Href} asChild>
        <Pressable style={styles.switchCard}>
          <Text style={styles.switchTitle}>Wrong room?</Text>
          <Text style={styles.switchSubtitle}>Choose another live list</Text>
        </Pressable>
      </Link>

      <SurfaceCard>
        <Text style={styles.ruleTitle}>How it works</Text>
        <Text style={styles.ruleText}>New songs must meet the DJ minimum. Existing songs can be boosted by any positive amount.</Text>
        <Text style={styles.ruleText}>The DJ confirms a song before money is credited on the backend.</Text>
      </SurfaceCard>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  avatar: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.18)",
    borderRadius: 24,
    height: 48,
    justifyContent: "center",
    width: 48,
  },
  avatarText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
  },
  circleButton: {
    alignItems: "center",
    backgroundColor: premiumTheme.colors.surfaceElevated,
    borderRadius: 24,
    height: 48,
    justifyContent: "center",
    width: 48,
  },
  circleButtonLight: {
    backgroundColor: "#FFF5EF",
  },
  pillRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  ruleText: {
    color: premiumTheme.colors.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  ruleTitle: {
    color: premiumTheme.colors.text,
    fontSize: 20,
    fontWeight: "800",
  },
  rankCell: {
    color: premiumTheme.colors.slate,
    fontWeight: "700",
  },
  rankColumn: {
    width: 58,
  },
  songArtist: {
    color: premiumTheme.colors.muted,
    fontSize: 13,
    marginTop: 2,
  },
  songColumn: {
    minWidth: 180,
    paddingRight: 12,
  },
  songTitle: {
    color: premiumTheme.colors.text,
    fontSize: 15,
    fontWeight: "700",
  },
  spotlightAmount: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "700",
  },
  spotlightCard: {
    backgroundColor: "#AE93EA",
    borderRadius: 34,
    gap: 10,
    overflow: "hidden",
    padding: 22,
  },
  spotlightMeta: {
    color: "rgba(255,255,255,0.82)",
    fontSize: 13,
  },
  spotlightName: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "700",
  },
  spotlightSubtitle: {
    color: "rgba(255,255,255,0.82)",
    fontSize: 14,
  },
  spotlightTitle: {
    color: "#FFFFFF",
    fontSize: 34,
    fontWeight: "800",
    lineHeight: 38,
    marginTop: 12,
  },
  spotlightTop: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
  },
  switchCard: {
    backgroundColor: premiumTheme.colors.surfaceElevated,
    borderRadius: 22,
    padding: 18,
  },
  switchSubtitle: {
    color: premiumTheme.colors.muted,
    fontSize: 13,
    marginTop: 4,
  },
  switchTitle: {
    color: premiumTheme.colors.text,
    fontSize: 18,
    fontWeight: "700",
  },
  supportCell: {
    color: premiumTheme.colors.gold,
    fontWeight: "700",
  },
  supportColumn: {
    width: 88,
  },
  statusColumn: {
    alignItems: "flex-start",
    width: 96,
  },
  table: {
    minWidth: 470,
  },
  tableBodyDivider: {
    borderBottomColor: premiumTheme.colors.border,
    borderBottomWidth: 1,
  },
  tableCard: {
    padding: 0,
    overflow: "hidden",
  },
  tableCell: {
    color: premiumTheme.colors.text,
    fontSize: 14,
  },
  tableHeaderCell: {
    color: premiumTheme.colors.muted,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  tableHeaderRow: {
    backgroundColor: premiumTheme.colors.surfaceElevated,
  },
  tableRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 18,
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
  fansColumn: {
    width: 56,
  },
});
