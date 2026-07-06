import { validateEmail } from "~/lib/auth-validation";

export default defineNuxtRouteMiddleware((to) => {
  const emailParam = to.query.email;
  const email = typeof emailParam === "string" ? emailParam.trim().toLowerCase() : "";

  if (!email || validateEmail(email)) {
    return navigateTo("/signup");
  }
});
