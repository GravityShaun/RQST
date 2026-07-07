import { Link } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { ImageBackground, Pressable, StyleSheet, Text, View } from "react-native";

import {
  ActionRow,
  FeatureTile,
  HeroPanel,
  ScreenShell,
  SectionTitle,
  SurfaceCard,
  Tag,
} from "../../src/components/premium-ui";
import { HomeDirectorySearch } from "../../src/features/home/HomeDirectorySearch";
import { useMockHomeData } from "../../src/features/home/useMockHomeData";
import { nearbyDjs, topRequestedSongs } from "../../src/features/rqst/mock-data";
import { unsplashImages } from "../../src/lib/unsplash";
import { usePremiumTheme, useThemedStyles } from "../../src/store/theme";

export default function HomeScreen() {
  const data = useMockHomeData();
  const theme = usePremiumTheme();
  const styles = useThemedStyles((activeTheme) =>
    StyleSheet.create({
      circleButton: {
        alignItems: "center",
        backgroundColor: activeTheme.colors.surfaceElevated,
        borderColor: activeTheme.colors.border,
        borderRadius: 24,
        borderWidth: 1,
        height: 48,
        justifyContent: "center",
        position: "relative",
        shadowColor: activeTheme.colors.shadow,
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.12,
        shadowRadius: 18,
        width: 48,
      },
      circleButtonLight: {
        backgroundColor: "#D94E3D",
      },
      mosaicCard: {
        backgroundColor: activeTheme.colors.surfaceElevated,
        borderColor: activeTheme.colors.border,
        borderRadius: 30,
        borderWidth: 1,
        flex: 1,
        gap: 12,
        minHeight: 190,
        overflow: "hidden",
        padding: 12,
      },
      mosaicImage: {
        borderRadius: 22,
      },
      mosaicImageWrap: {
        borderRadius: 22,
        height: 126,
        justifyContent: "flex-end",
      },
      mosaicMint: {
        backgroundColor: "#91D4C5",
      },
      mosaicOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: "rgba(32, 24, 24, 0.10)",
      },
      mosaicPeach: {
        backgroundColor: "#E79E8A",
      },
      mosaicRow: {
        flexDirection: "row",
        gap: 12,
      },
      mosaicSubtitle: {
        color: activeTheme.colors.inkMuted,
        fontFamily: activeTheme.fonts.body,
        fontSize: 13,
        lineHeight: 18,
      },
      mosaicTitle: {
        color: activeTheme.colors.ink,
        fontFamily: activeTheme.fonts.display,
        fontSize: 28,
        fontWeight: "700",
        lineHeight: 30,
        marginTop: "auto",
      },
      notificationDot: {
        alignItems: "center",
        backgroundColor: activeTheme.colors.coral,
        borderColor: "#F9DFD5",
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
        fontFamily: activeTheme.fonts.body,
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
        color: activeTheme.colors.inkMuted,
        fontFamily: activeTheme.fonts.body,
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
        color: activeTheme.colors.ink,
        fontFamily: activeTheme.fonts.display,
        fontSize: 40,
        fontWeight: "800",
        lineHeight: 42,
        marginTop: 6,
      },
    }),
  );

  return (
    <ScreenShell>
      <View style={styles.topBar}>
        <View style={styles.topBarLeft}>
          <Pressable style={[styles.circleButton, styles.circleButtonLight]}>
            <Ionicons name="sparkles" size={20} color={theme.colors.background} />
          </Pressable>
          <Pressable style={styles.circleButton}>
            <Ionicons name="search" size={20} color={theme.colors.ink} />
          </Pressable>
        </View>
        <Pressable style={styles.circleButton}>
          <View style={styles.notificationDot}>
            <Text style={styles.notificationDotText}>9</Text>
          </View>
          <Ionicons name="notifications-outline" size={20} color={theme.colors.ink} />
        </Pressable>
      </View>

      <View style={styles.welcomeRow}>
        <View>
          <Text style={styles.welcomeEyebrow}>Tonight near you</Text>
          <Text style={styles.welcomeTitle}>RQST</Text>
        </View>
        <Tag label="Live queue" tone="mint" icon="radio-outline" />
      </View>

      <HomeDirectorySearch />

      <HeroPanel
        eyebrow="Closest live room"
        title={data.detectedSession.title}
        subtitle="Fast, colorful, and easy to scan while you are already in the venue."
        actionLabel="Open list"
        metrics={data.detectedSession.metrics}
        chips={["Nearby", "Open", "Add money anytime"]}
        imageUri={unsplashImages.homeHero}
      />

      <View style={styles.mosaicRow}>
        {nearbyDjs.slice(0, 2).map((dj, index) => (
          <Link key={dj.name} href="/dj" asChild>
            <Pressable style={styles.mosaicCard}>
              <ImageBackground
                source={{ uri: dj.imageUri }}
                imageStyle={styles.mosaicImage}
                style={[styles.mosaicImageWrap, index === 0 ? styles.mosaicPeach : styles.mosaicMint]}
              >
                <View style={styles.mosaicOverlay} />
              </ImageBackground>
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
        tone="coral"
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
