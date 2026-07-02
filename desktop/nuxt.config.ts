export default defineNuxtConfig({
  modules: ["@pinia/nuxt"],
  css: ["~/assets/main.css"],
  devtools: { enabled: true },
  app: {
    head: {
      title: "RQST DJ Console",
      meta: [{ name: "viewport", content: "width=device-width, initial-scale=1" }],
    },
  },
  runtimeConfig: {
    public: {
      apiBaseUrl: "http://127.0.0.1:8000/api/v1",
    },
  },
});

