import type { ComponentProps, PropsWithChildren, ReactNode } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { Pressable, ScrollView, StatusBar, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { formatUsd } from "@rqst/shared-config";

export type PremiumIconName = ComponentProps<typeof Ionicons>["name"];
export type PremiumTone = "gold" | "mint" | "coral" | "slate";

export const premiumTheme = {
  colors: {
    background: "#171821",
    backgroundSecondary: "#202231",
    surface: "#272938",
    surfaceElevated: "#323547",
    surfaceMuted: "#3D4156",
    border: "rgba(255,255,255,0.10)",
    text: "#F7F3EF",
    muted: "#C0BDC8",
    gold: "#E6B89B",
    mint: "#ABEAD5",
    coral: "#E09A81",
    slate: "#C2ABFA",
    ringPink: "#EF2DA8",
    ringGold: "#F6B734",
  },
  radii: {
    sm: 16,
    md: 24,
    lg: 32,
    xl: 40,
  },
} as const;

const toneStyles: Record<
  PremiumTone,
  {
    solidBackground: string;
    solidBorder: string;
    solidInk: string;
    chipBackground: string;
    chipBorder: string;
    chipInk: string;
  }
> = {
  gold: {
    solidBackground: "#D6A27F",
    solidBorder: "rgba(255,255,255,0.10)",
    solidInk: "#FFF7F1",
    chipBackground: "rgba(230, 184, 155, 0.16)",
    chipBorder: "rgba(230, 184, 155, 0.36)",
    chipInk: "#F1D0BB",
  },
  mint: {
    solidBackground: "#93D6BF",
    solidBorder: "rgba(255,255,255,0.10)",
    solidInk: "#08100E",
    chipBackground: "rgba(171, 234, 213, 0.16)",
    chipBorder: "rgba(171, 234, 213, 0.36)",
    chipInk: "#D2FFF1",
  },
  coral: {
    solidBackground: "#CA806A",
    solidBorder: "rgba(255,255,255,0.10)",
    solidInk: "#FFF3EE",
    chipBackground: "rgba(224, 154, 129, 0.16)",
    chipBorder: "rgba(224, 154, 129, 0.34)",
    chipInk: "#F5C6B7",
  },
  slate: {
    solidBackground: "#AE93EA",
    solidBorder: "rgba(255,255,255,0.10)",
    solidInk: "#FFF7FF",
    chipBackground: "rgba(194, 171, 250, 0.16)",
    chipBorder: "rgba(194, 171, 250, 0.36)",
    chipInk: "#E3D5FF",
  },
};

function getStatusTone(status: string): PremiumTone {
  const normalized = status.toLowerCase();
  if (normalized.includes("cancel") || normalized.includes("locked")) {
    return "coral";
  }
  if (normalized.includes("played") || normalized.includes("complete")) {
    return "mint";
  }
  return "slate";
}

function AccentPattern({ color = "rgba(255,255,255,0.12)" }: { color?: string }) {
  return (
    <View pointerEvents="none" style={styles.patternWrap}>
      <View style={[styles.patternLoopOne, { borderColor: color }]} />
      <View style={[styles.patternLoopTwo, { borderColor: color }]} />
    </View>
  );
}

export function ScreenShell({
  children,
  contentContainerStyle,
}: PropsWithChildren<{ contentContainerStyle?: StyleProp<ViewStyle> }>) {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + 12 },
          contentContainerStyle,
        ]}
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
    </View>
  );
}

export function ScreenHeader({
  eyebrow,
  title,
  subtitle,
  trailing,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  trailing?: ReactNode;
}) {
  return (
    <View style={styles.header}>
      <View style={styles.headerCopy}>
        <Text style={styles.eyebrow}>{eyebrow}</Text>
        <Text style={styles.headerTitle}>{title}</Text>
        <Text style={styles.headerSubtitle}>{subtitle}</Text>
      </View>
      {trailing ? <View style={styles.headerTrailing}>{trailing}</View> : null}
    </View>
  );
}

