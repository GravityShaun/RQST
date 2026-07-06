import { useEffect, useRef, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { useIsFocused } from "@react-navigation/native";
import * as Location from "expo-location";
import {
  Animated,
  InteractionManager,
  PanResponder,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE, type MapStyleElement, type Region } from "react-native-maps";

import {
  SectionTitle,
  StatPill,
  Tag,
  VenueCard,
  premiumTheme,
} from "../../src/components/premium-ui";
import { DirectorySearch } from "../../src/features/discover/DirectorySearch";
import { nearbyVenues } from "../../src/features/rqst/mock-data";
import type { DiscoverVenue } from "../../src/lib/discover-api";

const drawerTone = {
  gold: premiumTheme.colors.gold,
  mint: premiumTheme.colors.mint,
  coral: premiumTheme.colors.coral,
  slate: premiumTheme.colors.slate,
} as const;

const CHARLESTON_REGION: Region = {
  latitude: 32.7765,
  latitudeDelta: 0.05,
  longitude: -79.9311,
  longitudeDelta: 0.05,
};

const DARK_MAP_STYLE: MapStyleElement[] = [
  {
    featureType: "all",
    elementType: "labels.text.fill",
    stylers: [{ color: "#ffffff" }],
  },
  {
    featureType: "all",
    elementType: "labels.text.stroke",
    stylers: [{ color: "#021019" }, { lightness: 13 }],
  },
  {
    featureType: "administrative",
    elementType: "geometry.fill",
    stylers: [{ color: "#08304b" }],
  },
  {
    featureType: "administrative",
    elementType: "geometry.stroke",
    stylers: [{ color: "#144b53" }, { lightness: 14 }, { weight: 1.4 }],
  },
  {
    featureType: "landscape",
    elementType: "all",
    stylers: [{ color: "#08304b" }],
  },
  {
    featureType: "poi",
    elementType: "geometry",
    stylers: [{ color: "#0c4152" }, { lightness: 5 }],
  },
  {
    featureType: "road.highway",
    elementType: "geometry.fill",
    stylers: [{ color: "#0b434f" }],
  },
  {
    featureType: "road.highway",
    elementType: "geometry.stroke",
    stylers: [{ color: "#0b434f" }, { lightness: 25 }],
  },
  {
    featureType: "road.arterial",
    elementType: "geometry.fill",
    stylers: [{ color: "#0b3d51" }],
  },
  {
    featureType: "road.arterial",
    elementType: "geometry.stroke",
    stylers: [{ color: "#0b3d51" }, { lightness: 16 }],
  },
  {
    featureType: "road.local",
    elementType: "geometry",
    stylers: [{ color: "#144b53" }],
  },
  {
    featureType: "transit",
    elementType: "all",
    stylers: [{ color: "#146474" }],
  },
  {
    featureType: "water",
    elementType: "all",
    stylers: [{ color: "#0b3d51" }],
  },
];

const COLLAPSED_PEEK = 230;
const EXPANDED_TOP_GAP = 140;
const TAB_BAR_CLEARANCE = 102;
const MAP_ANIMATION_MS = 450;
const IOS_TOP_INSET = 44;
const APPLE_ATTRIBUTION_BOTTOM_INSET = 4;

function regionFromCoordinates(latitude: number, longitude: number): Region {
  return {
    latitude,
    latitudeDelta: 0.05,
    longitude,
    longitudeDelta: 0.05,
  };
}

export default function FindScreen() {
  const { height } = useWindowDimensions();
  const isFocused = useIsFocused();
  const mapRef = useRef<MapView | null>(null);
  const [selectedVenueTitle, setSelectedVenueTitle] = useState(nearbyVenues[0]?.title ?? "");
  const [isExpanded, setIsExpanded] = useState(false);
  const [hasLocationPermission, setHasLocationPermission] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [shouldRenderMap, setShouldRenderMap] = useState(false);

  const selectedVenue = nearbyVenues.find((venue) => venue.title === selectedVenueTitle) ?? nearbyVenues[0];

  if (!selectedVenue) {
    return null;
  }

  const featuredVenue = nearbyVenues[1] ?? selectedVenue;
  const topInset = Platform.OS === "ios" ? IOS_TOP_INSET : StatusBar.currentHeight ?? 24;
  const openTop = Math.max(EXPANDED_TOP_GAP, topInset + 88);
  const closedTop = Math.max(openTop + 120, height - COLLAPSED_PEEK - TAB_BAR_CLEARANCE);
  const closedOffset = closedTop - openTop;
  const mapBottomPadding = height - closedTop + TAB_BAR_CLEARANCE + 24;

  const drawerOffset = useRef(new Animated.Value(closedOffset)).current;
  const gestureStartOffset = useRef(closedOffset);

  useEffect(() => {
    drawerOffset.setValue(isExpanded ? 0 : closedOffset);
  }, [closedOffset, drawerOffset, isExpanded]);

  useEffect(() => {
    if (!isFocused) {
      setShouldRenderMap(false);
      return;
    }

    let isCancelled = false;
    const task = InteractionManager.runAfterInteractions(() => {
      if (!isCancelled) {
        setShouldRenderMap(true);
      }
    });

    return () => {
      isCancelled = true;
      task.cancel();
    };
  }, [isFocused]);

  function animateDrawer(nextExpanded: boolean) {
    setIsExpanded(nextExpanded);

    Animated.spring(drawerOffset, {
      damping: 24,
      mass: 0.9,
      stiffness: 220,
      toValue: nextExpanded ? 0 : closedOffset,
      useNativeDriver: false,
    }).start();
  }

  function focusVenue(venueTitle: string) {
    const venue = nearbyVenues.find((item) => item.title === venueTitle);

    if (!venue) {
      return;
    }

    setSelectedVenueTitle(venue.title);
    mapRef.current?.animateToRegion(
      regionFromCoordinates(venue.latitude, venue.longitude),
      MAP_ANIMATION_MS,
    );
  }

  function handleDiscoverVenuePress(venue: DiscoverVenue) {
    setSelectedVenueTitle(venue.name);

    if (venue.latitude != null && venue.longitude != null) {
      mapRef.current?.animateToRegion(
        regionFromCoordinates(venue.latitude, venue.longitude),
        MAP_ANIMATION_MS,
      );
      return;
    }

    const matchedVenue = nearbyVenues.find(
      (item) => item.title.toLowerCase() === venue.name.toLowerCase(),
    );

    if (matchedVenue) {
      mapRef.current?.animateToRegion(
        regionFromCoordinates(matchedVenue.latitude, matchedVenue.longitude),
        MAP_ANIMATION_MS,
      );
    }
  }

  async function handleLocatePress() {
    setIsLocating(true);

    try {
      const permission = await Location.requestForegroundPermissionsAsync();

      if (permission.status !== "granted") {
        setHasLocationPermission(false);
        mapRef.current?.animateToRegion(CHARLESTON_REGION, MAP_ANIMATION_MS);
        return;
      }

      await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Highest,
      });

      setHasLocationPermission(true);
      mapRef.current?.animateToRegion(CHARLESTON_REGION, MAP_ANIMATION_MS);
    } catch {
      setHasLocationPermission(false);
      mapRef.current?.animateToRegion(CHARLESTON_REGION, MAP_ANIMATION_MS);
    } finally {
      setIsLocating(false);
    }
  }

  const panResponder = PanResponder.create({
    onMoveShouldSetPanResponder: (_, gestureState) => Math.abs(gestureState.dy) > 6,
    onPanResponderGrant: () => {
      drawerOffset.stopAnimation((value) => {
        gestureStartOffset.current = value;
      });
    },
    onPanResponderMove: (_, gestureState) => {
      const nextOffset = Math.max(0, Math.min(closedOffset, gestureStartOffset.current + gestureState.dy));
      drawerOffset.setValue(nextOffset);
    },
    onPanResponderRelease: (_, gestureState) => {
      const projectedOffset = gestureStartOffset.current + gestureState.dy;
      const shouldExpand = gestureState.vy < -0.65 || projectedOffset < closedOffset * 0.55;
      animateDrawer(shouldExpand);
    },
    onPanResponderTerminate: () => {
      animateDrawer(isExpanded);
    },
  });

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.mapWrap}>
        {shouldRenderMap ? (
          <MapView
            ref={mapRef}
            appleLogoInsets={
              Platform.OS === "ios"
                ? { bottom: APPLE_ATTRIBUTION_BOTTOM_INSET, left: 8, right: 0, top: 0 }
                : undefined
            }
            initialRegion={CHARLESTON_REGION}
            legalLabelInsets={
              Platform.OS === "ios"
                ? { bottom: APPLE_ATTRIBUTION_BOTTOM_INSET, left: 8, right: 0, top: 0 }
                : undefined
            }
            mapPadding={{
              bottom: mapBottomPadding,
              left: 0,
              right: 0,
              top: 180,
            }}
            customMapStyle={Platform.OS === "android" ? DARK_MAP_STYLE : undefined}
            mapType={Platform.OS === "ios" ? "mutedStandard" : "standard"}
            provider={Platform.OS === "android" ? PROVIDER_GOOGLE : undefined}
            showsBuildings
            showsCompass={false}
            showsMyLocationButton={false}
            showsUserLocation={hasLocationPermission}
            style={styles.map}
            userInterfaceStyle="dark"
          >
            {nearbyVenues.map((venue) => {
              const isSelected = venue.title === selectedVenue.title;

              return (
                <Marker
                  coordinate={{ latitude: venue.latitude, longitude: venue.longitude }}
                  description={`${venue.distance} · $${venue.requestFloorCents / 100} minimum`}
                  key={venue.title}
                  onPress={() => focusVenue(venue.title)}
                  title={venue.title}
                >
                  <View style={styles.markerShell}>
                    <View
                      style={[
                        styles.markerCore,
                        { backgroundColor: drawerTone[venue.tone] },
                        isSelected && styles.markerCoreActive,
                      ]}
                    >
                      <Ionicons color={premiumTheme.colors.ink} name="radio" size={15} />
                    </View>
                    <View
                      style={[
                        styles.markerTip,
                        { borderTopColor: drawerTone[venue.tone] },
                        isSelected && styles.markerTipActive,
                      ]}
                    />
                  </View>
                </Marker>
              );
            })}
          </MapView>
        ) : (
          <View style={[styles.map, styles.mapPlaceholder]} />
        )}

        <View style={styles.topOverlay}>
          <DirectorySearch
            onVenuePress={handleDiscoverVenuePress}
            trailingAction={
              <Pressable onPress={handleLocatePress} style={styles.circleButton}>
                <Ionicons
                  color={premiumTheme.colors.ink}
                  name={isLocating ? "sync-outline" : "locate-outline"}
                  size={20}
                />
              </Pressable>
            }
            variant="overlay"
          />
        </View>

        <Animated.View
          style={[
            styles.drawer,
            {
              paddingBottom: TAB_BAR_CLEARANCE,
              top: openTop,
              transform: [{ translateY: drawerOffset }],
            },
          ]}
        >
          <View {...panResponder.panHandlers} style={styles.drawerHandleArea}>
            <Pressable onPress={() => animateDrawer(!isExpanded)} style={styles.drawerPreview}>
              <View style={styles.handle} />
              <View style={styles.drawerPreviewRow}>
                <View style={styles.drawerPreviewCopy}>
                  <Text style={styles.drawerEyebrow}>Closest live room</Text>
                  <Text style={styles.drawerTitle}>{selectedVenue.title}</Text>
                  <Text style={styles.drawerSubtitle}>
                    {selectedVenue.distance} · ${selectedVenue.requestFloorCents / 100} floor
                  </Text>
                </View>
                <View style={[styles.drawerToneDot, { backgroundColor: drawerTone[selectedVenue.tone] }]} />
                <View style={styles.drawerAction}>
                  <Ionicons
                    color={premiumTheme.colors.ink}
                    name={isExpanded ? "chevron-down" : "chevron-up"}
                    size={20}
                  />
                </View>
              </View>
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.drawerContent} showsVerticalScrollIndicator={false}>
            <View style={styles.pillRow}>
              <StatPill label="Best vibe" value={featuredVenue.title} tone={featuredVenue.tone} />
              <StatPill label="Fastest queue" value={selectedVenue.tags[0] ?? "Live now"} tone={selectedVenue.tone} />
            </View>

            <View style={styles.filterRow}>
              <Tag label="Open now" tone="gold" icon="radio-outline" />
              <Tag label="Under $10" tone="mint" icon="wallet-outline" />
              <Tag label="Close by" tone="slate" icon="walk-outline" />
            </View>

            <SectionTitle title="Live rooms" subtitle="Pull up the drawer to compare active venues nearby." />

            {nearbyVenues.map((venue) => {
              const isSelected = venue.title === selectedVenue.title;

              return (
                <Pressable
                  key={venue.title}
                  onPress={() => focusVenue(venue.title)}
                  style={[styles.venueWrap, isSelected && styles.venueWrapActive]}
                >
                  <VenueCard {...venue} />
                </Pressable>
              );
            })}
          </ScrollView>
        </Animated.View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  circleButton: {
    alignItems: "center",
    backgroundColor: "#F7F5F2",
    borderColor: premiumTheme.colors.border,
    borderRadius: 24,
    borderWidth: 1,
    height: 48,
    justifyContent: "center",
    shadowColor: "#5B6474",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
    width: 48,
  },
  drawer: {
    backgroundColor: "#EFECE9",
    borderColor: premiumTheme.colors.border,
    borderTopLeftRadius: 34,
    borderTopRightRadius: 34,
    borderWidth: 1,
    bottom: -32,
    overflow: "hidden",
    position: "absolute",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.28,
    shadowRadius: 24,
  },
  drawerAction: {
    alignItems: "center",
    backgroundColor: "rgba(224, 90, 71, 0.12)",
    borderRadius: 18,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  drawerContent: {
    gap: 18,
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  drawerEyebrow: {
    color: premiumTheme.colors.inkMuted,
    fontFamily: premiumTheme.fonts.body,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.1,
    textTransform: "uppercase",
  },
  drawerHandleArea: {
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  drawerPreview: {
    gap: 16,
    paddingBottom: 8,
  },
  drawerPreviewCopy: {
    flex: 1,
    gap: 6,
  },
  drawerPreviewRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
  },
  drawerSubtitle: {
    color: premiumTheme.colors.inkMuted,
    fontFamily: premiumTheme.fonts.body,
    fontSize: 13,
    lineHeight: 18,
  },
  drawerTitle: {
    color: premiumTheme.colors.ink,
    fontFamily: premiumTheme.fonts.display,
    fontSize: 24,
    fontWeight: "800",
    lineHeight: 28,
  },
  drawerToneDot: {
    borderRadius: 7,
    height: 14,
    width: 14,
  },
  filterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  handle: {
    alignSelf: "center",
    backgroundColor: "rgba(30,23,23,0.34)",
    borderRadius: 999,
    height: 5,
    width: 56,
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  mapPlaceholder: {
    backgroundColor: "#0c4152",
  },
  mapWrap: {
    backgroundColor: "#021019",
    flex: 1,
  },
  markerCore: {
    alignItems: "center",
    borderColor: "rgba(255,255,255,0.86)",
    borderRadius: 18,
    borderWidth: 2,
    height: 36,
    justifyContent: "center",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.28,
    shadowRadius: 12,
    width: 36,
  },
  markerCoreActive: {
    borderColor: "#FFFFFF",
    height: 42,
    width: 42,
  },
  markerShell: {
    alignItems: "center",
  },
  markerTip: {
    borderLeftColor: "transparent",
    borderLeftWidth: 6,
    borderRightColor: "transparent",
    borderRightWidth: 6,
    borderTopWidth: 10,
    marginTop: -2,
  },
  markerTipActive: {
    borderLeftWidth: 7,
    borderRightWidth: 7,
    borderTopWidth: 12,
  },
  pillRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  screen: {
    backgroundColor: premiumTheme.colors.background,
    flex: 1,
  },
  topOverlay: {
    left: 20,
    position: "absolute",
    right: 20,
    top: 12,
    zIndex: 2,
  },
  venueWrap: {
    borderRadius: premiumTheme.radii.lg,
  },
  venueWrapActive: {
    backgroundColor: "#FFFFFF",
    shadowColor: "#F6B734",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 18,
  },
});
