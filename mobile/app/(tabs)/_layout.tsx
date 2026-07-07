import { Redirect, Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useMemo } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";

import { useAuthStore } from "../../src/store/auth";
import { usePremiumTheme } from "../../src/store/theme";

const tabs = [
  { name: "home", title: "Home", icon: "home-outline" as const, activeIcon: "home" as const },
  { name: "find", title: "Find", icon: "compass-outline" as const, activeIcon: "compass" as const },
  { name: "list", title: "List", icon: "list-outline" as const, activeIcon: "list" as const },
  { name: "requests", title: "Request", icon: "add" as const, activeIcon: "add" as const },
  { name: "settings", title: "Settings", icon: "person-outline" as const, activeIcon: "person" as const },
];

export default function TabsLayout() {
  const status = useAuthStore((state) => state.status);
  const theme = usePremiumTheme();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        loadingScreen: {
          alignItems: "center",
          backgroundColor: theme.colors.background,
          flex: 1,
          justifyContent: "center",
        },
        requestTab: {
          backgroundColor: theme.colors.coral,
          borderColor: "rgba(255,255,255,0.24)",
          borderWidth: 1,
          shadowColor: theme.colors.coral,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.24,
          shadowRadius: 14,
        },
        requestTabActive: {
          backgroundColor: "#87A8D8",
          borderColor: "#4C5F7D",
          borderWidth: 0.75,
          shadowColor: "#16202F",
          shadowOffset: { width: 0, height: 10 },
          shadowOpacity: 0.32,
          shadowRadius: 22,
        },
        tabBar: {
          backgroundColor: "#4A5466",
          borderColor: theme.colors.border,
          borderRadius: 22,
          borderWidth: 1,
          borderTopWidth: 0,
          bottom: -4,
          elevation: 0,
          height: 76,
          left: 8,
          paddingHorizontal: 4,
          paddingBottom: 8,
          paddingTop: 4,
          position: "absolute",
          right: 8,
        },
        tabBarItem: {
          flex: 1,
          minWidth: 0,
          paddingTop: 4,
        },
        tabItem: {
          alignItems: "center",
          backgroundColor: "transparent",
          borderRadius: 20,
          height: 40,
          justifyContent: "center",
          marginTop: -24,
          width: 40,
        },
        tabItemActive: {
          backgroundColor: "#D7DBDE",
          borderColor: "#3F4754",
          borderWidth: 0.75,
          shadowColor: "#16202F",
          shadowOffset: { width: 0, height: 10 },
          shadowOpacity: 0.32,
          shadowRadius: 22,
        },
        tabLabel: {
          fontFamily: theme.fonts.body,
          fontSize: 9,
          fontWeight: "700",
          marginTop: -5,
          paddingBottom: 4,
          textAlign: "center",
        },
      }),
    [theme],
  );

  if (status === "loading") {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator color={theme.colors.coral} size="large" />
      </View>
    );
  }

  if (status === "unauthenticated") {
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        lazy: true,
        freezeOnBlur: true,
        sceneStyle: {
          backgroundColor: theme.colors.background,
        },
        tabBarShowLabel: true,
        tabBarActiveTintColor: "#FFFFFF",
        tabBarInactiveTintColor: "rgba(223, 230, 240, 0.72)",
        tabBarLabelStyle: styles.tabLabel,
        tabBarItemStyle: styles.tabBarItem,
        tabBarStyle: styles.tabBar,
      }}
    >
      {tabs.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            sceneStyle: tab.name === "requests" ? { backgroundColor: "transparent" } : undefined,
            title: tab.title,
            tabBarLabel: tab.title,
            tabBarIcon: ({ focused }) => (
              <View
                style={[
                  styles.tabItem,
                  focused && styles.tabItemActive,
                  tab.name === "requests" && styles.requestTab,
                  tab.name === "requests" && focused && styles.requestTabActive,
                ]}
              >
                <Ionicons
                  name={focused ? tab.activeIcon : tab.icon}
                  size={tab.name === "requests" ? 22 : 19}
                  color={
                    tab.name === "requests"
                      ? focused
                        ? theme.colors.coral
                        : "#FFFFFF"
                      : focused
                        ? theme.colors.coral
                        : "#FFFFFF"
                  }
                />
              </View>
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
