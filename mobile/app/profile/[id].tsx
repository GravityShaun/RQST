import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { ImageBackground, Pressable, StyleSheet, Text, View } from "react-native";

import {
  ActionRow,
  ScreenHeader,
  ScreenShell,
  SectionTitle,
  SurfaceCard,
  Tag,
} from "../../src/components/premium-ui";
import { UserAvatar } from "../../src/components/UserAvatar";
import { liveQueue, userProfiles, type UserProfile } from "../../src/features/rqst/mock-data";
import { unsplashImages } from "../../src/lib/unsplash";
import { usePremiumTheme, useThemedStyles } from "../../src/store/theme";

function firstParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

function buildProfileFromParams(params: Record<string, string | string[] | undefined>): UserProfile | null {
  const id = firstParam(params.id);
  const name = firstParam(params.name);

  if (!id || !name) {
    return null;
  }

  return {
    id,
    name,
    handle: firstParam(params.handle) || `@${name.toLowerCase().replace(/[^a-z0-9]+/g, "") || "rqst"}`,
    imageUri: firstParam(params.imageUri) || unsplashImages.djPortrait,
    bio: firstParam(params.bio) || "RQST listener supporting the live room.",
    neighborhood: firstParam(params.neighborhood) || "Live room",
    favoriteGenres: [],
    requestsMade: Number(firstParam(params.requestsMade) || 0),
    boostsGiven: Number(firstParam(params.boostsGiven) || 0),
    topSong: firstParam(params.topSong) || "Requested song",
  };
}

