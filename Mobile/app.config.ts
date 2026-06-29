import type { ExpoConfig } from "expo/config";

const googleMapsApiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";

const config: ExpoConfig = {
  name: "RQST",
  slug: "rqst",
  scheme: "rqst",
  orientation: "portrait",
  plugins: [
    "expo-router",
    [
      "expo-location",
      {
        locationWhenInUsePermission: "RQST uses your location to show nearby DJs and venues on the map.",
      },
    ],
    [
      "react-native-maps",
      {
        androidGoogleMapsApiKey: googleMapsApiKey,
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
  },
  ios: {
    bundleIdentifier: "com.gravshaun.rqst",
    infoPlist: {
      NSLocationWhenInUseUsageDescription: "RQST uses your location to show nearby DJs and venues on the map.",
    },
  },
  android: {
    package: "com.gravshaun.rqst",
    permissions: ["ACCESS_COARSE_LOCATION", "ACCESS_FINE_LOCATION"],
  },
};

export default config;
