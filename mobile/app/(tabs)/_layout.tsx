import { Redirect, Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { ActivityIndicator, StyleSheet, View } from "react-native";

import { premiumTheme } from "../../src/components/premium-ui";
import { useAuthStore } from "../../src/store/auth";

const tabs = [
  { name: "home", title: "Home", icon: "home-outline" as const, activeIcon: "home" as const },
  { name: "find", title: "Find", icon: "compass-outline" as const, activeIcon: "compass" as const },
  { name: "list", title: "List", icon: "list-outline" as const, activeIcon: "list" as const },
  { name: "requests", title: "Request", icon: "add" as const, activeIcon: "add" as const },
  { name: "settings", title: "Settings", icon: "person-outline" as const, activeIcon: "person" as const },
];

export default function TabsLayout() {
  const status = useAuthStore((state) => state.status);

  if (status === "loading") {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator color={premiumTheme.colors.coral} size="large" />
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
        sceneStyle: {
          backgroundColor: premiumTheme.colors.background,
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
                        ? premiumTheme.colors.coral
                        : "#FFFFFF"
                      : focused
                        ? premiumTheme.colors.coral
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

const styles = StyleSheet.create({
  loadingScreen: {
    alignItems: "center",
    backgroundColor: premiumTheme.colors.background,
    flex: 1,
    justifyContent: "center",
  },
  requestTab: {
    backgroundColor: "#E05A47",
    borderColor: "rgba(255,255,255,0.24)",
    borderWidth: 1,
    shadowColor: "#E05A47",
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
    borderColor: premiumTheme.colors.border,
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
    backgroundColor: premiumTheme.colors.background,
    borderColor: "#3F4754",
    borderWidth: 0.75,
    shadowColor: "#16202F",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.32,
    shadowRadius: 22,
  },
  tabLabel: {
    fontFamily: premiumTheme.fonts.body,
    fontSize: 9,
    fontWeight: "700",
    marginTop: -5,
    paddingBottom: 4,
    textAlign: "center",
  },
});
