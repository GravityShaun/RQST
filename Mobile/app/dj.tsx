import { Link } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import {
  ActionRow,
  FeatureTile,
  ScreenHeader,
  ScreenShell,
  SectionTitle,
  StatPill,
  SurfaceCard,
  Tag,
  premiumTheme,
} from "../src/components/premium-ui";
import { djProfile } from "../src/features/rqst/mock-data";

export default function DjProfileScreen() {
  return (
    <ScreenShell>
      <Link href="/(tabs)/list" asChild>
        <Pressable style={styles.backButton}>
          <Text style={styles.backButtonText}>Back to queue</Text>
        </Pressable>
      </Link>

      <ScreenHeader
        eyebrow="DJ profile"
        title={djProfile.name}
        subtitle="A marketing-friendly profile page that helps fans follow the DJ, learn the vibe, and find upcoming sets."
        trailing={<Tag label="Verified DJ" tone="mint" icon="checkmark-circle-outline" />}
      />

      <SurfaceCard style={styles.heroCard}>
        <View style={styles.profileTopRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>DS</Text>
          </View>
          <View style={styles.profileCopy}>
            <Text style={styles.handle}>{djProfile.handle}</Text>
            <Text style={styles.bio}>{djProfile.bio}</Text>
          </View>
        </View>

        <View style={styles.pillRow}>
          {djProfile.genres.map((genre, index) => (
            <Tag key={genre} label={genre} tone={index === 0 ? "gold" : index === 1 ? "mint" : "slate"} />
          ))}
        </View>
      </SurfaceCard>

      <View style={styles.metricRow}>
        <FeatureTile
          icon="people-outline"
          title="Followers"
          subtitle="Growing audience across the app."
          value={djProfile.followers}
          tone="gold"
        />
        <FeatureTile
          icon="checkmark-done-outline"
          title="Acceptance rate"
          subtitle="How often this DJ confirms a song."
          value={djProfile.acceptanceRate}
          tone="mint"
        />
      </View>

      <SectionTitle title="Tonight" subtitle="The stats and links that make the page useful during a live set." />
      <SurfaceCard>
        <View style={styles.pillRow}>
          <StatPill label="Earned tonight" value={djProfile.totalEarnedTonight} tone="coral" />
          <StatPill label="Profile status" value="Live" tone="slate" />
        </View>
        <ActionRow
          icon="share-social-outline"
          title="Share profile"
          subtitle="Send this DJ page to friends before they arrive at the venue."
          value="Link"
          tone="mint"
        />
        <ActionRow
          icon="logo-instagram"
          title="Social links"
          subtitle={djProfile.socials.join(" · ")}
          value="Open"
          tone="gold"
        />
      </SurfaceCard>

      <SectionTitle title="Upcoming events" subtitle="A clean, shareable event list built into the profile." />
      <SurfaceCard>
        {djProfile.events.map((event) => (
          <ActionRow
            key={event.title}
            icon="calendar-outline"
            title={event.title}
            subtitle={event.subtitle}
            value={event.value}
            tone="slate"
          />
        ))}
      </SurfaceCard>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  avatar: {
    alignItems: "center",
    backgroundColor: "#17181B",
    borderRadius: 40,
    height: 80,
    justifyContent: "center",
    width: 80,
  },
  avatarText: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "800",
  },
  backButton: {
    alignSelf: "flex-start",
    backgroundColor: premiumTheme.colors.surface,
    borderColor: premiumTheme.colors.border,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  backButtonText: {
    color: premiumTheme.colors.text,
    fontSize: 13,
    fontWeight: "700",
  },
  bio: {
    color: "#5F6573",
    fontSize: 15,
    lineHeight: 22,
  },
  handle: {
    color: premiumTheme.colors.text,
    fontSize: 18,
    fontWeight: "800",
  },
  heroCard: {
    backgroundColor: "#DFF9EC",
  },
  metricRow: {
    flexDirection: "row",
    gap: 12,
  },
  pillRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  profileCopy: {
    flex: 1,
    gap: 8,
  },
  profileTopRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 14,
  },
});
