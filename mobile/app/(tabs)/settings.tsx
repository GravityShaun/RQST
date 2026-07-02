import { useState } from "react";
import { Image, ImageBackground, StyleSheet, Text, View } from "react-native";

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
import { unsplashImages } from "../../src/lib/unsplash";

export default function SettingsScreen() {
  const [pushEnabled, setPushEnabled] = useState(true);
  const [nearbyAlerts, setNearbyAlerts] = useState(true);
  const [locationSharing, setLocationSharing] = useState(true);

  return (
    <ScreenShell>
      <ImageBackground source={{ uri: unsplashImages.settingsProfile }} imageStyle={styles.profileImage} style={styles.profileCard}>
        <View style={styles.profileOverlay} />
        <Image source={{ uri: unsplashImages.settingsProfile }} style={styles.avatar} />
        <Text style={styles.profileName}>Maya Young</Text>
        <Text style={styles.profileMood}>Ready for tonight</Text>

        <View style={styles.pillRow}>
          <StatPill label="Wallet" value="2 cards" tone="gold" />
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
        <SettingsRow icon="person-outline" title="Account info" subtitle="Name, email, and username." value="Edit" tone="slate" />
        <SettingsRow icon="shield-checkmark-outline" title="Security" subtitle="Password and trusted devices." value="Good" tone="mint" />
        <SettingsRow icon="card-outline" title="Payment methods" subtitle="Cards and billing history." value="2 saved" tone="gold" />
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
  avatar: {
    borderRadius: 38,
    height: 76,
    width: 76,
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