export function HeroPanel({
  eyebrow,
  title,
  subtitle,
  actionLabel,
  metrics,
  chips,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  actionLabel: string;
  metrics: ReadonlyArray<{ label: string; value: string }>;
  chips?: ReadonlyArray<string>;
}) {
  return (
    <View style={styles.heroPanel}>
      <AccentPattern />
      <View style={styles.heroTopRow}>
        <Tag label={eyebrow} tone="gold" icon="sparkles-outline" />
        <Tag label="Live now" tone="slate" icon="radio-outline" />
      </View>
      <Text style={styles.heroTitle}>{title}</Text>
      <Text style={styles.heroSubtitle}>{subtitle}</Text>
      <View style={styles.heroMetrics}>
        {metrics.map((metric) => (
          <View key={metric.label} style={styles.heroMetric}>
            <Text style={styles.heroMetricValue}>{metric.value}</Text>
            <Text style={styles.heroMetricLabel}>{metric.label}</Text>
          </View>
        ))}
      </View>
      {chips?.length ? (
        <View style={styles.tagWrap}>
          {chips.map((chip) => (
            <Tag key={chip} label={chip} tone="mint" />
          ))}
        </View>
      ) : null}
      <RoundedButton label={actionLabel} icon="arrow-forward" />
    </View>
  );
}

export function RoundedButton({
  label,
  icon,
  tone = "slate",
}: {
  label: string;
  icon?: PremiumIconName;
  tone?: PremiumTone;
}) {
  const toneStyle = toneStyles[tone];

  return (
    <Pressable
      accessibilityRole="button"
      style={[
        styles.roundedButton,
        {
          borderColor: toneStyle.solidBorder,
        },
      ]}
    >
      <View style={styles.roundedButtonRing} />
      <Text style={styles.roundedButtonText}>{label}</Text>
      {icon ? <Ionicons name={icon} size={17} color={premiumTheme.colors.text} /> : null}
    </Pressable>
  );
}

export function SectionTitle({
  title,
  subtitle,
  actionLabel,
}: {
  title: string;
  subtitle: string;
  actionLabel?: string;
}) {
  return (
    <View style={styles.sectionTitleRow}>
      <View style={styles.sectionTitleCopy}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <Text style={styles.sectionSubtitle}>{subtitle}</Text>
      </View>
      {actionLabel ? <Text style={styles.sectionAction}>{actionLabel}</Text> : null}
    </View>
  );
}

export function SurfaceCard({
  children,
  style,
}: PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) {
  return <View style={[styles.surfaceCard, style]}>{children}</View>;
}

export function MetricTile({
  icon,
  label,
  value,
  footnote,
  tone = "gold",
  style,
}: {
  icon: PremiumIconName;
  label: string;
  value: string;
  footnote: string;
  tone?: PremiumTone;
  style?: StyleProp<ViewStyle>;
}) {
  const toneStyle = toneStyles[tone];

  return (
    <View style={[styles.metricTile, style]}>
      <View style={[styles.metricIcon, { backgroundColor: toneStyle.chipBackground, borderColor: toneStyle.chipBorder }]}>
        <Ionicons name={icon} size={16} color={toneStyle.chipInk} />
      </View>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricFootnote}>{footnote}</Text>
    </View>
  );
}

export function Tag({
  label,
  tone = "gold",
  icon,
}: {
  label: string;
  tone?: PremiumTone;
  icon?: PremiumIconName;
}) {
  const toneStyle = toneStyles[tone];

  return (
    <View
      style={[
        styles.tag,
        {
          backgroundColor: toneStyle.chipBackground,
          borderColor: toneStyle.chipBorder,
        },
      ]}
    >
      {icon ? <Ionicons name={icon} size={14} color={toneStyle.chipInk} /> : null}
      <Text style={[styles.tagText, { color: toneStyle.chipInk }]}>{label}</Text>
    </View>
  );
}

