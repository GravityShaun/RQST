<template>
  <AuthShell
    :eyebrow="currentStep.eyebrow"
    :subtitle="currentStep.subtitle"
    :title="currentStep.title"
  >
    <div class="onboarding-progress">
      <span
        v-for="(_, index) in steps"
        :key="index"
        class="onboarding-dot"
        :class="{ 'is-active': index === stepIndex, 'is-complete': index < stepIndex }"
      />
    </div>

    <form v-if="stepIndex === 0" class="auth-form" @submit.prevent="goToNextStep">
      <p class="onboarding-copy">
        Run live sessions, confirm requests, and publish the profile fans see in the mobile app.
      </p>
      <div class="btn-row">
        <button class="btn btn-secondary" type="button" @click="goToChangeEmail">Change email</button>
        <button class="btn btn-primary" type="submit">Get started</button>
      </div>
    </form>

    <form v-else-if="stepIndex === 1" class="auth-form" @submit.prevent="goToNextStep">
      <label class="form-field">
        <span class="form-label">Display name</span>
        <input
          v-model="displayName"
          autocomplete="name"
          class="form-input"
          maxlength="120"
          type="text"
        />
        <p v-if="fieldErrors.displayName" class="form-error">{{ fieldErrors.displayName }}</p>
        <p class="form-help">This is how you'll appear in the console and to fans.</p>
      </label>

      <div class="btn-row">
        <button class="btn btn-secondary" type="button" @click="goToPreviousStep">Back</button>
        <button class="btn btn-primary" type="submit">Continue</button>
      </div>
    </form>

    <form v-else class="auth-form" @submit.prevent="handleSubmit">
      <button class="onboarding-email" type="button" @click="goToChangeEmail">
        {{ email }}
      </button>
      <p class="form-help onboarding-email-help">Tap to use a different email.</p>

      <label class="form-field">
        <span class="form-label">Password</span>
        <input v-model="password" autocomplete="new-password" class="form-input" type="password" />
        <p v-if="fieldErrors.password" class="form-error">{{ fieldErrors.password }}</p>
      </label>

      <label class="form-field">
        <span class="form-label">Confirm password</span>
        <input
          v-model="confirmPassword"
          autocomplete="new-password"
          class="form-input"
          type="password"
        />
        <p v-if="fieldErrors.confirmPassword" class="form-error">{{ fieldErrors.confirmPassword }}</p>
      </label>

      <p v-if="formError" class="form-error">{{ formError }}</p>
      <p v-if="emailAlreadyExists" class="auth-footer">
        Already have an account?
        <NuxtLink class="auth-link" :to="loginLink">Sign in</NuxtLink>
        or
        <button class="auth-inline-link" type="button" @click="goToChangeEmail">use a different email</button>.
      </p>

      <div class="btn-row">
        <button class="btn btn-secondary" :disabled="isSubmitting" type="button" @click="goToPreviousStep">
          Back
        </button>
        <button class="btn btn-primary" :disabled="isSubmitting" type="submit">
          {{ isSubmitting ? "Creating account..." : "Create account" }}
        </button>
      </div>
    </form>
  </AuthShell>
</template>

<script setup lang="ts">
import AuthShell from "~/components/AuthShell.vue";
import { EMAIL_ALREADY_EXISTS_MESSAGE } from "~/lib/auth-api";
import {
  validateConfirmPassword,
  validateDisplayName,
  validatePassword,
} from "~/lib/auth-validation";

definePageMeta({
  layout: "auth",
  middleware: ["onboarding-email"],
});

const route = useRoute();
const authStore = useAuthStore();

const email = computed(() => {
  const value = route.query.email;
  return typeof value === "string" ? value.trim().toLowerCase() : "";
});

const steps = [
  {
    eyebrow: "Welcome",
    title: "Set up your DJ console",
    subtitle: "Create your account to manage requests, payouts, and your public profile.",
  },
  {
    eyebrow: "Step 1 of 2",
    title: "What should we call you?",
    subtitle: "Choose the display name fans and your console will use.",
  },
  {
    eyebrow: "Step 2 of 2",
    title: "Secure your account",
    subtitle: "Pick a password so you can sign back in anytime.",
  },
] as const;