export default function UserProfileScreen() {
  const params = useLocalSearchParams();
  const id = firstParam(params.id);
  const mockProfile = userProfiles.find((user) => user.id === id);
  const profile = mockProfile ?? buildProfileFromParams(params);
  const theme = usePremiumTheme();
  const styles = useThemedStyles((activeTheme) =>
    StyleSheet.create({
      avatarRing: {
        borderColor: activeTheme.colors.surfaceElevated,
        borderRadius: 52,
        borderWidth: 4,
        marginTop: -44,
      },
      backButton: {
        alignItems: "center",
        alignSelf: "flex-start",
        backgroundColor: activeTheme.colors.surfaceElevated,
        borderColor: activeTheme.colors.border,
        borderRadius: 999,
        borderWidth: 1,
        flexDirection: "row",
        gap: 6,
        paddingHorizontal: 14,
        paddingVertical: 12,
      },
      backButtonText: {
        color: activeTheme.colors.ink,
        fontFamily: activeTheme.fonts.body,
        fontSize: 13,
        fontWeight: "700",
      },
      bio: {
        color: activeTheme.colors.inkMuted,
        fontFamily: activeTheme.fonts.body,
        fontSize: 15,
        lineHeight: 22,
        textAlign: "center",
      },
      emptyActivity: {
        color: activeTheme.colors.inkMuted,
        fontFamily: activeTheme.fonts.body,
        fontSize: 14,
        lineHeight: 20,
        paddingVertical: 4,
      },
      handle: {
        color: activeTheme.colors.coral,
        fontFamily: activeTheme.fonts.body,
        fontSize: 14,
        fontWeight: "700",
      },
      heroCard: {
        gap: 14,
        overflow: "hidden",
        paddingBottom: 22,
        paddingTop: 0,
      },
      heroImage: {
        borderBottomLeftRadius: 0,
        borderBottomRightRadius: 0,
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
      },
      heroImageWrap: {
        height: 140,
        marginHorizontal: -18,
        marginTop: -18,
        overflow: "hidden",
      },
      heroOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: "rgba(30, 23, 23, 0.32)",
      },
      metaRow: {
        alignItems: "center",
        flexDirection: "row",
        gap: 6,
      },
      metaText: {
        color: activeTheme.colors.inkMuted,
        fontFamily: activeTheme.fonts.body,
        fontSize: 13,
        fontWeight: "600",
      },
      name: {
        color: activeTheme.colors.ink,
        fontFamily: activeTheme.fonts.display,
        fontSize: 30,
        fontWeight: "800",
        lineHeight: 32,
        textAlign: "center",
      },
      pillRow: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 8,
        justifyContent: "center",
        marginTop: 4,
      },
      profileBody: {
        alignItems: "center",
        gap: 8,
        paddingHorizontal: 6,
      },
      statCell: {
        alignItems: "center",
        flex: 1,
        gap: 4,
        paddingVertical: 4,
      },
      statDivider: {
        alignSelf: "stretch",
        backgroundColor: activeTheme.colors.border,
        marginVertical: 4,
        width: StyleSheet.hairlineWidth,
      },
      statLabel: {
        color: activeTheme.colors.inkMuted,
        fontFamily: activeTheme.fonts.body,
        fontSize: 11,
        fontWeight: "700",
        letterSpacing: 0.4,
        textTransform: "uppercase",
      },
      statStrip: {
        alignItems: "center",
        flexDirection: "row",
        paddingHorizontal: 8,
        paddingVertical: 6,
      },
      statValue: {
        color: activeTheme.colors.ink,
        fontFamily: activeTheme.fonts.display,
        fontSize: 28,
        fontWeight: "800",
        lineHeight: 30,
      },
      topSongCard: {
        gap: 6,
      },
      topSongLabel: {
        color: activeTheme.colors.inkMuted,
        fontFamily: activeTheme.fonts.body,
        fontSize: 11,
        fontWeight: "700",
        letterSpacing: 0.5,
        textTransform: "uppercase",
      },
      topSongTitle: {
        color: activeTheme.colors.ink,
        fontFamily: activeTheme.fonts.display,
        fontSize: 20,
        fontWeight: "700",
      },
    }),
  );

  if (!profile) {
    return (
      <ScreenShell>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={16} color={theme.colors.ink} />
          <Text style={styles.backButtonText}>Back to queue</Text>
        </Pressable>
        <ScreenHeader
          eyebrow="Profile"
          title="User not found"
          subtitle="This queue profile may have moved or is no longer part of the live room."
        />
      </ScreenShell>
    );
  }

  const requestedSongs = liveQueue.filter((item) => item.uploadedBy.id === profile.id);
  const genreTags = profile.favoriteGenres.length > 0 ? profile.favoriteGenres.slice(0, 3) : [];
  const activityCount = requestedSongs.length;

  return (
    <ScreenShell>
      <Pressable onPress={() => router.back()} style={styles.backButton}>
        <Ionicons name="chevron-back" size={16} color={theme.colors.ink} />
        <Text style={styles.backButtonText}>Back to queue</Text>
      </Pressable>

      <SurfaceCard style={styles.heroCard}>
        <ImageBackground source={{ uri: profile.imageUri }} imageStyle={styles.heroImage} style={styles.heroImageWrap}>
          <View style={styles.heroOverlay} />
        </ImageBackground>

        <View style={styles.profileBody}>
          <View style={styles.avatarRing}>
            <UserAvatar displayName={profile.name} imageUri={profile.imageUri} size={88} />
          </View>
          <Text style={styles.name}>{profile.name}</Text>
          <Text style={styles.handle}>{profile.handle}</Text>
          {profile.neighborhood ? (
            <View style={styles.metaRow}>
              <Ionicons name="location-outline" size={14} color={theme.colors.inkMuted} />
              <Text style={styles.metaText}>{profile.neighborhood}</Text>
            </View>
          ) : null}
          <Text style={styles.bio}>{profile.bio}</Text>
          {genreTags.length > 0 ? (
            <View style={styles.pillRow}>
              {genreTags.map((genre, index) => (
                <Tag
                  key={`${genre}-${index}`}
                  label={genre}
                  tone={index === 0 ? "gold" : index === 1 ? "mint" : "slate"}
                />
              ))}
            </View>
          ) : null}
        </View>
      </SurfaceCard>

      <SurfaceCard>
        <View style={styles.statStrip}>
          <View style={styles.statCell}>
            <Text style={styles.statValue}>{profile.requestsMade || 0}</Text>
            <Text style={styles.statLabel}>Requests</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statCell}>
            <Text style={styles.statValue}>{profile.boostsGiven || 0}</Text>
            <Text style={styles.statLabel}>Boosts</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statCell}>
            <Text style={styles.statValue}>{activityCount || "—"}</Text>
            <Text style={styles.statLabel}>In queue</Text>
          </View>
        </View>
      </SurfaceCard>

      {profile.topSong ? (
        <SurfaceCard style={styles.topSongCard}>
          <Text style={styles.topSongLabel}>Top request</Text>
          <Text style={styles.topSongTitle}>{profile.topSong}</Text>
        </SurfaceCard>
      ) : null}

      <SectionTitle
        title="Queue activity"
        subtitle={activityCount > 0 ? `${activityCount} songs from this listener` : "Recent support in live rooms"}
      />
      <SurfaceCard>
        {requestedSongs.length > 0 ? (
          requestedSongs.map((song) => (
            <ActionRow
              key={song.id}
              icon="disc-outline"
              title={song.title}
              subtitle={`${song.artist} · ${song.status} · ${song.contributors} fans`}
              value={`$${Math.round(song.totalCents / 100)}`}
              tone="slate"
            />
          ))
        ) : (
          <Text style={styles.emptyActivity}>
            {profile.topSong
              ? `Recently requested “${profile.topSong}” in this room.`
              : "No recent queue activity to show yet."}
          </Text>
        )}
      </SurfaceCard>
    </ScreenShell>
  );
}
