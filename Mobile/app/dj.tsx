import { Link } from "expo-router";
import { Image, ImageBackground, Pressable, StyleSheet, Text, View } from "react-native";

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
        <ImageBackground source={{ uri: djProfile.imageUri }} imageStyle={styles.heroImage} style={styles.heroImageWrap}>
          <View style={styles.heroOverlay} />
        </ImageBackground>
        <View style={styles.profileTopRow}>
          <Image source={{ uri: djProfile.imageUri }} style={styles.avatar} />
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
    borderRadius: 40,
    height: 80,
    width: 80,
  },
  backButton: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,255,255,0.78)",
    borderColor: premiumTheme.colors.border,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  backButtonText: {
    color: premiumTheme.colors.ink,
    fontSize: 13,
    fontWeight: "700",
  },
  bio: {
    color: premiumTheme.colors.inkMuted,
    fontSize: 15,
    lineHeight: 22,
  },
  handle: {
    color: premiumTheme.colors.ink,
    fontSize: 18,
    fontWeight: "800",
  },
  heroCard: {
    backgroundColor: "rgba(255,255,255,0.72)",
  },
  heroImage: {
    borderRadius: 24,
  },
  heroImageWrap: {
    borderRadius: 24,
    height: 180,
    overflow: "hidden",
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(217, 94, 79, 0.18)",
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