const stepIndex = ref(0);
const displayName = ref("");
const password = ref("");
const confirmPassword = ref("");
const fieldErrors = ref<{
  displayName?: string;
  password?: string;
  confirmPassword?: string;
}>({});
const formError = ref("");
const isSubmitting = ref(false);
const emailAlreadyExists = ref(false);

const loginLink = computed(() => `/login?email=${encodeURIComponent(email.value)}`);

const currentStep = computed(() => steps[stepIndex.value] ?? steps[0]);

function goToChangeEmail() {
  return navigateTo(`/signup?email=${encodeURIComponent(email.value)}`);
}

function goToNextStep() {
  fieldErrors.value = {};
  formError.value = "";
  emailAlreadyExists.value = false;

  if (stepIndex.value === 1) {
    const displayNameError = validateDisplayName(displayName.value);
    if (displayNameError) {
      fieldErrors.value.displayName = displayNameError;
      return;
    }
  }

  if (stepIndex.value < steps.length - 1) {
    stepIndex.value += 1;
  }
}

function goToPreviousStep() {
  fieldErrors.value = {};
  formError.value = "";
  emailAlreadyExists.value = false;

  if (stepIndex.value > 0) {
    stepIndex.value -= 1;
  }
}

async function handleSubmit() {
  fieldErrors.value = {};
  formError.value = "";
  emailAlreadyExists.value = false;

  const passwordError = validatePassword(password.value);
  const confirmPasswordError = validateConfirmPassword(password.value, confirmPassword.value);

  if (passwordError || confirmPasswordError) {
    fieldErrors.value = {
      ...(passwordError ? { password: passwordError } : {}),
      ...(confirmPasswordError ? { confirmPassword: confirmPasswordError } : {}),
    };
    return;
  }

  isSubmitting.value = true;

  try {
    await authStore.signUp(email.value, password.value, displayName.value);
    await navigateTo("/profile");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not create your account. Please try again.";
    formError.value = message;
    emailAlreadyExists.value = message === EMAIL_ALREADY_EXISTS_MESSAGE;
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

.onboarding-progress {
  display: flex;
  gap: 8px;
  justify-content: center;
  margin-bottom: 18px;
}

.onboarding-dot {
  background: rgba(30, 23, 23, 0.12);
  border-radius: 999px;
  height: 8px;
  transition: background 0.18s ease, width 0.18s ease;
  width: 8px;
}

.onboarding-dot.is-active {
  background: var(--rqst-coral);
  width: 24px;
}

.onboarding-dot.is-complete {
  background: rgba(224, 90, 71, 0.42);
}

.onboarding-copy {
  color: var(--rqst-ink-muted);
  line-height: 1.55;
  margin: 0;
}

.onboarding-email {
  background: rgba(224, 90, 71, 0.08);
  border: 1px solid rgba(224, 90, 71, 0.16);
  border-radius: 999px;
  color: var(--rqst-coral);
  cursor: pointer;
  font-size: 0.88rem;
  font-weight: 700;
  margin: 0;
  padding: 10px 14px;
  text-align: center;
  transition: background 0.18s ease, border-color 0.18s ease;
  width: 100%;
}

.onboarding-email:hover {
  background: rgba(224, 90, 71, 0.12);
  border-color: rgba(224, 90, 71, 0.28);
}

.onboarding-email-help {
  margin-top: -8px;
  text-align: center;
}

.auth-footer {
  color: var(--rqst-ink-muted);
  font-size: 0.92rem;
  margin: 0;
  text-align: center;
}

.auth-link {
  color: var(--rqst-coral);
  font-weight: 700;
}

.auth-inline-link {
  background: none;
  border: 0;
  color: var(--rqst-coral);
  cursor: pointer;
  font: inherit;
  font-weight: 700;
  padding: 0;
  text-decoration: underline;
}
</style>