export function SearchField({
  label,
  value,
  icon = "search",
}: {
  label: string;
  value: string;
  icon?: PremiumIconName;
}) {
  return (
    <View style={styles.searchField}>
      <View style={styles.searchIcon}>
        <Ionicons name={icon} size={18} color={premiumTheme.colors.text} />
      </View>
      <View style={styles.searchCopy}>
        <Text style={styles.searchLabel}>{label}</Text>
        <Text style={styles.searchValue}>{value}</Text>
      </View>
      <View style={styles.searchAction}>
        <Ionicons name="options-outline" size={18} color={premiumTheme.colors.muted} />
      </View>
    </View>
  );
}

export function ActionRow({
  icon,
  title,
  subtitle,
  tone = "slate",
  value,
}: {
  icon: PremiumIconName;
  title: string;
  subtitle: string;
  tone?: PremiumTone;
  value?: string;
}) {
  const toneStyle = toneStyles[tone];

  return (
    <View style={styles.rowCard}>
      <View style={[styles.rowIcon, { backgroundColor: toneStyle.chipBackground, borderColor: toneStyle.chipBorder }]}>
        <Ionicons name={icon} size={18} color={toneStyle.chipInk} />
      </View>
      <View style={styles.rowCopy}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowSubtitle}>{subtitle}</Text>
      </View>
      {value ? <Text style={[styles.rowValue, { color: toneStyle.chipInk }]}>{value}</Text> : null}
      <Ionicons name="chevron-forward" size={18} color={premiumTheme.colors.muted} />
    </View>
  );
}

export function StatPill({
  label,
  value,
  tone = "slate",
}: {
  label: string;
  value: string;
  tone?: PremiumTone;
}) {
  const toneStyle = toneStyles[tone];

  return (
    <View style={[styles.statPill, { backgroundColor: toneStyle.chipBackground, borderColor: toneStyle.chipBorder }]}>
      <Text style={[styles.statPillLabel, { color: toneStyle.chipInk }]}>{label}</Text>
      <Text style={styles.statPillValue}>{value}</Text>
    </View>
  );
}

export function FeatureTile({
  icon,
  title,
  subtitle,
  value,
  tone = "gold",
  style,
}: {
  icon: PremiumIconName;
  title: string;
  subtitle: string;
  value: string;
  tone?: PremiumTone;
  style?: StyleProp<ViewStyle>;
}) {
  const toneStyle = toneStyles[tone];

  return (
    <View
      style={[
        styles.featureTile,
        {
          backgroundColor: toneStyle.solidBackground,
          borderColor: toneStyle.solidBorder,
        },
        style,
      ]}
    >
      <AccentPattern color="rgba(255,255,255,0.16)" />
      <View style={styles.featureTileIcon}>
        <Ionicons name={icon} size={18} color={toneStyle.solidInk} />
      </View>
      <Text style={[styles.featureTileTitle, { color: toneStyle.solidInk }]}>{title}</Text>
      <Text style={[styles.featureTileSubtitle, { color: toneStyle.solidInk }]}>{subtitle}</Text>
      <Text style={[styles.featureTileValue, { color: toneStyle.solidInk }]}>{value}</Text>
    </View>
  );
}

export function InsightBanner({
  icon,
  title,
  subtitle,
  value,
  tone = "gold",
}: {
  icon: PremiumIconName;
  title: string;
  subtitle: string;
  value: string;
  tone?: PremiumTone;
}) {
  const toneStyle = toneStyles[tone];

  return (
    <View style={styles.insightBanner}>
      <View style={[styles.insightBannerIcon, { backgroundColor: toneStyle.chipBackground, borderColor: toneStyle.chipBorder }]}>
        <Ionicons name={icon} size={18} color={toneStyle.chipInk} />
      </View>
      <View style={styles.insightBannerCopy}>
        <Text style={styles.insightBannerTitle}>{title}</Text>
        <Text style={styles.insightBannerSubtitle}>{subtitle}</Text>
      </View>
      <Text style={[styles.insightBannerValue, { color: toneStyle.chipInk }]}>{value}</Text>
    </View>
  );
}

