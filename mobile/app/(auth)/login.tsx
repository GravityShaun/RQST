import { useState } from "react";
import { StyleSheet, Text } from "react-native";
import { router } from "expo-router";

import {
  AuthFooterLink,
  AuthFormField,
  AuthScreenShell,
  AuthSubmitButton,
} from "../../src/features/auth/auth-ui";
import { loginSchema, type LoginFormValues } from "../../src/features/auth/schemas";
import { useAuthStore } from "../../src/store/auth";

const initialValues: LoginFormValues = {
  email: "",
  password: "",
};

export default function LoginScreen() {
  const signIn = useAuthStore((state) => state.signIn);
  const [values, setValues] = useState(initialValues);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof LoginFormValues, string>>>({});
  const [formError, setFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  function updateField<Key extends keyof LoginFormValues>(key: Key, value: LoginFormValues[Key]) {
    setValues((current) => ({ ...current, [key]: value }));
    setFieldErrors((current) => ({ ...current, [key]: undefined }));
    setFormError("");
  }

  async function handleSubmit() {
    const parsed = loginSchema.safeParse(values);
    if (!parsed.success) {
      const nextErrors: Partial<Record<keyof LoginFormValues, string>> = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0];
        if (typeof field === "string" && !nextErrors[field as keyof LoginFormValues]) {
          nextErrors[field as keyof LoginFormValues] = issue.message;
        }
      }
      setFieldErrors(nextErrors);
      return;
    }

    setIsSubmitting(true);
    setFormError("");

    try {
      await signIn(parsed.data.email, parsed.data.password);
      router.replace("/(tabs)/home");
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Could not sign in. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthScreenShell
      eyebrow="Welcome back"
      subtitle="Sign in to request songs, track your queue, and manage your account."
      title="Log in"
    >
      <AuthFormField
        autoComplete="email"
        error={fieldErrors.email}
        keyboardType="email-address"
        label="Email"
        onChangeText={(email) => updateField("email", email)}
        textContentType="emailAddress"
        value={values.email}
      />
      <AuthFormField
        autoComplete="password"
        error={fieldErrors.password}
        label="Password"
        onChangeText={(password) => updateField("password", password)}
        secureTextEntry
        textContentType="password"
        value={values.password}
      />

      {formError ? <Text style={styles.formError}>{formError}</Text> : null}

      <AuthSubmitButton label="Sign in" loading={isSubmitting} onPress={() => void handleSubmit()} />

      <AuthFooterLink href="/(auth)/register" label="Create account" prompt="New to RQST?" />
    </AuthScreenShell>
  );
}

const styles = StyleSheet.create({
  formError: {
    color: "#B73524",
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
});
