import { useMemo, useState } from "react";
import { ImageBackground, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { apiRoutes, type ComplimentaryCredit } from "@rqst/contracts";
import { useQuery } from "@tanstack/react-query";
import { router, type Href } from "expo-router";

import {
  ActionRow,
  ColorSchemePicker,
  ScreenShell,
  SectionTitle,
  SettingsRow,
  SurfaceCard,
  Tag,
  ToggleRow,
} from "../../src/components/premium-ui";
import { UserAvatar } from "../../src/components/UserAvatar";
import { resolveAvatarUrl } from "../../src/lib/avatar";
import { rqstApi } from "../../src/lib/rqst-api";
import { unsplashImages } from "../../src/lib/unsplash";
import { useAuthStore } from "../../src/store/auth";
import { usePremiumTheme, useThemedStyles } from "../../src/store/theme";

export default function SettingsScreen() {
  const [pushEnabled, setPushEnabled] = useState(true);
  const [nearbyAlerts, setNearbyAlerts] = useState(true);
  const [locationSharing, setLocationSharing] = useState(true);
  const user = useAuthStore((state) => state.user);
  const isSignedIn = useAuthStore((state) => Boolean(state.accessToken && state.user));
  const signOut = useAuthStore((state) => state.signOut);
  const theme = usePremiumTheme();
  const styles = useThemedStyles((activeTheme) =>
    StyleSheet.create({
      avatarRing: {
        borderColor: activeTheme.colors.surfaceElevated,
        borderRadius: 52,
        borderWidth: 4,
        marginTop: -44,
      },
      email: {
        color: activeTheme.colors.inkMuted,
        fontFamily: activeTheme.fonts.body,
        fontSize: 14,
        textAlign: "center",
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
        backgroundColor: "rgba(30, 23, 23, 0.34)",
      },
      logoutCopy: {
        flex: 1,
        gap: 2,
      },
      logoutIcon: {
        alignItems: "center",
        backgroundColor: "rgba(224, 90, 71, 0.14)",
        borderColor: "rgba(224, 90, 71, 0.28)",
        borderRadius: 14,
        borderWidth: 1,
        height: 40,
        justifyContent: "center",
        width: 40,
      },
      logoutRow: {
        alignItems: "center",
        borderColor: activeTheme.colors.border,
        borderTopWidth: 1,
        flexDirection: "row",
        gap: 12,
        marginTop: 8,
        paddingTop: 16,
      },
      logoutSubtitle: {
        color: activeTheme.colors.inkMuted,
        fontFamily: activeTheme.fonts.body,
        fontSize: 13,
      },
      logoutTitle: {
        color: activeTheme.colors.coral,
        fontFamily: activeTheme.fonts.body,
        fontSize: 16,
        fontWeight: "700",
      },
      name: {
        color: activeTheme.colors.ink,
        fontFamily: activeTheme.fonts.display,
        fontSize: 30,
        fontWeight: "800",
        lineHeight: 32,
        textAlign: "center",
      },
      profileBody: {
        alignItems: "center",
        gap: 8,
        paddingHorizontal: 6,
      },
      roleTagWrap: {
        marginTop: 4,
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
        fontSize: 26,
        fontWeight: "800",
        lineHeight: 28,
      },
      statValueMuted: {
        color: activeTheme.colors.inkMuted,
        fontSize: 22,
      },
    }),
  );

  const complimentaryCreditsQuery = useQuery({
    queryKey: ["meComplimentaryCredits"],
    queryFn: () =>
      rqstApi<ComplimentaryCredit[]>(apiRoutes.meComplimentaryCredits.replace("/api/v1", "")),
    enabled: isSignedIn,
    retry: false,
  });

  const unusedCredits = useMemo(
    () => (complimentaryCreditsQuery.data ?? []).filter((credit) => !credit.usedAt),
    [complimentaryCreditsQuery.data],
  );

  const promoValue = unusedCredits.length > 0 ? `${unusedCredits.length} ready` : "Enter";
  const displayName = user?.displayName ?? "Guest";
  const handle = `@${displayName.toLowerCase().replace(/[^a-z0-9]+/g, "") || "rqst"}`;
  const roleLabel = user?.role === "dj" ? "DJ" : user?.role === "admin" ? "Admin" : "Member";
  const heroImageUri = resolveAvatarUrl(user?.avatarUrl) ?? unsplashImages.settingsProfile;

  async function handleSignOut() {
    await signOut();
  }

  return (
    <ScreenShell>
      <SurfaceCard style={styles.heroCard}>
        <ImageBackground
          source={{ uri: heroImageUri }}
          imageStyle={styles.heroImage}
          style={styles.heroImageWrap}
        >
          <View style={styles.heroOverlay} />
        </ImageBackground>

        <View style={styles.profileBody}>
          <View style={styles.avatarRing}>
            <UserAvatar displayName={displayName} imageUri={user?.avatarUrl} size={88} />
          </View>
          <Text style={styles.name}>{displayName}</Text>
          <Text style={styles.handle}>{handle}</Text>
          <Text style={styles.email}>{user?.email ?? "Signed in to RQST."}</Text>
          <View style={styles.roleTagWrap}>
            <Tag label={roleLabel} tone="gold" icon="person-circle-outline" />
          </View>
        </View>
      </SurfaceCard>

      <SurfaceCard>
        <View style={styles.statStrip}>
          <View style={styles.statCell}>
            <Text style={styles.statValue}>{unusedCredits.length}</Text>
            <Text style={styles.statLabel}>Promos</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statCell}>
            <Text style={[styles.statValue, !pushEnabled && styles.statValueMuted]}>
              {pushEnabled ? "On" : "Off"}
            </Text>
            <Text style={styles.statLabel}>Alerts</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statCell}>
            <Text style={styles.statValue}>{roleLabel}</Text>
            <Text style={styles.statLabel}>Role</Text>
          </View>
        </View>
      </SurfaceCard>

      <SectionTitle title="Appearance" subtitle="Light, dark, or match your device." />
      <SurfaceCard>
        <ColorSchemePicker />
      </SurfaceCard>

      <SectionTitle title="Account" subtitle="The essentials for this device." />
      <SurfaceCard>
        <SettingsRow
          icon="person-outline"
          title="Account info"
          subtitle={user?.email ?? "Signed in"}
          value={user?.role ?? "Member"}
          tone="slate"
        />
        <Pressable accessibilityRole="button" onPress={() => router.push("/promo-codes" as Href)}>
          <SettingsRow
            icon="ticket-outline"
            title="Promo codes"
            subtitle="Enter a code from a DJ."
            value={promoValue}
            tone="gold"
          />
        </Pressable>
        <SettingsRow
          icon="shield-checkmark-outline"
          title="Security"
          subtitle="Password protected session."
          value="Good"
          tone="mint"
        />
        <SettingsRow
          icon="card-outline"
          title="Payment methods"
          subtitle="Cards and billing history."
          value="2 saved"
          tone="gold"
        />
        <Pressable accessibilityRole="button" onPress={() => void handleSignOut()} style={styles.logoutRow}>
          <View style={styles.logoutIcon}>
            <Ionicons color={theme.colors.coral} name="log-out-outline" size={18} />
          </View>
          <View style={styles.logoutCopy}>
            <Text style={styles.logoutTitle}>Log out</Text>
            <Text style={styles.logoutSubtitle}>Sign out of this device.</Text>
          </View>
          <Ionicons color={theme.colors.coral} name="chevron-forward" size={18} />
        </Pressable>
      </SurfaceCard>

      <SectionTitle title="Preferences" subtitle="Simple controls for rooms and alerts." />
      <SurfaceCard>
        <ToggleRow
          icon="notifications-outline"
          title="Push notifications"
          subtitle="Tell me when my songs move."
          value={pushEnabled}
          onValueChange={setPushEnabled}
        />
        <ToggleRow
          icon="navigate-outline"
          title="Nearby DJ alerts"
          subtitle="Show live rooms around me."
          value={nearbyAlerts}
          onValueChange={setNearbyAlerts}
          tone="gold"
        />
        <ToggleRow
          icon="location-outline"
          title="Location sharing"
          subtitle="Use my location for the right venue list."
          value={locationSharing}
          onValueChange={setLocationSharing}
          tone="slate"
        />
      </SurfaceCard>

      <SectionTitle title="Help" subtitle="Support and details." />
      <SurfaceCard>
        <ActionRow icon="help-circle-outline" title="FAQ" subtitle="Questions about requests and refunds." value="Open" tone="slate" />
        <ActionRow icon="chatbubble-ellipses-outline" title="Support" subtitle="Contact the RQST team." value="Chat" tone="mint" />
        <ActionRow icon="document-text-outline" title="Terms" subtitle="Policy and payment details." value="Read" tone="gold" />
      </SurfaceCard>
    </ScreenShell>
  );
}
