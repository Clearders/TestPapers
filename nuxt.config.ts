import { DEFAULT_API_BASE, DEFAULT_SERVER_API_BASE } from './app/utils/apiEndpoint'

// https://nuxt.com/docs/api/configuration/nuxt-config
const env = (globalThis as typeof globalThis & {
  process?: {
    env?: Record<string, string | undefined>
  }
}).process?.env ?? {}
const serverApiBase = (env.NUXT_API_BASE || env.NUXT_SERVER_API_BASE || DEFAULT_SERVER_API_BASE).replace(/\/+$/, '')
const publicApiBase = (env.NUXT_PUBLIC_API_BASE || DEFAULT_API_BASE).replace(/\/+$/, '')
const apiRouteRules = publicApiBase.startsWith('/')
  ? {
      [`${publicApiBase}/**`]: {
        proxy: `${serverApiBase}/**`
      }
    }
  : {}

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  runtimeConfig: {
    apiBase: serverApiBase,
    public: {
      apiBase: publicApiBase,
      wsBase: env.NUXT_PUBLIC_WS_BASE || ''
    }
  },

  routeRules: apiRouteRules,

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
        { name: 'description', content: 'A website for creating test papers with real-time LaTeX support.' },
        { name: 'theme-color', content: '#f5f7fb' }
      ]
    }
  }
})
