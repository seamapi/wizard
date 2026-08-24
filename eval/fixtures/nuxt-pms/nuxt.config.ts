// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-01-01',
  devtools: { enabled: true },

  css: ['~/assets/css/main.css'],

  runtimeConfig: {
    // Server-only. Set SEAM_API_KEY in .env; the booking flow is where an
    // integration later issues access (a PIN, a mobile key) for a reservation.
    seamApiKey: process.env.SEAM_API_KEY ?? '',
    // Path to the SQLite file. Defaults to dev.db, created on first request.
    databaseUrl: process.env.DATABASE_URL ?? 'dev.db',
  },

  nitro: {
    // better-sqlite3 ships a native binding, so keep it external instead of
    // letting Nitro try to bundle the compiled .node file into the server.
    externals: {
      external: ['better-sqlite3'],
    },
  },
})
