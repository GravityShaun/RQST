import { Link, useLocalSearchParams } from "expo-router";
import { Image, ImageBackground, Pressable, StyleSheet, Text, View } from "react-native";

import {
  ActionRow,
  FeatureTile,
  ScreenHeader,
  ScreenShell,
  SectionTitle,
  SurfaceCard,
  Tag,
  premiumTheme,
} from "../../src/components/premium-ui";
import { liveQueue, userProfiles } from "../../src/features/rqst/mock-data";

export default function UserProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const profile = userProfiles.find((user) => user.id === id);

  if (!profile) {
    return (
      <ScreenShell>
        <Link href="/(tabs)/list" asChild>
          <Pressable style={styles.backButton}>
            <Text style={styles.backButtonText}>Back to queue</Text>
          </Pressable>
        </Link>
        <ScreenHeader
          eyebrow="Profile"
          title="User not found"
          subtitle="This queue profile may have moved or is no longer part of the live room."
        />
      </ScreenShell>
    );
  }

  const requestedSongs = liveQueue.filter((item) => item.uploadedBy.id === profile.id);

  return (
    <ScreenShell>
      <Link href="/(tabs)/list" asChild>
        <Pressable style={styles.backButton}>
          <Text style={styles.backButtonText}>Back to queue</Text>
        </Pressable>
      </Link>

      <ScreenHeader
        eyebrow="Uploader profile"
        title={profile.name}
        subtitle="See who added the song, what they usually request, and how they support the room."
        trailing={<Tag label="Fan profile" tone="gold" icon="person-circle-outline" />}
      />

      <SurfaceCard style={styles.heroCard}>
        <ImageBackground source={{ uri: profile.imageUri }} imageStyle={styles.heroImage} style={styles.heroImageWrap}>
          <View style={styles.heroOverlay} />
        </ImageBackground>
        <View style={styles.profileTopRow}>
          <Image source={{ uri: profile.imageUri }} style={styles.avatar} />
          <View style={styles.profileCopy}>
            <Text style={styles.handle}>{profile.handle}</Text>
            <Text style={styles.bio}>{profile.bio}</Text>
          </View>
        </View>

        <View style={styles.pillRow}>
          {profile.favoriteGenres.map((genre, index) => (
            <Tag key={genre} label={genre} tone={index === 0 ? "gold" : index === 1 ? "mint" : "slate"} />
          ))}
        </View>
      </SurfaceCard>

      <View style={styles.metricRow}>
        <FeatureTile
          icon="musical-notes-outline"
          title="Requests"
          subtitle="Songs added across live rooms."
          value={String(profile.requestsMade)}
          tone="gold"
        />
        <FeatureTile
          icon="arrow-up-circle-outline"
          title="Boosts"
          subtitle="Times they supported a request."
          value={String(profile.boostsGiven)}
          tone="mint"
        />
      </View>

      <SectionTitle title="Queue activity" subtitle={`${profile.neighborhood} regular · top request ${profile.topSong}`} />
      <SurfaceCard>
        {requestedSongs.map((song) => (
          <ActionRow
            key={song.id}
            icon="disc-outline"
            title={song.title}
            subtitle={`${song.artist} · ${song.status} · ${song.contributors} fans`}
            value={`$${Math.round(song.totalCents / 100)}`}
            tone="slate"
          />
        ))}
      </SurfaceCard>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  avatar: {
    borderColor: "#FFFFFF",
    borderRadius: 42,
    borderWidth: 3,
    height: 84,
    width: 84,
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
    backgroundColor: "rgba(30, 23, 23, 0.18)",
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
