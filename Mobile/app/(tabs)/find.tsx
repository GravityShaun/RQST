import { useEffect, useRef, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import {
  Animated,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE, type Region } from "react-native-maps";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import {
  SearchField,
  SectionTitle,
  StatPill,
  Tag,
  VenueCard,
  premiumTheme,
} from "../../src/components/premium-ui";
import { nearbyVenues } from "../../src/features/rqst/mock-data";

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

const COLLAPSED_PEEK = 230;
const EXPANDED_TOP_GAP = 140;
const TAB_BAR_CLEARANCE = 102;
const MAP_ANIMATION_MS = 450;

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
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapView | null>(null);
  const [selectedVenueTitle, setSelectedVenueTitle] = useState(nearbyVenues[0]?.title ?? "");
  const [isExpanded, setIsExpanded] = useState(false);
  const [hasLocationPermission, setHasLocationPermission] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [mapHeading, setMapHeading] = useState("Charleston, SC");

  const selectedVenue = nearbyVenues.find((venue) => venue.title === selectedVenueTitle) ?? nearbyVenues[0];

  if (!selectedVenue) {
    return null;
  }

  const featuredVenue = nearbyVenues[1] ?? selectedVenue;
  const openTop = Math.max(EXPANDED_TOP_GAP, insets.top + 88);
  const closedTop = Math.max(openTop + 120, height - COLLAPSED_PEEK - TAB_BAR_CLEARANCE);
  const closedOffset = closedTop - openTop;
  const mapBottomPadding = height - closedTop + TAB_BAR_CLEARANCE + 24;

  const drawerOffset = useRef(new Animated.Value(closedOffset)).current;
  const gestureStartOffset = useRef(closedOffset);

  useEffect(() => {
    drawerOffset.setValue(isExpanded ? 0 : closedOffset);
  }, [closedOffset, drawerOffset, isExpanded]);

  useEffect(() => {
    let isMounted = true;

    async function centerOnUser() {
      setIsLocating(true);

      try {
        const permission = await Location.requestForegroundPermissionsAsync();

        if (!isMounted || permission.status !== "granted") {
          if (isMounted) {
            setHasLocationPermission(false);
            setMapHeading("Charleston, SC");
          }
          return;
        }

        const position = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });

        if (!isMounted) {
          return;
        }

        const nextRegion = regionFromCoordinates(position.coords.latitude, position.coords.longitude);
        setHasLocationPermission(true);
        setMapHeading("Near you");
        mapRef.current?.animateToRegion(nextRegion, MAP_ANIMATION_MS);
      } catch {
        if (isMounted) {
          setHasLocationPermission(false);
          setMapHeading("Charleston, SC");
        }
      } finally {
        if (isMounted) {
          setIsLocating(false);
        }
      }
    }

    void centerOnUser();

    return () => {
      isMounted = false;
    };
  }, []);

  function animateDrawer(nextExpanded: boolean) {
    setIsExpanded(nextExpanded);

    Animated.spring(drawerOffset, {
      damping: 24,
      mass: 0.9,
      stiffness: 220,
      toValue: nextExpanded ? 0 : closedOffset,
      useNativeDriver: true,
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

  async function handleLocatePress() {
    setIsLocating(true);

    try {
      const permission = await Location.requestForegroundPermissionsAsync();

      if (permission.status !== "granted") {
        setHasLocationPermission(false);
        setMapHeading("Charleston, SC");
        mapRef.current?.animateToRegion(CHARLESTON_REGION, MAP_ANIMATION_MS);
        return;
      }

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Highest,
      });
      const nextRegion = regionFromCoordinates(position.coords.latitude, position.coords.longitude);

      setHasLocationPermission(true);
      setMapHeading("Near you");
      mapRef.current?.animateToRegion(nextRegion, MAP_ANIMATION_MS);
    } catch {
      setHasLocationPermission(false);
      setMapHeading("Charleston, SC");
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

  const mapShadeOpacity = drawerOffset.interpolate({
    inputRange: [0, closedOffset || 1],
    outputRange: [0.14, 0],
    extrapolate: "clamp",
  });

  return (
    <SafeAreaView edges={["top"]} style={styles.screen}>
      <View style={styles.mapWrap}>
        <MapView
          ref={mapRef}
          initialRegion={CHARLESTON_REGION}
          mapPadding={{
            bottom: mapBottomPadding,
            left: 0,
            right: 0,
            top: 180,
          }}
          provider={Platform.OS === "android" ? PROVIDER_GOOGLE : undefined}
          showsBuildings
          showsCompass={false}
          showsMyLocationButton={false}
          showsUserLocation={hasLocationPermission}
          style={styles.map}
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
                    <Ionicons
                      color={isSelected ? premiumTheme.colors.background : premiumTheme.colors.text}
                      name="radio"
                      size={15}
                    />
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

        <Animated.View pointerEvents="none" style={[styles.mapShade, { opacity: mapShadeOpacity }]} />

        <View style={styles.mapBadge}>
          <Ionicons name="radio-outline" size={16} color={premiumTheme.colors.background} />
          <Text style={styles.mapBadgeText}>{nearbyVenues.length} live rooms</Text>
        </View>

        <View style={styles.neighborhoodLabel}>
          <Text style={styles.neighborhoodEyebrow}>
            {hasLocationPermission ? "Showing venues near" : "Fallback center"}
          </Text>
          <Text style={styles.neighborhoodTitle}>{mapHeading}</Text>
        </View>

        <View style={styles.topOverlay}>
          <View style={styles.topBar}>
            <View>
              <Text style={styles.eyebrow}>Discover</Text>
              <Text style={styles.title}>Find a DJ</Text>
            </View>
            <Pressable onPress={handleLocatePress} style={styles.circleButton}>
              <Ionicons
                color={premiumTheme.colors.text}
                name={isLocating ? "sync-outline" : "locate-outline"}
                size={20}
              />
            </Pressable>
          </View>

          <SearchField label="Search nearby" value="Venues, artists, or neighborhoods" />
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
                    color={premiumTheme.colors.text}
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
    backgroundColor: "rgba(16,16,22,0.62)",
    borderColor: "rgba(255,255,255,0.18)",
    borderRadius: 24,
    borderWidth: 1,
    height: 48,
    justifyContent: "center",
    width: 48,
  },
  drawer: {
    backgroundColor: "rgba(17,18,24,0.98)",
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
    backgroundColor: premiumTheme.colors.surfaceMuted,
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
    color: premiumTheme.colors.muted,
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
    color: premiumTheme.colors.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  drawerTitle: {
    color: premiumTheme.colors.text,
    fontSize: 24,
    fontWeight: "800",
    lineHeight: 28,
  },
  drawerToneDot: {
    borderRadius: 7,
    height: 14,
    width: 14,
  },
  eyebrow: {
    color: "rgba(247,243,239,0.76)",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  filterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  handle: {
    alignSelf: "center",
    backgroundColor: "rgba(255,255,255,0.22)",
    borderRadius: 999,
    height: 5,
    width: 56,
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  mapBadge: {
    alignItems: "center",
    backgroundColor: "#F6B734",
    borderRadius: 999,
    flexDirection: "row",
    gap: 8,
    left: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
    position: "absolute",
    top: 182,
  },
  mapBadgeText: {
    color: premiumTheme.colors.background,
    fontSize: 13,
    fontWeight: "800",
  },
  mapShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: premiumTheme.colors.background,
  },
  mapWrap: {
    backgroundColor: premiumTheme.colors.background,
    flex: 1,
  },
  markerCore: {
    alignItems: "center",
    borderColor: "rgba(255,255,255,0.3)",
    borderRadius: 18,
    borderWidth: 2,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  markerCoreActive: {
    borderColor: premiumTheme.colors.text,
    transform: [{ scale: 1.08 }],
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
    transform: [{ scaleY: 1.1 }],
  },
  neighborhoodEyebrow: {
    color: "rgba(16,16,22,0.54)",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.1,
    textTransform: "uppercase",
  },
  neighborhoodLabel: {
    left: 20,
    position: "absolute",
    top: 112,
  },
  neighborhoodTitle: {
    color: premiumTheme.colors.background,
    fontSize: 36,
    fontWeight: "800",
    lineHeight: 40,
    marginTop: 6,
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
  title: {
    color: premiumTheme.colors.text,
    fontSize: 32,
    fontWeight: "800",
    lineHeight: 36,
    marginTop: 4,
  },
  topBar: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  topOverlay: {
    gap: 16,
    left: 20,
    position: "absolute",
    right: 20,
    top: 12,
  },
  venueWrap: {
    borderRadius: premiumTheme.radii.lg,
  },
  venueWrapActive: {
    shadowColor: "#F6B734",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 18,
  },
});
