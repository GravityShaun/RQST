import { useMemo } from "react";
import { Link, useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
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
import { fetchDjProfileBySlug } from "../src/lib/discover-api";
import { getDjImage } from "../src/lib/unsplash";

export default function DjProfileScreen() {
  const params = useLocalSearchParams<{ slug?: string | string[] }>();
  const slugParam = params.slug;
  const slug = Array.isArray(slugParam) ? slugParam[0] : slugParam;

  const profileQuery = useQuery({
    queryKey: ["djProfile", slug],
    queryFn: () => fetchDjProfileBySlug(slug as string),
    enabled: Boolean(slug),
  });

  const profile = profileQuery.data;
  const imageUri = getDjImage(profile?.artistName ?? "DJ");
  const genres = profile?.genresJson ?? [];
  const subtitle = useMemo(() => {
    if (!profile) {
      return "Loading DJ profile...";
    }

    const parts = [profile.city, profile.isLive ? `Live at ${profile.venueName ?? "a venue"}` : null].filter(Boolean);
    return parts.length ? parts.join(" · ") : "Public DJ profile on RQST";
  }, [profile]);

  return (
    <ScreenShell>
      <Link href="/(tabs)/home" asChild>
        <Pressable style={styles.backButton}>
          <Text style={styles.backButtonText}>Back</Text>
        </Pressable>
      </Link>

      <ScreenHeader
        eyebrow="DJ profile"
        title={profile?.artistName ?? "DJ profile"}
        subtitle={subtitle}
        trailing={
          profile?.isLive ? (
            <Tag label="Live now" tone="mint" icon="radio-outline" />
          ) : (
            <Tag label="Verified DJ" tone="mint" icon="checkmark-circle-outline" />
          )
        }
      />

      {profileQuery.isLoading ? (
        <SurfaceCard>
          <Text style={styles.loadingText}>Loading profile...</Text>
        </SurfaceCard>
      ) : profileQuery.isError || !profile ? (
        <SurfaceCard>
          <Text style={styles.loadingText}>Could not load this DJ profile.</Text>
        </SurfaceCard>
      ) : (
        <>
          <SurfaceCard style={styles.heroCard}>
            <ImageBackground source={{ uri: imageUri }} imageStyle={styles.heroImage} style={styles.heroImageWrap}>
              <View style={styles.heroOverlay} />
            </ImageBackground>
            <View style={styles.profileTopRow}>
              <Image source={{ uri: imageUri }} style={styles.avatar} />
              <View style={styles.profileCopy}>
                <Text style={styles.handle}>@{profile.slug}</Text>
                <Text style={styles.bio}>{profile.bio ?? "This DJ is on RQST."}</Text>
              </View>
            </View>

            <View style={styles.pillRow}>
              {genres.length ? (
                genres.map((genre, index) => (
                  <Tag key={genre} label={genre} tone={index === 0 ? "gold" : index === 1 ? "mint" : "slate"} />
                ))
              ) : (
                <Tag label="Open format" tone="slate" />
              )}
            </View>
          </SurfaceCard>

          <View style={styles.metricRow}>
            <FeatureTile
              icon="location-outline"
              title="Based in"
              subtitle="Where this DJ usually plays."
              value={profile.city ?? "RQST"}
              tone="gold"
            />
            <FeatureTile
              icon="radio-outline"
              title="Status"
              subtitle="Whether this DJ is live right now."
              value={profile.isLive ? "Live" : "Playing soon"}
              tone="mint"
            />
          </View>

          <SectionTitle title="Tonight" subtitle="Quick links for fans following this DJ." />
          <SurfaceCard>
            <View style={styles.pillRow}>
              <StatPill
                label="Venue"
                value={profile.isLive ? (profile.venueName ?? "Live room") : "Coming up"}
                tone="coral"
              />
              <StatPill label="Profile" value="Public" tone="slate" />
            </View>
            <ActionRow
              icon="share-social-outline"
              title="Share profile"
              subtitle={`Send rqst.app/djs/${profile.slug} to friends before they arrive.`}
              value="Link"
              tone="mint"
            />
          </SurfaceCard>
        </>
      )}
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
  loadingText: {
    color: premiumTheme.colors.inkMuted,
    fontFamily: premiumTheme.fonts.body,
    fontSize: 15,
    lineHeight: 22,
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
