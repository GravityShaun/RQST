export default defineNuxtConfig({
  compatibilityDate: "2026-07-06",
  modules: ["@pinia/nuxt"],
  css: ["~/assets/admin.css"],
  devtools: { enabled: true },
  app: {
    head: {
      title: "RQST Admin",
      meta: [
        { name: "viewport", content: "width=device-width, initial-scale=1" },
        { name: "theme-color", content: "#f4f5f2" },
      ],
    },
  },
  runtimeConfig: {
    public: {
      apiBaseUrl: "http://127.0.0.1:8000/api/v1",
    },
  },
  vite: {
    server: {
      watch: {
        ignored: ["**/src-tauri/target/**"],
      },
    },
  },
});
