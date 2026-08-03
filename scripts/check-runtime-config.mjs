import { RuntimeConfigError, resolveRuntimeConfig } from './runtime-config.mjs'

let failed = false

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    console.error(`[runtime-config] ${label}: expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`)
    failed = true
  }
}

function expectValid(label, env, expected) {
  try {
    const actual = resolveRuntimeConfig(env)
    for (const [key, value] of Object.entries(expected)) assertEqual(actual[key], value, `${label} (${key})`)
  } catch (error) {
    console.error(`[runtime-config] ${label}: unexpectedly rejected: ${error.message}`)
    failed = true
  }
}

function expectInvalid(label, env, message) {
  try {
    resolveRuntimeConfig(env)
    console.error(`[runtime-config] ${label}: unexpectedly accepted`)
    failed = true
  } catch (error) {
    if (!(error instanceof RuntimeConfigError) || !error.message.includes(message)) {
      console.error(`[runtime-config] ${label}: expected ${JSON.stringify(message)}, received ${error.message}`)
      failed = true
    }
  }
}

expectValid('local defaults', {}, {
  profile: 'local',
  serverApiBase: 'http://127.0.0.1:8000/api/v1',
  publicApiBase: '/api/v1'
})
expectValid('development defaults', { TESTPAPERS_ENV: 'development' }, { profile: 'development' })
expectValid('production same-origin proxy', {
  TESTPAPERS_ENV: 'production',
  NUXT_API_BASE: 'http://backend.internal:8000/api/v1/',
  NUXT_PUBLIC_API_BASE: '/api/v1/'
}, { profile: 'production', serverApiBase: 'http://backend.internal:8000/api/v1', publicApiBase: '/api/v1' })
expectValid('staging public endpoints', {
  TESTPAPERS_ENV: 'staging',
  NUXT_API_BASE: 'https://api.internal.example/api/v1',
  NUXT_PUBLIC_API_BASE: 'https://api.staging.example/api/v1',
  NUXT_PUBLIC_DIRECT_API_BASE: 'https://files.staging.example/api/v1',
  NUXT_PUBLIC_WS_BASE: 'wss://api.staging.example/api/v1/ws'
}, { profile: 'staging' })
expectValid('legacy fallback', { TESTPAPERS_ENV: 'test', NUXT_SERVER_API_BASE: 'http://test-api.internal/api/v1', NUXT_PUBLIC_API_BASE: '/api/v1' }, { serverApiBase: 'http://test-api.internal/api/v1' })
expectValid('test websocket endpoint', {
  TESTPAPERS_ENV: 'test',
  NUXT_API_BASE: 'http://127.0.0.1:8001/api/v1',
  NUXT_PUBLIC_API_BASE: '/api/v1',
  NUXT_PUBLIC_WS_BASE: 'ws://127.0.0.1:8001/api/v1/ws'
}, { profile: 'test', wsBase: 'ws://127.0.0.1:8001/api/v1/ws' })

expectInvalid('unknown profile', { TESTPAPERS_ENV: 'demo' }, 'TESTPAPERS_ENV must be one of')
expectInvalid('test requires explicit endpoints', { TESTPAPERS_ENV: 'test' }, 'NUXT_API_BASE is required')
expectInvalid('production requires endpoints', { TESTPAPERS_ENV: 'production' }, 'NUXT_PUBLIC_API_BASE is required')
expectInvalid('conflicting legacy endpoint', { NUXT_API_BASE: 'http://one/api/v1', NUXT_SERVER_API_BASE: 'http://two/api/v1' }, 'conflicts')
expectInvalid('public credentials', { NUXT_PUBLIC_API_BASE: 'https://name:secret@api.example/api/v1' }, 'must not include URL credentials')
expectInvalid('protocol-relative public endpoint', { NUXT_PUBLIC_API_BASE: '//attacker.example/api/v1' }, 'must be a same-origin path')
expectInvalid('query-bearing public path', { NUXT_PUBLIC_API_BASE: '/api/v1?tenant=other' }, 'must be a same-origin path')
expectInvalid('fragment-bearing public path', { NUXT_PUBLIC_API_BASE: '/api/v1#other' }, 'must be a same-origin path')
expectInvalid('insecure public direct endpoint', { NUXT_PUBLIC_DIRECT_API_BASE: 'http://api.example/api/v1' }, 'must use https:')
expectInvalid('insecure websocket endpoint', { NUXT_PUBLIC_WS_BASE: 'ws://api.example/api/v1/ws' }, 'must use wss:')

if (failed) process.exit(1)
console.log('[runtime-config] OK')
