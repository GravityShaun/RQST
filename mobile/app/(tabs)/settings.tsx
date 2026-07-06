import { useState } from "react";
import { ImageBackground, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import {
  ActionRow,
  FeatureTile,
  ScreenShell,
  SectionTitle,
  SettingsRow,
  StatPill,
  SurfaceCard,
  ToggleRow,
  premiumTheme,
} from "../../src/components/premium-ui";
import { UserAvatar } from "../../src/components/UserAvatar";
import { unsplashImages } from "../../src/lib/unsplash";
import { useAuthStore } from "../../src/store/auth";

export default function SettingsScreen() {
  const [pushEnabled, setPushEnabled] = useState(true);
  const [nearbyAlerts, setNearbyAlerts] = useState(true);
  const [locationSharing, setLocationSharing] = useState(true);
  const user = useAuthStore((state) => state.user);
  const signOut = useAuthStore((state) => state.signOut);

  async function handleSignOut() {
    await signOut();
  }

  return (
    <ScreenShell>
      <ImageBackground source={{ uri: unsplashImages.settingsProfile }} imageStyle={styles.profileImage} style={styles.profileCard}>
        <View style={styles.profileOverlay} />
        <UserAvatar displayName={user?.displayName ?? "Guest"} imageUri={user?.avatarUrl} size={88} />
        <Text style={styles.profileName}>{user?.displayName ?? "Guest"}</Text>
        <Text style={styles.profileMood}>{user?.email ?? "Signed in to RQST."}</Text>

        <View style={styles.pillRow}>
          <StatPill label="Account" value="Active" tone="mint" />
          <StatPill label="Alerts" value="On" tone="mint" />
        </View>
      </ImageBackground>

      <View style={styles.metricRow}>
        <FeatureTile icon="card-outline" title="Payments" subtitle="Cards and receipts" value="Ready" tone="gold" />
        <FeatureTile icon="notifications-outline" title="Alerts" subtitle="Queue and room updates" value="Live" tone="mint" />
      </View>

      <SectionTitle title="Preferences" subtitle="Simple controls, cleaner layout." />
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

      <SectionTitle title="Account" subtitle="The essentials." />
      <SurfaceCard>
        <SettingsRow
          icon="person-outline"
          title="Account info"
          subtitle={user?.email ?? "Signed in"}
          value={user?.role ?? "Member"}
          tone="slate"
        />
        <SettingsRow
          icon="shield-checkmark-outline"
          title="Security"
          subtitle="Password protected session."
          value="Good"
          tone="mint"
        />
        <SettingsRow icon="card-outline" title="Payment methods" subtitle="Cards and billing history." value="2 saved" tone="gold" />
        <Pressable accessibilityRole="button" onPress={() => void handleSignOut()} style={styles.logoutRow}>
          <View style={styles.logoutIcon}>
            <Ionicons color={premiumTheme.colors.coral} name="log-out-outline" size={18} />
          </View>
          <View style={styles.logoutCopy}>
            <Text style={styles.logoutTitle}>Log out</Text>
            <Text style={styles.logoutSubtitle}>Sign out of this device.</Text>
          </View>
          <Ionicons color={premiumTheme.colors.coral} name="chevron-forward" size={18} />
        </Pressable>
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

const styles = StyleSheet.create({
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
    borderColor: premiumTheme.colors.border,
    borderTopWidth: 1,
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
    paddingTop: 16,
  },
  logoutSubtitle: {
    color: premiumTheme.colors.inkMuted,
    fontFamily: premiumTheme.fonts.body,
    fontSize: 13,
  },
  logoutTitle: {
    color: premiumTheme.colors.coral,
    fontFamily: premiumTheme.fonts.body,
    fontSize: 16,
    fontWeight: "700",
  },
  metricRow: {
    flexDirection: "row",
    gap: 12,
  },
  pillRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    justifyContent: "center",
  },
  profileCard: {
    alignItems: "center",
    backgroundColor: "#D95E4F",
    borderColor: "rgba(255,255,255,0.24)",
    borderRadius: 30,
    borderWidth: 1,
    overflow: "hidden",
    padding: 24,
  },
  profileImage: {
    borderRadius: 30,
  },
  profileMood: {
    color: "rgba(255,249,247,0.82)",
    fontFamily: premiumTheme.fonts.body,
    fontSize: 14,
    marginTop: 6,
    textAlign: "center",
  },
  profileName: {
    color: premiumTheme.colors.text,
    fontFamily: premiumTheme.fonts.display,
    fontSize: 34,
    fontWeight: "800",
    marginTop: 16,
  },
  profileOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(217, 94, 79, 0.46)",
  },
});
