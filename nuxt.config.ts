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
const connectSources = ["'self'", 'ws:', 'wss:']
for (const endpoint of [publicApiBase, env.NUXT_PUBLIC_WS_BASE || '']) {
  if (/^(https?|wss?):\/\//.test(endpoint)) connectSources.push(new URL(endpoint).origin)
}
const securityHeaders = {
  'content-security-policy': `default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; font-src 'self' data:; img-src 'self' data: blob:; connect-src ${[...new Set(connectSources)].join(' ')}; frame-ancestors 'none'; base-uri 'self'; form-action 'self'`,
  'referrer-policy': 'same-origin',
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY'
}

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  buildDir: env.NUXT_BUILD_DIR || undefined,
  devtools: { enabled: true },

  runtimeConfig: {
    apiBase: serverApiBase,
    public: {
      apiBase: publicApiBase,
      directApiBase: serverApiBase,
      wsBase: env.NUXT_PUBLIC_WS_BASE || ''
    }
  },

  routeRules: {
    '/**': { headers: securityHeaders },
    ...apiRouteRules
  },

  css: ['katex/dist/katex.min.css'],

  vite: {
    server: {
      fs: {
        allow: ['.']
      }
    },
    build: {
      rollupOptions: {
        onwarn (warning, handler) {
          if (warning.plugin === 'nuxt:module-preload-polyfill' && warning.message?.includes('Sourcemap')) {
            return
          }
          handler(warning)
        }
      }
    }
  },

  app: {
    head: {
      htmlAttrs: {
        lang: 'en'
      },
      title: 'TestPapers',
      titleTemplate: '%s | TestPapers',
      meta: [
        { name: 'description', content: 'Create professional test papers and exams with live LaTeX rendering. Question bank manager, PDF/DOCX exports, and real-time collaboration.' },
        { name: 'keywords', content: 'test paper, exam generator, LaTeX editor, question bank, quiz maker, assessment tool' },
        { name: 'theme-color', content: '#f5f7fb' },
        { name: 'robots', content: 'index, follow' },

        { property: 'og:title', content: 'TestPapers' },
        { property: 'og:description', content: 'Create professional test papers and exams with live LaTeX rendering. Question bank manager, PDF/DOCX exports, and real-time collaboration.' },
        { property: 'og:type', content: 'website' },
        { property: 'og:site_name', content: 'TestPapers' },
        { property: 'og:locale', content: 'en_US' },

        { name: 'twitter:card', content: 'summary_large_image' },
        { name: 'twitter:title', content: 'TestPapers' },
        { name: 'twitter:description', content: 'Create professional test papers and exams with live LaTeX rendering.' }
      ]
    }
  }
})