export function ProgressBar({ progress, tone = "gold" }: { progress: number; tone?: PremiumTone }) {
  const toneStyle = toneStyles[tone];
  const clamped = Math.max(0, Math.min(progress, 1));

  return (
    <View style={styles.progressTrack}>
      <View style={[styles.progressFill, { width: `${clamped * 100}%`, backgroundColor: toneStyle.chipInk }]} />
    </View>
  );
}

export function VenueCard({
  title,
  subtitle,
  requestFloorCents,
  distance,
  energy,
  tags,
  tone = "slate",
}: {
  title: string;
  subtitle: string;
  requestFloorCents: number;
  distance: string;
  energy: number;
  tags: ReadonlyArray<string>;
  tone?: PremiumTone;
}) {
  const toneStyle = toneStyles[tone];

  return (
    <View
      style={[
        styles.venueCard,
        {
          backgroundColor: toneStyle.solidBackground,
          borderColor: toneStyle.solidBorder,
        },
      ]}
    >
      <AccentPattern color="rgba(255,255,255,0.16)" />
      <View style={styles.cardTopRow}>
        <Tag label="Live" tone={tone} icon="radio-outline" />
        <Text style={[styles.supportingText, { color: toneStyle.solidInk }]}>{distance}</Text>
      </View>
      <Text style={[styles.cardTitle, { color: toneStyle.solidInk }]}>{title}</Text>
      <Text style={[styles.cardSubtitle, { color: toneStyle.solidInk }]}>{subtitle}</Text>
      <View style={styles.cardStatRow}>
        <View>
          <Text style={[styles.statCaption, { color: toneStyle.solidInk }]}>Min request</Text>
          <Text style={[styles.statValue, { color: toneStyle.solidInk }]}>{formatUsd(requestFloorCents)}</Text>
        </View>
        <View>
          <Text style={[styles.statCaption, { color: toneStyle.solidInk }]}>Energy</Text>
          <Text style={[styles.statValue, { color: toneStyle.solidInk }]}>{Math.round(energy * 100)}%</Text>
        </View>
      </View>
      <ProgressBar progress={energy} tone={tone} />
      <View style={styles.tagWrap}>
        {tags.map((tag) => (
          <Tag key={tag} label={tag} tone={tone} />
        ))}
      </View>
    </View>
  );
}

export function QueueCard({
  rank,
  title,
  artist,
  totalCents,
  contributors,
  status,
  momentum,
}: {
  rank: number;
  title: string;
  artist: string;
  totalCents: number;
  contributors: number;
  status: string;
  momentum: string;
}) {
  const tone = getStatusTone(status);
  const toneStyle = toneStyles[tone];

  return (
    <SurfaceCard style={styles.queueCard}>
      <View style={styles.queueTopRow}>
        <View style={styles.rankBadge}>
          <Text style={styles.rankLabel}>#{rank}</Text>
        </View>
        <Tag label={status} tone={tone} />
      </View>
      <Text style={styles.cardTitle}>{title}</Text>
      <Text style={styles.cardSubtitle}>{artist}</Text>
      <View style={styles.cardStatRow}>
        <View>
          <Text style={styles.statCaption}>Support</Text>
          <Text style={styles.statValue}>{formatUsd(totalCents)}</Text>
        </View>
        <View>
          <Text style={styles.statCaption}>Fans in</Text>
          <Text style={styles.statValue}>{contributors}</Text>
        </View>
      </View>
      <View style={styles.queueMomentum}>
        <Ionicons name="trending-up" size={16} color={toneStyle.chipInk} />
        <Text style={[styles.queueMomentumText, { color: toneStyle.chipInk }]}>{momentum}</Text>
      </View>
    </SurfaceCard>
  );
}

