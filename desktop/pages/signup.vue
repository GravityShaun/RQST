<template>
  <AuthShell
    eyebrow="Join the console"
    subtitle="Enter your email to get started. We'll finish setting up your DJ account next."
    title="Sign up"
  >
    <form class="auth-form" @submit.prevent="handleSubmit">
      <label class="form-field">
        <span class="form-label">Email</span>
        <input
          v-model="email"
          autocomplete="email"
          class="form-input"
          inputmode="email"
          type="email"
        />
        <p v-if="fieldErrors.email" class="form-error">{{ fieldErrors.email }}</p>
      </label>

      <p v-if="formError" class="form-error">{{ formError }}</p>

      <button class="btn btn-primary auth-submit" type="submit">Continue</button>

      <p class="auth-footer">
        Already have an account?
        <NuxtLink class="auth-link" to="/login">Sign in</NuxtLink>
      </p>
    </form>
  </AuthShell>
</template>

<script setup lang="ts">
import AuthShell from "~/components/AuthShell.vue";
import { validateEmail } from "~/lib/auth-validation";

definePageMeta({
  layout: "auth",
});

const route = useRoute();

const email = ref("");
const fieldErrors = ref<{ email?: string }>({});
const formError = ref("");

onMounted(() => {
  const emailParam = route.query.email;
  if (typeof emailParam === "string" && emailParam.trim()) {
    email.value = emailParam.trim().toLowerCase();
  }
});

function validateForm() {
  const emailError = validateEmail(email.value);
  fieldErrors.value = emailError ? { email: emailError } : {};
  return !emailError;
}

async function handleSubmit() {
  if (!validateForm()) {
    return;
  }

  formError.value = "";
  await navigateTo(`/onboarding?email=${encodeURIComponent(email.value.trim().toLowerCase())}`);
}
</script>

<style scoped>
.auth-form {
  display: grid;
  gap: 16px;
}

.auth-submit {
  justify-content: center;
  width: 100%;
}

.auth-footer {
  color: var(--rqst-ink-muted);
  font-size: 0.92rem;
  margin: 4px 0 0;
  text-align: center;
}

.auth-link {
  color: var(--rqst-coral);
  font-weight: 700;
}
</style>
