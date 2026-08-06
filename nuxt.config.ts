import { resolveRuntimeConfig } from './scripts/runtime-config.mjs'

// Nuxt 4.5 removed the `nitro` key from NuxtConfig types while keeping runtime
// support (nuxt/nuxt#34039; regression re nuxt/nuxt#34173). Restore the typed
// key so the strict `.nuxt/tsconfig.json` typecheck accepts nitro config.
declare module 'nuxt/schema' {
  interface NuxtConfig {
    nitro?: import('nitropack/config').NitroConfig
  }
}

// https://nuxt.com/docs/api/configuration/nuxt-config
const env = (globalThis as typeof globalThis & {
  process?: {
    env?: Record<string, string | undefined>
  }
}).process?.env ?? {}
const runtimeEndpoints = resolveRuntimeConfig(env)
const serverApiBase = runtimeEndpoints.serverApiBase
const publicApiBase = runtimeEndpoints.publicApiBase
const publicDirectApiBase = runtimeEndpoints.publicDirectApiBase
const apiRouteRules = publicApiBase.startsWith('/')
  ? {
      [`${publicApiBase}/**`]: {
        proxy: `${serverApiBase}/**`
      }
    }
  : {}
const connectSources = ["'self'"]
for (const endpoint of [publicApiBase, publicDirectApiBase, runtimeEndpoints.wsBase]) {
  if (/^(https?|wss?):\/\//.test(endpoint)) connectSources.push(new URL(endpoint).origin)
}
const commonHeaders = {
  'referrer-policy': 'same-origin',
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY'
}

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  buildDir: env.NUXT_BUILD_DIR || undefined,
  devtools: { enabled: env.NODE_ENV !== 'production' },

  modules: ['@nuxt/eslint', 'nuxt-security'],

  security: {
    enabled: true,
    nonce: true,
    requestSizeLimiter: false,
    rateLimiter: false,
    xssValidator: false,
    corsHandler: false,
    allowedMethodsRestricter: false,
    removeLoggers: false,
    sri: true,
    ssg: false,
    headers: {
      contentSecurityPolicy: {
        'default-src': ["'self'"],
        'script-src': ["'self'", "'strict-dynamic'", "'nonce-{{nonce}}'"],
        'script-src-attr': ["'none'"],
        'style-src': ["'self'", "'unsafe-inline'"],
        'font-src': ["'self'", 'data:'],
        'img-src': ["'self'", 'data:', 'blob:'],
        'connect-src': [...new Set(connectSources)],
        'frame-ancestors': ["'none'"],
        'base-uri': ["'self'"],
        'form-action': ["'self'"],
        'object-src': ["'none'"],
        'worker-src': ["'self'"],
        'upgrade-insecure-requests': false
      },
      referrerPolicy: 'same-origin',
      strictTransportSecurity: false,
      xContentTypeOptions: 'nosniff',
      xFrameOptions: 'DENY',
      crossOriginEmbedderPolicy: false,
      crossOriginOpenerPolicy: false,
      crossOriginResourcePolicy: false,
      originAgentCluster: false,
      xDNSPrefetchControl: false,
      xDownloadOptions: false,
      xPermittedCrossDomainPolicies: false,
      xXSSProtection: false,
      permissionsPolicy: false
    }
  },

  css: ['~/assets/css/main.css'],

  nitro: {
    compressPublicAssets: true
  },

  runtimeConfig: {
    apiBase: serverApiBase,
    public: {
      apiBase: publicApiBase,
      directApiBase: publicDirectApiBase,
      wsBase: runtimeEndpoints.wsBase
    }
  },

  routeRules: {
    '/**': { headers: commonHeaders },
    '/_nuxt/**': {
      headers: {
        ...commonHeaders,
        'cache-control': 'public, max-age=31536000, immutable'
      }
    },
    '/favicon.ico': {
      headers: {
        ...commonHeaders,
        'cache-control': 'public, max-age=604800'
      }
    },
    '/robots.txt': {
      headers: {
        ...commonHeaders,
        'cache-control': 'public, max-age=3600'
      }
    },
    '/sitemap.xml': {
      headers: {
        ...commonHeaders,
        'cache-control': 'public, max-age=3600'
      }
    },
    ...apiRouteRules
  },

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
      script: [
        {
          innerHTML: `(function(){try{var c=document.cookie.match(/(^|; )theme=([^;]*)/);var v=c?c[2]:'';if(!v&&window.matchMedia('(prefers-color-scheme:dark)').matches){v='dark';document.cookie='theme=dark;max-age=31536000;path=/;SameSite=Lax'}if(v==='dark'){document.documentElement.setAttribute('data-theme','dark');var m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute('content','#0f172a')}}catch(e){}})()`,
          type: 'text/javascript'
        }
      ],
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
