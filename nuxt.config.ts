// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  nitro: {
    imports: {
      warn (message) {
        if (message.includes('Duplicated imports "useAppConfig"')) return
        console.warn(message)
      }
    }
  },

  modules: ['@nuxtjs/i18n'],

  i18n: {
    strategy: 'prefix_except_default',
    defaultLocale: 'en',
    locales: [
      { code: 'en', name: 'English', iso: 'en-US', file: 'en.json' },
      { code: 'zh', name: '中文', iso: 'zh-CN', file: 'zh.json' }
    ],
    langDir: 'locales',
    detectBrowserLanguage: {
      useCookie: true,
      cookieKey: 'i18n_redirected',
      alwaysRedirect: false,
      redirectOn: 'root'
    },
    vueI18n: './i18n.config.ts'
  },

  runtimeConfig: {
    public: {
      apiBase: process.env.NUXT_PUBLIC_API_BASE || 'http://127.0.0.1:8010/api/v1',
      wsBase: process.env.NUXT_PUBLIC_WS_BASE || ''
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
