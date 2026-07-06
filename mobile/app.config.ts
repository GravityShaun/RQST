import type { ExpoConfig } from "expo/config";

const googleMapsApiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";

const config: ExpoConfig = {
  name: "RQST",
  slug: "rqst",
  owner: "gravshaun",
  scheme: "rqst",
  orientation: "portrait",
  newArchEnabled: false,
  plugins: [
    "expo-router",
    [
      "expo-location",
      {
        locationWhenInUsePermission: "RQST uses your location to show nearby DJs and venues on the map.",
      },
    ],
    [
      "expo-image-picker",
      {
        photosPermission: "RQST uses your photo library so you can upload a profile picture.",
      },
    ],
    [
      "react-native-maps",
      {
        androidGoogleMapsApiKey: googleMapsApiKey,
        iosGoogleMapsApiKey: googleMapsApiKey,
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    eas: {
      projectId: "4094da94-8e6c-4509-95c6-99834700644b",
    },
  },
  ios: {
    bundleIdentifier: "com.gravshaun.rqst",
    infoPlist: {
      NSLocationWhenInUseUsageDescription: "RQST uses your location to show nearby DJs and venues on the map.",
      NSPhotoLibraryAddUsageDescription: "RQST saves profile pictures you choose from your photo library.",
      NSPhotoLibraryUsageDescription: "RQST uses your photo library so you can upload a profile picture.",
    },
  },
  android: {
    package: "com.gravshaun.rqst",
    permissions: ["ACCESS_COARSE_LOCATION", "ACCESS_FINE_LOCATION"],
  },
};

export default config;