export function TimelineRow({
  icon,
  title,
  subtitle,
  value,
  tone = "slate",
}: {
  icon: PremiumIconName;
  title: string;
  subtitle: string;
  value: string;
  tone?: PremiumTone;
}) {
  const toneStyle = toneStyles[tone];

  return (
    <View style={styles.timelineRow}>
      <View style={[styles.timelineIcon, { backgroundColor: toneStyle.chipBackground, borderColor: toneStyle.chipBorder }]}>
        <Ionicons name={icon} size={16} color={toneStyle.chipInk} />
      </View>
      <View style={styles.rowCopy}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowSubtitle}>{subtitle}</Text>
      </View>
      <Text style={styles.timelineValue}>{value}</Text>
    </View>
  );
}

export function SettingsRow({
  icon,
  title,
  subtitle,
  value,
  tone = "slate",
}: {
  icon: PremiumIconName;
  title: string;
  subtitle: string;
  value?: string;
  tone?: PremiumTone;
}) {
  return <ActionRow icon={icon} title={title} subtitle={subtitle} value={value} tone={tone} />;
}

export function ToggleRow({
  icon,
  title,
  subtitle,
  value,
  onValueChange,
  tone = "mint",
}: {
  icon: PremiumIconName;
  title: string;
  subtitle: string;
  value: boolean;
  onValueChange: (nextValue: boolean) => void;
  tone?: PremiumTone;
}) {
  const toneStyle = toneStyles[tone];

  return (
    <View style={styles.rowCard}>
      <View style={[styles.rowIcon, { backgroundColor: toneStyle.chipBackground, borderColor: toneStyle.chipBorder }]}>
        <Ionicons name={icon} size={18} color={toneStyle.chipInk} />
      </View>
      <View style={styles.rowCopy}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowSubtitle}>{subtitle}</Text>
      </View>
      <Pressable
        accessibilityRole="switch"
        accessibilityState={{ checked: value }}
        onPress={() => onValueChange(!value)}
        style={[
          styles.toggleTrack,
          {
            backgroundColor: value ? toneStyle.chipInk : premiumTheme.colors.surfaceMuted,
          },
        ]}
      >
        <View style={[styles.toggleThumb, value ? styles.toggleThumbOn : styles.toggleThumbOff]} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  cardStatRow: {
    flexDirection: "row",
    gap: 16,
    justifyContent: "space-between",
  },
  cardSubtitle: {
    color: premiumTheme.colors.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  cardTitle: {
    color: premiumTheme.colors.text,
    fontSize: 22,
    fontWeight: "700",
    lineHeight: 28,
  },
  cardTopRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  eyebrow: {
    color: premiumTheme.colors.muted,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.4,
    textTransform: "uppercase",
  },
  featureTile: {
    borderRadius: premiumTheme.radii.lg,
    borderWidth: 1,
    flex: 1,
    gap: 10,
    minHeight: 164,
    overflow: "hidden",
    padding: 18,
  },
  featureTileIcon: {
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.14)",
    borderRadius: 16,
    height: 38,
    justifyContent: "center",
    width: 38,
  },
  featureTileSubtitle: {
    fontSize: 13,
    lineHeight: 18,
    opacity: 0.9,
  },
  featureTileTitle: {
    fontSize: 20,
    fontWeight: "700",
    lineHeight: 24,
  },
  featureTileValue: {
    fontSize: 14,
    fontWeight: "700",
    marginTop: "auto",
  },
  header: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 16,
    justifyContent: "space-between",
  },
  headerCopy: {
    flex: 1,
    gap: 6,
  },
  headerSubtitle: {
    color: premiumTheme.colors.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  headerTitle: {
    color: premiumTheme.colors.text,
    fontSize: 34,
    fontWeight: "800",
    lineHeight: 40,
  },
  headerTrailing: {
    paddingTop: 4,
  },
  heroMetric: {
    backgroundColor: "rgba(0,0,0,0.18)",
    borderRadius: 20,
    flex: 1,
    gap: 4,
    padding: 12,
  },
  heroMetricLabel: {
    color: "rgba(255,255,255,0.74)",
    fontSize: 11,
  },
  heroMetricValue: {
    color: premiumTheme.colors.text,
    fontSize: 18,
    fontWeight: "700",
  },
  heroMetrics: {
    flexDirection: "row",
    gap: 10,
  },
  heroPanel: {
    backgroundColor: "#AD8FE9",
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: premiumTheme.radii.xl,
    borderWidth: 1,
    gap: 16,
    overflow: "hidden",
    padding: 22,
  },
  heroSubtitle: {
    color: "rgba(255,255,255,0.82)",
    fontSize: 14,
    lineHeight: 20,
  },
  heroTitle: {
    color: premiumTheme.colors.text,
    fontSize: 30,
    fontWeight: "800",
    lineHeight: 34,
  },
  heroTopRow: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  insightBanner: {
    alignItems: "center",
    backgroundColor: premiumTheme.colors.surfaceElevated,
    borderColor: premiumTheme.colors.border,
    borderRadius: premiumTheme.radii.md,
    borderWidth: 1,
    flexDirection: "row",
    gap: 14,
    padding: 16,
  },
  insightBannerCopy: {
    flex: 1,
    gap: 4,
  },
  insightBannerIcon: {
    alignItems: "center",
    borderRadius: 16,
    borderWidth: 1,
    height: 42,
    justifyContent: "center",
    width: 42,
  },
  insightBannerSubtitle: {
    color: premiumTheme.colors.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  insightBannerTitle: {
    color: premiumTheme.colors.text,
    fontSize: 15,
    fontWeight: "700",
  },
  insightBannerValue: {
    fontSize: 12,
    fontWeight: "700",
  },
  metricFootnote: {
    color: premiumTheme.colors.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  metricIcon: {
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1,
    height: 34,
    justifyContent: "center",
    width: 34,
  },
  metricLabel: {
    color: premiumTheme.colors.muted,
    fontSize: 11,
    textTransform: "uppercase",
  },
  metricTile: {
    backgroundColor: premiumTheme.colors.surfaceElevated,
    borderColor: premiumTheme.colors.border,
    borderRadius: premiumTheme.radii.md,
    borderWidth: 1,
    flex: 1,
    gap: 10,
    minHeight: 146,
    padding: 18,
  },
  metricValue: {
    color: premiumTheme.colors.text,
    fontSize: 28,
    fontWeight: "800",
    lineHeight: 32,
  },
  patternLoopOne: {
    borderRadius: 180,
    borderWidth: 1,
    height: 180,
    left: -18,
    position: "absolute",
    top: 12,
    width: 180,
  },
  patternLoopTwo: {
    borderRadius: 220,
    borderWidth: 1,
    height: 220,
    position: "absolute",
    right: -42,
    top: -10,
    width: 220,
  },
  patternWrap: {
    ...StyleSheet.absoluteFillObject,
  },
  progressFill: {
    borderRadius: 999,
    height: 8,
  },
  progressTrack: {
    backgroundColor: "rgba(0,0,0,0.16)",
    borderRadius: 999,
    height: 8,
    overflow: "hidden",
  },
  queueCard: {
    gap: 14,
  },
  queueMomentum: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
  queueMomentumText: {
    flex: 1,
    fontSize: 13,
    fontWeight: "600",
  },
  queueTopRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  rankBadge: {
    backgroundColor: premiumTheme.colors.surfaceMuted,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  rankLabel: {
    color: premiumTheme.colors.text,
    fontSize: 13,
    fontWeight: "700",
  },
  roundedButton: {
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,255,255,0.14)",
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    overflow: "hidden",
    paddingHorizontal: 18,
    paddingVertical: 14,
    position: "relative",
  },
  roundedButtonRing: {
    backgroundColor: "transparent",
    borderColor: premiumTheme.colors.ringPink,
    borderRadius: 999,
    borderWidth: 2,
    bottom: -20,
    left: -40,
    position: "absolute",
    right: -40,
    top: -20,
  },
  roundedButtonText: {
    color: premiumTheme.colors.text,
    fontSize: 15,
    fontWeight: "700",
  },
  rowCard: {
    alignItems: "center",
    flexDirection: "row",
    gap: 14,
    paddingVertical: 6,
  },
  rowCopy: {
    flex: 1,
    gap: 4,
  },
  rowIcon: {
    alignItems: "center",
    borderRadius: 18,
    borderWidth: 1,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  rowSubtitle: {
    color: premiumTheme.colors.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  rowTitle: {
    color: premiumTheme.colors.text,
    fontSize: 15,
    fontWeight: "600",
  },
  rowValue: {
    fontSize: 13,
    fontWeight: "700",
  },
  screen: {
    backgroundColor: premiumTheme.colors.background,
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    gap: 18,
    paddingBottom: 132,
    paddingHorizontal: 30,
  },
  searchAction: {
    alignItems: "center",
    backgroundColor: premiumTheme.colors.surfaceElevated,
    borderRadius: 16,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  searchCopy: {
    flex: 1,
    gap: 2,
  },
  searchField: {
    alignItems: "center",
    backgroundColor: premiumTheme.colors.surfaceElevated,
    borderColor: premiumTheme.colors.border,
    borderRadius: premiumTheme.radii.md,
    borderWidth: 1,
    flexDirection: "row",
    gap: 14,
    padding: 12,
  },
  searchIcon: {
    alignItems: "center",
    backgroundColor: premiumTheme.colors.surfaceMuted,
    borderRadius: 16,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  searchLabel: {
    color: premiumTheme.colors.muted,
    fontSize: 11,
  },
  searchValue: {
    color: premiumTheme.colors.text,
    fontSize: 15,
    fontWeight: "600",
  },
  sectionAction: {
    color: premiumTheme.colors.muted,
    fontSize: 12,
    fontWeight: "700",
  },
  sectionSubtitle: {
    color: premiumTheme.colors.muted,
    fontSize: 14,
    lineHeight: 19,
  },
  sectionTitle: {
    color: premiumTheme.colors.text,
    fontSize: 25,
    fontWeight: "800",
    lineHeight: 30,
  },
  sectionTitleCopy: {
    flex: 1,
    gap: 4,
  },
  sectionTitleRow: {
    alignItems: "flex-end",
    flexDirection: "row",
    gap: 16,
    justifyContent: "space-between",
  },
  statCaption: {
    color: premiumTheme.colors.muted,
    fontSize: 12,
  },
  statPill: {
    borderRadius: 999,
    borderWidth: 1,
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  statPillLabel: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  statPillValue: {
    color: premiumTheme.colors.text,
    fontSize: 14,
    fontWeight: "700",
  },
  statValue: {
    color: premiumTheme.colors.text,
    fontSize: 20,
    fontWeight: "700",
  },
  supportingText: {
    fontSize: 13,
    fontWeight: "600",
  },
  surfaceCard: {
    backgroundColor: premiumTheme.colors.surfaceElevated,
    borderColor: premiumTheme.colors.border,
    borderRadius: premiumTheme.radii.lg,
    borderWidth: 1,
    gap: 14,
    padding: 18,
  },
  tag: {
    alignItems: "center",
    alignSelf: "flex-start",
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  tagText: {
    fontSize: 12,
    fontWeight: "700",
  },
  tagWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  timelineIcon: {
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1,
    height: 38,
    justifyContent: "center",
    width: 38,
  },
  timelineRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 14,
    paddingVertical: 2,
  },
  timelineValue: {
    color: premiumTheme.colors.text,
    fontSize: 13,
    fontWeight: "700",
  },
  toggleThumb: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    height: 24,
    position: "absolute",
    top: 4,
    width: 24,
  },
  toggleThumbOff: {
    left: 4,
  },
  toggleThumbOn: {
    right: 4,
  },
  toggleTrack: {
    borderRadius: 999,
    height: 32,
    position: "relative",
    width: 58,
  },
  venueCard: {
    borderRadius: premiumTheme.radii.lg,
    borderWidth: 1,
    gap: 12,
    overflow: "hidden",
    padding: 18,
  },
});
