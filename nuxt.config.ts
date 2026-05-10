// https://nuxt.com/docs/api/configuration/nuxt-config
const env = (globalThis as typeof globalThis & {
  process?: {
    env?: Record<string, string | undefined>
  }
}).process?.env ?? {}

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  runtimeConfig: {
    public: {
      apiBase: env.NUXT_PUBLIC_API_BASE || 'http://127.0.0.1:8010/api/v1',
      wsBase: env.NUXT_PUBLIC_WS_BASE || ''
    }
  },

  css: ['katex/dist/katex.min.css'],

  vite: {
    server: {
      fs: {
        allow: ['.']
      }
    }
  },

  app: {
    head: {
      htmlAttrs: {
        lang: 'en'
      },
      title: 'TestPapers',
      meta: [
        { name: 'description', content: 'A website for creating test papers with real-time LaTeX support.' }
      ]
    }
  }
})
