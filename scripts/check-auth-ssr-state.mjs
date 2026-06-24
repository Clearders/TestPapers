import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const useAuth = readFileSync(join(root, 'app/composables/useAuth.ts'), 'utf8')
const useApi = readFileSync(join(root, 'app/composables/useApi.ts'), 'utf8')

function assert(condition, message) {
  if (!condition) {
    console.error(`[auth-ssr-state] ${message}`)
    process.exitCode = 1
  }
}

function run(command, args, label) {
  const result = spawnSync(command, args, {
    cwd: root,
    env: process.env,
    stdio: 'inherit'
  })

  if (result.error) {
    console.error(`[auth-ssr-state] ${label} failed: ${result.error.message}`)
    process.exit(1)
  }

  if (result.status !== 0) {
    console.error(`[auth-ssr-state] ${label} failed.`)
    process.exit(result.status ?? 1)
  }
}

assert(
  useAuth.includes('type AuthServerState = {') &&
    useAuth.includes('authState?: AuthServerState') &&
    useAuth.includes('function useServerAuthState ()') &&
    useAuth.includes('context.authState ||= createServerAuthState()'),
  'useAuth must keep auth data in request-local server state during SSR.'
)

assert(
  !/const\s+user\s*=\s*useState<AuthUser \| null>\('auth-user'/.test(useAuth),
  'useAuth must not directly bind AuthUser to Nuxt useState, which is serialized into the payload.'
)

assert(
  useApi.includes('function syncAuthSession (session: AuthSession | null) {\n  if (import.meta.server) return'),
  'useApi syncAuthSession must not write auth-user Nuxt state on the server.'
)

assert(
  useAuth.includes('if (import.meta.server) return await loadSessionInternal()'),
  'useAuth must not share the module-level sessionLoadPromise across SSR requests.'
)

if (process.exitCode) process.exit(process.exitCode)

const nuxtTsconfig = join(root, '.nuxt/tsconfig.json')
if (!existsSync(nuxtTsconfig)) {
  run(process.execPath, [join(root, 'node_modules/@nuxt/cli/bin/nuxi.mjs'), 'prepare'], 'Nuxt prepare')
}

run(
  process.execPath,
  [join(root, 'node_modules/typescript/bin/tsc'), '-p', nuxtTsconfig, '--noEmit', '--pretty', 'false'],
  'TypeScript check'
)

console.log('[auth-ssr-state] OK')