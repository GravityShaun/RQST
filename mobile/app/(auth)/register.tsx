import { useState } from "react";
import { StyleSheet, Text } from "react-native";
import { router, type Href } from "expo-router";

import {
  AuthFooterLink,
  AuthFormField,
  AuthScreenShell,
  AuthSubmitButton,
} from "../../src/features/auth/auth-ui";
import { emailSignupSchema, type EmailSignupFormValues } from "../../src/features/auth/schemas";

const initialValues: EmailSignupFormValues = {
  email: "",
};

export default function RegisterScreen() {
  const [values, setValues] = useState(initialValues);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof EmailSignupFormValues, string>>>({});
  const [formError, setFormError] = useState("");

  function updateField<Key extends keyof EmailSignupFormValues>(key: Key, value: EmailSignupFormValues[Key]) {
    setValues((current) => ({ ...current, [key]: value }));
    setFieldErrors((current) => ({ ...current, [key]: undefined }));
    setFormError("");
  }

  function handleSubmit() {
    const parsed = emailSignupSchema.safeParse(values);
    if (!parsed.success) {
      const nextErrors: Partial<Record<keyof EmailSignupFormValues, string>> = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0];
        if (typeof field === "string" && !nextErrors[field as keyof EmailSignupFormValues]) {
          nextErrors[field as keyof EmailSignupFormValues] = issue.message;
        }
      }
      setFieldErrors(nextErrors);
      return;
    }

    setFormError("");

    router.push(`/onboarding?email=${encodeURIComponent(parsed.data.email.trim().toLowerCase())}` as Href);
  }

  return (
    <AuthScreenShell
      eyebrow="Join the room"
      subtitle="Enter your email to get started. We'll finish setting up your profile next."
      title="Sign up"
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

      {formError ? <Text style={styles.formError}>{formError}</Text> : null}

      <AuthSubmitButton label="Continue" onPress={handleSubmit} />

      <AuthFooterLink href="/(auth)/login" label="Sign in" prompt="Already have an account?" />
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
