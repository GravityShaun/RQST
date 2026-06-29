import { Link } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";

import {
  ActionRow,
  FeatureTile,
  HeroPanel,
  ScreenShell,
  SearchField,
  SectionTitle,
  SurfaceCard,
  Tag,
  premiumTheme,
} from "../../src/components/premium-ui";
import { useMockHomeData } from "../../src/features/home/useMockHomeData";
import { nearbyDjs, topRequestedSongs } from "../../src/features/rqst/mock-data";

export default function HomeScreen() {
  const data = useMockHomeData();

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
        <Pressable style={styles.circleButton}>
          <View style={styles.notificationDot}>
            <Text style={styles.notificationDotText}>9</Text>
          </View>
          <Ionicons name="notifications-outline" size={20} color={premiumTheme.colors.text} />
        </Pressable>
      </View>

      <View style={styles.welcomeRow}>
        <View>
          <Text style={styles.welcomeEyebrow}>Tonight near you</Text>
          <Text style={styles.welcomeTitle}>RQST</Text>
        </View>
        <Tag label="Live queue" tone="mint" icon="radio-outline" />
      </View>

      <SearchField label="Jump in" value="Search DJs, venues, or songs" />

      <HeroPanel
        eyebrow="Closest live room"
        title={data.detectedSession.title}
        subtitle="Fast, colorful, and easy to scan while you are already in the venue."
        actionLabel="Open list"
        metrics={data.detectedSession.metrics}
        chips={["Nearby", "Open", "Add money anytime"]}
      />

      <View style={styles.mosaicRow}>
        {nearbyDjs.slice(0, 2).map((dj, index) => (
          <Link key={dj.name} href="/dj" asChild>
            <Pressable style={[styles.mosaicCard, index === 0 ? styles.mosaicPeach : styles.mosaicMint]}>
              <View style={styles.mosaicAvatar}>
                <Text style={styles.mosaicAvatarText}>
                  {dj.name
                    .split(" ")
                    .map((part) => part[0])
                    .join("")
                    .slice(0, 2)}
                </Text>
              </View>
              <Text style={styles.mosaicTitle}>{dj.name}</Text>
              <Text style={styles.mosaicSubtitle}>{dj.detail}</Text>
            </Pressable>
          </Link>
        ))}
      </View>

      <FeatureTile
        icon="flash-outline"
        title="Top requested right now"
        subtitle={`${topRequestedSongs[0]?.title} is pulling the most money in the room tonight.`}
        value={topRequestedSongs[0]?.amount ?? "$0"}
        tone="slate"
      />

      <SectionTitle title="Your night" subtitle="Shortcuts that feel more like a real app and less like admin panels." />
      <SurfaceCard>
        <ActionRow
          icon="musical-notes-outline"
          title="My requests"
          subtitle="See what is open, locked, or already played."
          value="4 active"
          tone="mint"
        />
        <ActionRow
          icon="calendar-outline"
          title="Upcoming events"
          subtitle={data.upcomingEvents[0]?.title ?? "No events yet"}
          value="See all"
          tone="gold"
        />
        <ActionRow
          icon="trending-up-outline"
          title="Room momentum"
          subtitle="Best request window is opening over the next two songs."
          value="Good"
          tone="slate"
        />
      </SurfaceCard>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  circleButton: {
    alignItems: "center",
    backgroundColor: premiumTheme.colors.surfaceElevated,
    borderRadius: 24,
    height: 48,
    justifyContent: "center",
    position: "relative",
    width: 48,
  },
  circleButtonLight: {
    backgroundColor: "#FFF5EF",
  },
  mosaicAvatar: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.18)",
    borderRadius: 28,
    height: 56,
    justifyContent: "center",
    width: 56,
  },
  mosaicAvatarText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "800",
  },
  mosaicCard: {
    borderRadius: 30,
    flex: 1,
    gap: 12,
    minHeight: 190,
    overflow: "hidden",
    padding: 18,
  },
  mosaicMint: {
    backgroundColor: "#98D8C4",
  },
  mosaicPeach: {
    backgroundColor: "#D8A487",
  },
  mosaicRow: {
    flexDirection: "row",
    gap: 12,
  },
  mosaicSubtitle: {
    color: "rgba(255,255,255,0.84)",
    fontSize: 13,
    lineHeight: 18,
  },
  mosaicTitle: {
    color: "#FFFFFF",
    fontSize: 28,
    fontWeight: "700",
    lineHeight: 30,
    marginTop: "auto",
  },
  notificationDot: {
    alignItems: "center",
    backgroundColor: premiumTheme.colors.ringPink,
    borderColor: premiumTheme.colors.ringGold,
    borderRadius: 10,
    borderWidth: 1.5,
    height: 20,
    justifyContent: "center",
    left: -8,
    position: "absolute",
    top: 4,
    width: 20,
    zIndex: 2,
  },
  notificationDotText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "800",
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
  welcomeEyebrow: {
    color: premiumTheme.colors.muted,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  welcomeRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  welcomeTitle: {
    color: premiumTheme.colors.text,
    fontSize: 40,
    fontWeight: "800",
    lineHeight: 42,
    marginTop: 6,
  },
});
