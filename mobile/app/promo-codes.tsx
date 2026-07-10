import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { apiRoutes, type ComplimentaryCredit } from "@rqst/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router, type Href } from "expo-router";

import { ScreenHeader, ScreenShell, SurfaceCard } from "../src/components/premium-ui";
import { NEARBY_SESSIONS_QUERY_KEY } from "../src/lib/use-active-session";
import { rqstApi } from "../src/lib/rqst-api";
import { useAppStore } from "../src/store/app";
import { useAuthStore } from "../src/store/auth";
import { usePremiumTheme, useThemedStyles } from "../src/store/theme";
import { useToastStore } from "../src/store/toast";
import { formatShowLabel } from "../utils/shows";

export default function PromoCodesScreen() {
  const [complimentaryCode, setComplimentaryCode] = useState("");
  const [redeemError, setRedeemError] = useState("");
  const [lastRedeemedCredit, setLastRedeemedCredit] = useState<ComplimentaryCredit | null>(null);
  const isSignedIn = useAuthStore((state) => Boolean(state.accessToken && state.user));
  const setSelectedSession = useAppStore((state) => state.setSelectedSession);
  const showToast = useToastStore((state) => state.showToast);
  const queryClient = useQueryClient();
  const theme = usePremiumTheme();
  const styles = useThemedStyles((activeTheme) =>
    StyleSheet.create({
      backButton: {
        alignSelf: "flex-start",
        marginBottom: 8,
        paddingVertical: 4,
      },
      backButtonText: {
        color: activeTheme.colors.inkMuted,
        fontFamily: activeTheme.fonts.body,
        fontSize: 15,
        fontWeight: "600",
      },
      codeInput: {
        backgroundColor: activeTheme.colors.backgroundSecondary,
        borderColor: activeTheme.colors.border,
        borderRadius: 14,
        borderWidth: 1,
        color: activeTheme.colors.ink,
        fontFamily: activeTheme.fonts.body,
        fontSize: 16,
        fontWeight: "700",
        letterSpacing: 2,
        paddingHorizontal: 14,
        paddingVertical: 12,
        textTransform: "uppercase",
      },
      complimentaryCreditMeta: {
        color: activeTheme.colors.inkMuted,
        fontFamily: activeTheme.fonts.body,
        fontSize: 13,
        marginTop: 2,
      },
      complimentaryCreditRow: {
        borderColor: activeTheme.colors.border,
        borderTopWidth: 1,
        gap: 8,
        paddingTop: 14,
      },
      complimentaryCreditTitle: {
        color: activeTheme.colors.ink,
        fontFamily: activeTheme.fonts.body,
        fontSize: 15,
        fontWeight: "700",
      },
      complimentaryOpenButton: {
        alignItems: "center",
        alignSelf: "flex-start",
        backgroundColor: "#7c3aed",
        borderRadius: 12,
        flexDirection: "row",
        gap: 6,
        marginTop: 4,
        paddingHorizontal: 12,
        paddingVertical: 8,
      },
      complimentaryOpenButtonText: {
        color: "#FFFFFF",
        fontFamily: activeTheme.fonts.body,
        fontSize: 13,
        fontWeight: "700",
      },
      complimentaryRedeemButton: {
        alignItems: "center",
        backgroundColor: "#7c3aed",
        borderRadius: 14,
        justifyContent: "center",
        paddingHorizontal: 16,
        paddingVertical: 12,
      },
      complimentaryRedeemButtonDisabled: {
        opacity: 0.55,
      },
      complimentaryRedeemRow: {
        flexDirection: "row",
        gap: 10,
        marginTop: 4,
      },
      complimentaryRedeemText: {
        color: "#FFFFFF",
        fontFamily: activeTheme.fonts.body,
        fontSize: 14,
        fontWeight: "700",
      },
      complimentarySection: {
        gap: 12,
      },
      emptyText: {
        color: activeTheme.colors.inkMuted,
        fontFamily: activeTheme.fonts.body,
        fontSize: 14,
        lineHeight: 20,
      },
      errorText: {
        color: activeTheme.colors.coral,
        fontFamily: activeTheme.fonts.body,
        fontSize: 13,
      },
      successCard: {
        backgroundColor: "rgba(124, 58, 237, 0.1)",
        borderColor: "rgba(124, 58, 237, 0.24)",
        borderRadius: 16,
        borderWidth: 1,
        gap: 8,
        padding: 14,
      },
      successTitle: {
        color: "#6d28d9",
        fontFamily: activeTheme.fonts.body,
        fontSize: 15,
        fontWeight: "800",
      },
    }),
  );

  const complimentaryCreditsQuery = useQuery({
    queryKey: ["meComplimentaryCredits"],
    queryFn: () =>
      rqstApi<ComplimentaryCredit[]>(apiRoutes.meComplimentaryCredits.replace("/api/v1", "")),
    enabled: isSignedIn,
    retry: false,
  });

  const redeemMutation = useMutation({
    mutationFn: (code: string) =>
      rqstApi<ComplimentaryCredit>(apiRoutes.redeemComplimentaryCode.replace("/api/v1", ""), {
        method: "POST",
        body: JSON.stringify({ code }),
      }),
    onSuccess: (credit) => {
      queryClient.setQueryData<ComplimentaryCredit[]>(["meComplimentaryCredits"], (current = []) => [
        credit,
        ...current.filter((item) => item.id !== credit.id),
      ]);
      queryClient.invalidateQueries({ queryKey: ["meComplimentaryCredits"] });
      setComplimentaryCode("");
      setRedeemError("");
      setLastRedeemedCredit(credit);
      showToast({
        title: "Promo code unlocked",
        message: credit.djArtistName
          ? `Free song ready for ${credit.djArtistName}.`
          : "Free song ready for this show.",
      });
    },
    retry: false,
  });

  const unusedCredits = useMemo(
    () => (complimentaryCreditsQuery.data ?? []).filter((credit) => !credit.usedAt),
    [complimentaryCreditsQuery.data],
  );

  async function handleRedeemCode() {
    const code = complimentaryCode.trim();
    if (!code) {
      setRedeemError("Enter a promo code.");
      return;
    }
    if (!isSignedIn) {
      setRedeemError("Sign in to redeem a promo code.");
      return;
    }

    setRedeemError("");
    try {
      await redeemMutation.mutateAsync(code);
    } catch (error) {
      setRedeemError(error instanceof Error ? error.message : "Could not redeem this code.");
    }
  }

  function openShow(credit: ComplimentaryCredit) {
    if (credit.liveSessionId && credit.djSlug) {
      void queryClient.invalidateQueries({ queryKey: NEARBY_SESSIONS_QUERY_KEY });
      setSelectedSession({
        sessionId: credit.liveSessionId,
        djName: credit.djArtistName ?? "DJ",
        venueName: credit.venueName ?? "Live venue",
        slug: credit.djSlug,
      });
      router.push("/(tabs)/requests" as Href);
      return;
    }

    if (credit.djSlug) {
      router.push(`/dj?slug=${encodeURIComponent(credit.djSlug)}` as Href);
      return;
    }

    router.push("/(tabs)/find" as Href);
  }

  function creditShowLabel(credit: ComplimentaryCredit) {
    return (
      formatShowLabel(credit.eventName, credit.eventStartsAt) ??
      credit.venueName ??
      "Show"
    );
  }

  return (
    <ScreenShell>
      <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.backButton}>
        <Text style={styles.backButtonText}>Back</Text>
      </Pressable>

      <ScreenHeader
        eyebrow="Account"
        title="Promo codes"
        subtitle="Enter a DJ promo code to unlock one free song for that show."
      />

      <SurfaceCard>
        <View style={styles.complimentarySection}>
          <View style={styles.complimentaryRedeemRow}>
            <TextInput
              autoCapitalize="characters"
              autoCorrect={false}
              onChangeText={setComplimentaryCode}
              placeholder="ENTER CODE"
              placeholderTextColor={theme.colors.inkMuted}
              style={[styles.codeInput, { flex: 1 }]}
              value={complimentaryCode}
            />
            <Pressable
              accessibilityRole="button"
              disabled={redeemMutation.isPending}
              onPress={() => void handleRedeemCode()}
              style={[
                styles.complimentaryRedeemButton,
                redeemMutation.isPending ? styles.complimentaryRedeemButtonDisabled : null,
              ]}
            >
              <Text style={styles.complimentaryRedeemText}>
                {redeemMutation.isPending ? "..." : "Redeem"}
              </Text>
            </Pressable>
          </View>
          {redeemError ? <Text style={styles.errorText}>{redeemError}</Text> : null}

          {lastRedeemedCredit ? (
            <View style={styles.successCard}>
              <Text style={styles.successTitle}>Unlocked</Text>
              <Text style={styles.complimentaryCreditTitle}>
                {lastRedeemedCredit.djArtistName ?? "DJ"}
              </Text>
              <Text style={styles.complimentaryCreditMeta}>
                {creditShowLabel(lastRedeemedCredit)}
                {lastRedeemedCredit.venueName ? ` · ${lastRedeemedCredit.venueName}` : ""}
              </Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => openShow(lastRedeemedCredit)}
                style={styles.complimentaryOpenButton}
              >
                <Ionicons color="#FFFFFF" name="open-outline" size={14} />
                <Text style={styles.complimentaryOpenButtonText}>
                  {lastRedeemedCredit.liveSessionId ? "Open show" : "Open DJ"}
                </Text>
              </Pressable>
            </View>
          ) : null}

          {unusedCredits
            .filter((credit) => credit.id !== lastRedeemedCredit?.id)
            .map((credit) => (
              <View key={credit.id} style={styles.complimentaryCreditRow}>
                <Text style={styles.complimentaryCreditTitle}>
                  {credit.djArtistName ?? "DJ"} · ready to use
                </Text>
                <Text style={styles.complimentaryCreditMeta}>
                  {creditShowLabel(credit)}
                  {credit.venueName ? ` · ${credit.venueName}` : ""}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => openShow(credit)}
                  style={styles.complimentaryOpenButton}
                >
                  <Ionicons color="#FFFFFF" name="open-outline" size={14} />
                  <Text style={styles.complimentaryOpenButtonText}>
                    {credit.liveSessionId ? "Open show" : "Open DJ"}
                  </Text>
                </Pressable>
              </View>
            ))}

          {!lastRedeemedCredit && unusedCredits.length === 0 && !complimentaryCreditsQuery.isLoading ? (
            <Text style={styles.emptyText}>No unused promo codes yet.</Text>
          ) : null}
        </View>
      </SurfaceCard>
    </ScreenShell>
  );
}
