<template>
  <AuthShell
    eyebrow="Welcome back"
    subtitle="Sign in to manage your queue, earnings, and public DJ profile."
    title="Log in"
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

      <label class="form-field">
        <span class="form-label">Password</span>
        <input
          v-model="password"
          autocomplete="current-password"
          class="form-input"
          type="password"
        />
        <p v-if="fieldErrors.password" class="form-error">{{ fieldErrors.password }}</p>
      </label>

      <p v-if="formError" class="form-error">{{ formError }}</p>

      <button class="btn btn-primary auth-submit" :disabled="isSubmitting" type="submit">
        {{ isSubmitting ? "Signing in..." : "Sign in" }}
      </button>

      <p class="auth-footer">
        New to RQST?
        <NuxtLink class="auth-link" to="/signup">Create account</NuxtLink>
      </p>
    </form>
  </AuthShell>
</template>

<script setup lang="ts">
import AuthShell from "~/components/AuthShell.vue";
import { validateEmail, validatePassword } from "~/lib/auth-validation";

definePageMeta({
  layout: "auth",
});

const authStore = useAuthStore();
const route = useRoute();

const email = ref("");
const password = ref("");
const fieldErrors = ref<{ email?: string; password?: string }>({});
const formError = ref("");
const isSubmitting = ref(false);

onMounted(() => {
  const emailParam = route.query.email;
  if (typeof emailParam === "string" && emailParam.trim()) {
    email.value = emailParam.trim().toLowerCase();
  }
});

function validateForm() {
  const nextErrors: { email?: string; password?: string } = {};
  const emailError = validateEmail(email.value);
  const passwordError = validatePassword(password.value);

  if (emailError) {
    nextErrors.email = emailError;
  }

  if (passwordError) {
    nextErrors.password = passwordError;
  }

  fieldErrors.value = nextErrors;
  return Object.keys(nextErrors).length === 0;
}

async function handleSubmit() {
  if (!validateForm() || isSubmitting.value) {
    return;
  }

  isSubmitting.value = true;
  formError.value = "";

  try {
    await authStore.signIn(email.value, password.value);
    const redirect = typeof route.query.redirect === "string" ? route.query.redirect : "/home";
    await navigateTo(redirect);
  } catch (error) {
    formError.value = error instanceof Error ? error.message : "Could not sign in. Please try again.";
  } finally {
    isSubmitting.value = false;
  }
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
