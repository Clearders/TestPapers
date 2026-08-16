import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'

const root = new URL('../', import.meta.url)
const schemaBytes = await readFile(new URL('contracts/sync-v1.schema.json', root))
const fixturesBytes = await readFile(new URL('contracts/sync-v1.fixtures.json', root))
const lock = JSON.parse(await readFile(new URL('contracts/sync-v1.lock.json', root), 'utf8'))
const schema = JSON.parse(schemaBytes)
const fixtures = JSON.parse(fixturesBytes)

const sha256 = value => createHash('sha256').update(value).digest('hex')
const canonicalJson = value => {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  if (value !== null && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`
  }
  return JSON.stringify(value)
}
const fail = message => {
  console.error(`Sync contract check failed: ${message}`)
  process.exitCode = 1
}

const schemaHash = sha256(schemaBytes)
const fixtureHash = sha256(fixturesBytes)
const fingerprint = sha256(`${schemaHash}:${fixtureHash}`)
if (lock.protocolVersion !== 1 || schema.protocolVersion !== 1 || fixtures.protocolVersion !== 1) fail('protocol version must be 1')
if (lock.schemaSha256 !== schemaHash) fail(`schema hash is stale: ${schemaHash}`)
if (lock.fixturesSha256 !== fixtureHash) fail(`fixture hash is stale: ${fixtureHash}`)
if (lock.semanticFingerprint !== fingerprint) fail(`semantic fingerprint is stale: ${fingerprint}`)

for (const testCase of fixtures.canonicalCases ?? []) {
  const canonical = canonicalJson(testCase.input)
  if (canonical !== testCase.canonical) fail(`${testCase.name} canonical JSON differs`)
  if (sha256(Buffer.from(canonical, 'utf8')) !== testCase.sha256) fail(`${testCase.name} SHA-256 differs`)
}
const schemaErrors = schema.$defs?.errorCode?.enum ?? []
const fixtureErrors = (fixtures.errorCases ?? []).map(item => item.code)
if (JSON.stringify(schemaErrors) !== JSON.stringify(fixtureErrors)) fail('stable error catalogue differs from fixtures')
if ((new Set(schema.$defs?.entityType?.enum ?? [])).size !== 7) fail('exactly seven synchronized entity types are required')
if (!fixtures.lifecycleCases?.some(item => item.name === 'stale-update-after-delete' && item.thirdStatus === 'conflict')) {
  fail('stale update after delete must remain a conflict')
}
const fixtureConflictReasons = new Set(fixtures.conflictCases?.map(item => item.reason).filter(Boolean) ?? [])
const schemaConflictReasons = new Set(schema.$defs?.conflictReason?.enum ?? [])
if (JSON.stringify([...fixtureConflictReasons].sort()) !== JSON.stringify([...schemaConflictReasons].sort())) {
  fail('conflict reason catalogue differs from fixtures')
}
if (!fixtures.conflictCases?.every(item => (item.origin ?? 'personalSync') === 'personalSync')) {
  fail('collaborative revisions must remain outside personal sync conflicts')
}
const resolutionActions = schema.$defs?.resolutionAction?.enum ?? []
if (JSON.stringify(fixtures.resolutionCases?.map(item => item.action)) !== JSON.stringify(resolutionActions)) {
  fail('resolution action catalogue differs from fixtures')
}
if (!fixtures.resolutionCases?.every(item => item.createsAcceptedVersion && item.appendOnly)) {
  fail('each resolution and undo must append an accepted version and audit record')
}

if (process.exitCode) process.exit()
console.log(`Sync v1 contract verified (${fingerprint}).`)
