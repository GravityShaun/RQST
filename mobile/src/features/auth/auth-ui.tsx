import type { PropsWithChildren } from "react";
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Link } from "expo-router";
import { usePremiumTheme, useThemedStyles } from "../../store/theme";

import { GrainyGradientBackground } from "../../components/grainy-gradient/GrainyGradient";
import { SurfaceCard } from "../../components/premium-ui";

type AuthFormFieldProps = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  error?: string;
  autoCapitalize?: "none" | "words" | "sentences";
  autoComplete?: "email" | "password" | "name" | "password-new" | "off";
  keyboardType?: "default" | "email-address";
  secureTextEntry?: boolean;
  textContentType?: "emailAddress" | "password" | "name" | "newPassword" | "none";
};


function useAuthStyles() {
  return useThemedStyles((activeTheme) =>
    StyleSheet.create({
brandMark: {
    alignItems: "center",
    backgroundColor: activeTheme.colors.coral,
    borderColor: "rgba(255,255,255,0.24)",
    borderRadius: 16,
    borderWidth: 1,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  brandRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
  },
  brandText: {
    color: activeTheme.colors.ink,
    fontFamily: activeTheme.fonts.display,
    fontSize: 28,
    fontWeight: "800",
  },
  card: {
    gap: 18,
    padding: 22,
  },
  content: {
    flex: 1,
    gap: 24,
    paddingHorizontal: 20,
  },
  eyebrow: {
    color: activeTheme.colors.inkMuted,
    fontFamily: activeTheme.fonts.body,
    fontSize: 13,
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  fieldError: {
    color: activeTheme.colors.coral,
    fontFamily: activeTheme.fonts.body,
    fontSize: 13,
    marginTop: 6,
  },
  fieldInput: {
    backgroundColor: activeTheme.colors.surfaceElevated,
    borderColor: activeTheme.colors.border,
    borderRadius: activeTheme.radii.sm,
    borderWidth: 1,
    color: activeTheme.colors.ink,
    fontFamily: activeTheme.fonts.body,
    fontSize: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  fieldInputError: {
    borderColor: "rgba(224, 90, 71, 0.45)",
  },
  fieldLabel: {
    color: activeTheme.colors.ink,
    fontFamily: activeTheme.fonts.body,
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
  },
  fieldWrap: {
    gap: 0,
  },
  footerLink: {
    color: activeTheme.colors.coral,
    fontFamily: activeTheme.fonts.body,
    fontSize: 15,
    fontWeight: "700",
  },
  footerPrompt: {
    color: activeTheme.colors.inkMuted,
    fontFamily: activeTheme.fonts.body,
    fontSize: 15,
  },
  footerRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
    justifyContent: "center",
    marginTop: 4,
  },
  heroCopy: {
    gap: 8,
  },
  screen: {
    backgroundColor: activeTheme.colors.background,
    flex: 1,
  },
  submitButton: {
    alignItems: "center",
    backgroundColor: activeTheme.colors.coral,
    borderColor: "rgba(255,255,255,0.18)",
    borderRadius: activeTheme.radii.xl,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    marginTop: 4,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  submitButtonDisabled: {
    opacity: 0.55,
  },
  submitButtonText: {
    color: activeTheme.colors.text,
    fontFamily: activeTheme.fonts.display,
    fontSize: 17,
    fontWeight: "700",
  },
  subtitle: {
    color: activeTheme.colors.inkMuted,
    fontFamily: activeTheme.fonts.body,
    fontSize: 16,
    lineHeight: 22,
    maxWidth: 320,
  },
  title: {
    color: activeTheme.colors.ink,
    fontFamily: activeTheme.fonts.display,
    fontSize: 34,
    fontWeight: "800",
    lineHeight: 38,
  },
    }),
  );
}
export function AuthFormField({
  label,
  value,
  onChangeText,
  error,
  autoCapitalize = "none",
  autoComplete = "off",
  keyboardType = "default",
  secureTextEntry = false,
  textContentType = "none",
}: AuthFormFieldProps) {
  const theme = usePremiumTheme();
  const styles = useAuthStyles();

  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        autoCapitalize={autoCapitalize}
        autoComplete={autoComplete}
        autoCorrect={false}
        keyboardType={keyboardType}
        onChangeText={onChangeText}
        placeholder={label}
        placeholderTextColor={theme.colors.inkMuted}
        secureTextEntry={secureTextEntry}
        style={[styles.fieldInput, error ? styles.fieldInputError : null]}
        textContentType={textContentType}
        value={value}
      />
      {error ? <Text style={styles.fieldError}>{error}</Text> : null}
    </View>
  );
}

export function AuthScreenShell({
  children,
  eyebrow,
  title,
  subtitle,
}: PropsWithChildren<{
  eyebrow: string;
  title: string;
  subtitle: string;
}>) {
  const theme = usePremiumTheme();
  const styles = useAuthStyles();
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.screen}>
      <GrainyGradientBackground
        amplitude={0.1}
        animated={false}
        colors={["#b01818", "#b3aeb9", "#073990"]}
        speed={0.9}
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={[styles.content, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 24 }]}
      >
        <View style={styles.brandRow}>
          <View style={styles.brandMark}>
            <Ionicons color={theme.colors.text} name="musical-notes" size={22} />
          </View>
          <Text style={styles.brandText}>RQST</Text>
        </View>

        <View style={styles.heroCopy}>
          <Text style={styles.eyebrow}>{eyebrow}</Text>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>

        <SurfaceCard style={styles.card}>{children}</SurfaceCard>
      </KeyboardAvoidingView>
    </View>
  );
}

export function AuthSubmitButton({
  label,
  onPress,
  disabled = false,
  loading = false,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || loading}
      onPress={onPress}
      style={[styles.submitButton, (disabled || loading) && styles.submitButtonDisabled]}
    >
      <Text style={styles.submitButtonText}>{loading ? "Please wait..." : label}</Text>
      <Ionicons color={theme.colors.text} name="arrow-forward" size={18} />
    </Pressable>
  );
}

export function AuthFooterLink({
  prompt,
  href,
  label,
}: {
  prompt: string;
  href: "/(auth)/login" | "/(auth)/register";
  label: string;
}) {
  return (
    <View style={styles.footerRow}>
      <Text style={styles.footerPrompt}>{prompt}</Text>
      <Link href={href}>
        <Text style={styles.footerLink}>{label}</Text>
      </Link>
    </View>
  );
}
