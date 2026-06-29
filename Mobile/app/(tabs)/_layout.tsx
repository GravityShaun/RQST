import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";

import { premiumTheme } from "../../src/components/premium-ui";

const tabs = [
  { name: "home", title: "Home", icon: "home-outline" as const, activeIcon: "home" as const },
  { name: "find", title: "Find", icon: "compass-outline" as const, activeIcon: "compass" as const },
  { name: "list", title: "List", icon: "list-outline" as const, activeIcon: "list" as const },
  { name: "requests", title: "RQST", icon: "add" as const, activeIcon: "add" as const },
  { name: "settings", title: "Settings", icon: "person-outline" as const, activeIcon: "person" as const },
];

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: {
          backgroundColor: premiumTheme.colors.background,
        },
        tabBarShowLabel: false,
        tabBarStyle: styles.tabBar,
        tabBarBackground: () => <View style={styles.tabBarBackground} />,
      }}
    >
      {tabs.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab.title,
            tabBarIcon: ({ focused }) => (
              <View style={styles.tabItemWrap}>
                <View style={[styles.tabItem, focused && styles.tabItemActive, tab.name === "requests" && styles.requestTab]}>
                  <Ionicons
                    name={focused ? tab.activeIcon : tab.icon}
                    size={tab.name === "requests" ? 22 : 19}
                    color={tab.name === "requests" ? premiumTheme.colors.text : focused ? premiumTheme.colors.text : premiumTheme.colors.muted}
                  />
                </View>
                <Text style={[styles.tabLabel, focused && styles.tabLabelActive]}>{tab.title}</Text>
              </View>
            ),
          }}
        />
      ))}
    </Tabs>
  );
}

const styles = StyleSheet.create({
  requestTab: {
    backgroundColor: "#C94B4B",
    borderColor: "rgba(255,255,255,0.18)",
    borderWidth: 1,
    shadowColor: "#C94B4B",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.32,
    shadowRadius: 12,
  },
  tabBar: {
    backgroundColor: "transparent",
    borderTopWidth: 0,
    bottom: 0,
    elevation: 0,
    height: 76,
    left: 12,
    paddingHorizontal: 10,
    paddingBottom: 8,
    paddingTop: 4,
    position: "absolute",
    right: 12,
  },
  tabBarBackground: {
    backgroundColor: "rgba(38,40,54,0.98)",
    borderColor: premiumTheme.colors.border,
    borderRadius: 22,
    borderWidth: 1,
    flex: 1,
  },
  tabItem: {
    alignItems: "center",
    backgroundColor: "transparent",
    borderRadius: 20,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  tabItemActive: {
    backgroundColor: premiumTheme.colors.surfaceMuted,
  },
  tabItemWrap: {
    alignItems: "center",
    gap: 2,
    justifyContent: "center",
    minWidth: 54,
  },
  tabLabel: {
    color: premiumTheme.colors.muted,
    fontSize: 10,
    fontWeight: "700",
  },
  tabLabelActive: {
    color: premiumTheme.colors.text,
  },
});
