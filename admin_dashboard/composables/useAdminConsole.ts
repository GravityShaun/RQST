import {
  adminApi,
  clearTokens,
  getMe,
  loadAdminSettings,
  loadTokens,
  login,
  saveAdminSettings,
  saveTokens,
  type AdminDj,
  type AdminOverview,
  type AdminPayment,
  type AdminReport,
  type AdminSession,
  type AdminSettings,
  type AdminUser,
  type CurrentUser,
} from "~/lib/admin-api";

const defaultState = () => ({
  ready: false,
  loading: false,
  error: "",
  message: "",
  currentUser: null as CurrentUser | null,
  settings: null as AdminSettings | null,
  overview: null as AdminOverview | null,
  users: [] as AdminUser[],
  payments: [] as AdminPayment[],
  djs: [] as AdminDj[],
  sessions: [] as AdminSession[],
  reports: [] as AdminReport[],
});

type AdminState = ReturnType<typeof defaultState>;

export function useAdminConsole() {
  const config = useRuntimeConfig();
  const state = useState<AdminState>("admin-console", defaultState);

  const apiBaseUrl = computed(() => state.value.settings?.apiBaseUrl || config.public.apiBaseUrl);
  const isAuthenticated = computed(() => Boolean(state.value.currentUser));
  const isAdmin = computed(() => state.value.currentUser?.role === "admin");

  function setMessage(message: string) {
    state.value.message = message;
    state.value.error = "";
  }

  function setError(error: unknown) {
    state.value.error = error instanceof Error ? error.message : "Something went wrong.";
    state.value.message = "";
  }

  async function bootstrap() {
    if (import.meta.server || state.value.ready) {
      return;
    }
    state.value.settings = loadAdminSettings(config.public.apiBaseUrl);
    const tokens = loadTokens();
    if (!tokens?.accessToken) {
      state.value.ready = true;
      return;
    }

    try {
      const user = await getMe(apiBaseUrl.value, tokens.accessToken);
      if (user.role !== "admin") {
        clearTokens();
        throw new Error("This dashboard requires an admin account.");
      }
      state.value.currentUser = user;
    } catch (error) {
      clearTokens();
      setError(error);
    } finally {
      state.value.ready = true;
    }
  }

  async function signIn(email: string, password: string) {
    state.value.loading = true;
    try {
      const tokens = await login(apiBaseUrl.value, email.trim().toLowerCase(), password);
      saveTokens(tokens);
      const user = await getMe(apiBaseUrl.value, tokens.accessToken);
      if (user.role !== "admin") {
        clearTokens();
        throw new Error("This account is not an admin.");
      }
      state.value.currentUser = user;
      await refreshAll();
      await navigateTo("/");
    } catch (error) {
      setError(error);
    } finally {
      state.value.loading = false;
    }
  }

  async function signOut() {
    clearTokens();
    state.value.currentUser = null;
    await navigateTo("/login");
  }

  async function refreshAll() {
    state.value.loading = true;
    try {
      const [overview, users, payments, djs, sessions, reports] = await Promise.all([
        adminApi.overview(apiBaseUrl.value),
        adminApi.users(apiBaseUrl.value),
        adminApi.payments(apiBaseUrl.value),
        adminApi.djs(apiBaseUrl.value),
        adminApi.sessions(apiBaseUrl.value),
        adminApi.reports(apiBaseUrl.value),
      ]);
      state.value.overview = overview;
      state.value.users = users;
      state.value.payments = payments;
      state.value.djs = djs;
      state.value.sessions = sessions;
      state.value.reports = reports;
      state.value.error = "";
    } catch (error) {
      setError(error);
    } finally {
      state.value.loading = false;
    }
  }

  async function refreshSection(section: "overview" | "users" | "payments" | "djs" | "sessions" | "reports") {
    try {
      if (section === "overview") state.value.overview = await adminApi.overview(apiBaseUrl.value);
      if (section === "users") state.value.users = await adminApi.users(apiBaseUrl.value);
      if (section === "payments") state.value.payments = await adminApi.payments(apiBaseUrl.value);
      if (section === "djs") state.value.djs = await adminApi.djs(apiBaseUrl.value);
      if (section === "sessions") state.value.sessions = await adminApi.sessions(apiBaseUrl.value);
      if (section === "reports") state.value.reports = await adminApi.reports(apiBaseUrl.value);
      state.value.error = "";
    } catch (error) {
      setError(error);
    }
  }

  async function deleteUser(userId: number) {
    try {
      const response = await adminApi.deleteUser(apiBaseUrl.value, userId);
      setMessage(response.message);
      await Promise.all([refreshSection("users"), refreshSection("overview")]);
      return true;
    } catch (error) {
      setError(error);
      return false;
    }
  }

  async function restoreUser(userId: number) {
    const response = await adminApi.restoreUser(apiBaseUrl.value, userId);
    setMessage(response.message);
    await Promise.all([refreshSection("users"), refreshSection("overview")]);
  }

  async function updateUser(userId: number, body: Partial<AdminUser>) {
    await adminApi.updateUser(apiBaseUrl.value, userId, body);
    setMessage("User updated.");
    await Promise.all([refreshSection("users"), refreshSection("djs"), refreshSection("overview")]);
  }

  async function refundPayment(paymentId: number, reason: string) {
    const response = await adminApi.refundPayment(apiBaseUrl.value, paymentId, reason);
    setMessage(response.message);
    await Promise.all([refreshSection("payments"), refreshSection("overview"), refreshSection("sessions")]);
  }

  async function chargebackPayment(paymentId: number, reason: string) {
    const response = await adminApi.chargebackPayment(apiBaseUrl.value, paymentId, reason);
    setMessage(response.message);
    await Promise.all([refreshSection("payments"), refreshSection("overview"), refreshSection("sessions")]);
  }

  async function updateSession(sessionId: number, body: Partial<AdminSession>) {
    await adminApi.updateSession(apiBaseUrl.value, sessionId, body);
    setMessage("Session updated.");
    await refreshSection("sessions");
  }

  async function resolveReport(reportId: number) {
    const response = await adminApi.resolveReport(apiBaseUrl.value, reportId);
    setMessage(response.message);
    await Promise.all([refreshSection("reports"), refreshSection("overview")]);
  }

  function updateSettings(settings: AdminSettings) {
    saveAdminSettings(settings);
    state.value.settings = settings;
    setMessage("Settings saved.");
  }

  return {
    state,
    apiBaseUrl,
    isAuthenticated,
    isAdmin,
    bootstrap,
    signIn,
    signOut,
    refreshAll,
    refreshSection,
    deleteUser,
    restoreUser,
    updateUser,
    refundPayment,
    chargebackPayment,
    updateSession,
    resolveReport,
    updateSettings,
  };
}
