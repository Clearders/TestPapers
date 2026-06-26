import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const nuxtConfig = readFileSync(join(root, 'nuxt.config.ts'), 'utf8')
const packageJson = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const latexRenderer = readFileSync(join(root, 'app/components/LatexRenderer.vue'), 'utf8')

function assert(condition, message) {
  if (!condition) {
    console.error(`[csp-hardening] ${message}`)
    process.exitCode = 1
  }
}

assert(
  packageJson.dependencies?.['nuxt-security'] === '2.5.1',
  'nuxt-security must stay pinned to a Node 22-compatible release for Debian production.'
)

assert(
  nuxtConfig.includes("'nuxt-security'") &&
    nuxtConfig.includes('nonce: true') &&
    nuxtConfig.includes("'nonce-{{nonce}}'") &&
    nuxtConfig.includes("'strict-dynamic'"),
  'Nuxt CSP must use nonce-based SSR script execution with strict-dynamic.'
)

assert(
  !/script-src['"]?\s*:\s*\[[^\]]*['"]'unsafe-inline'['"]/s.test(nuxtConfig) &&
    !/script-src[^;\n]*'unsafe-inline'/.test(nuxtConfig),
  "Nuxt script-src must not allow 'unsafe-inline'."
)

assert(
  !nuxtConfig.includes("'content-security-policy'"),
  'Nuxt routeRules must not set a static CSP header that would bypass nonce injection.'
)

assert(
  !/const\s+connectSources\s*=\s*\[[^\]]*['"]wss?:['"]/s.test(nuxtConfig),
  'Nuxt connect-src must use concrete origins, not ws: or wss: scheme-wide allowances.'
)

assert(
  !nuxtConfig.includes('cdn.jsdelivr.net'),
  'Nuxt CSP must not allow jsDelivr for KaTeX assets.'
)

assert(
  nuxtConfig.includes("'upgrade-insecure-requests': false"),
  'Nuxt CSP must not force upgrade-insecure-requests because Debian deployments may use plain intranet HTTP.'
)

assert(
  latexRenderer.includes("import('katex/dist/katex.min.css')") && latexRenderer.includes("import('katex')"),
  'KaTeX CSS and runtime must stay bundled locally.'
)

if (process.exitCode) process.exit(process.exitCode)

console.log('[csp-hardening] OK')
