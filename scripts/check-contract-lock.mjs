import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'

const root = new URL('../', import.meta.url)
const contractUrl = new URL('contracts/openapi.json', root)
const lockUrl = new URL('contracts/contract.lock.json', root)
const packageUrl = new URL('package.json', root)

const EXPECTED_REPOSITORY = 'https://github.com/Clearders/TestPaper-backend'
const EXPECTED_GENERATOR = 'openapi-typescript'
const EXPECTED_GENERATOR_VERSION = '7.13.0'
const EXPECTED_GENERATOR_CONFIG = { alphabetize: true }

function fail (message) {
  console.error(`Contract lock check failed: ${message}`)
  process.exitCode = 1
}

function isCommit (value) {
  return /^[0-9a-f]{40}$/.test(value)
}

const [contractBytes, lockText, packageText] = await Promise.all([
  readFile(contractUrl),
  readFile(lockUrl, 'utf8'),
  readFile(packageUrl, 'utf8')
])

let contract
let lock
let packageJson
try {
  contract = JSON.parse(contractBytes.toString('utf8'))
  lock = JSON.parse(lockText)
  packageJson = JSON.parse(packageText)
} catch (error) {
  fail(`invalid JSON (${error instanceof Error ? error.message : String(error)})`)
  process.exit()
}

const actualSha256 = createHash('sha256').update(contractBytes).digest('hex')
const packageGeneratorVersion = packageJson.devDependencies?.[EXPECTED_GENERATOR]

if (lock.apiVersion !== contract.info?.version) {
  fail(`apiVersion ${JSON.stringify(lock.apiVersion)} does not match OpenAPI info.version ${JSON.stringify(contract.info?.version)}.`)
}
if (lock.source?.repository !== EXPECTED_REPOSITORY) {
  fail(`source.repository must be ${EXPECTED_REPOSITORY}.`)
}
if (lock.source?.ref !== `api-v${lock.apiVersion}`) {
  fail(`source.ref must be api-v${lock.apiVersion}.`)
}
if (!isCommit(lock.source?.commit)) {
  fail('source.commit must be a lowercase 40-character Git commit SHA.')
}
if (lock.source?.sha256 !== actualSha256) {
  fail(`source.sha256 is stale: expected ${actualSha256}, received ${lock.source?.sha256 ?? 'missing'}.`)
}
if (lock.generator?.name !== EXPECTED_GENERATOR) {
  fail(`generator.name must be ${EXPECTED_GENERATOR}.`)
}
if (lock.generator?.version !== EXPECTED_GENERATOR_VERSION) {
  fail(`generator.version must be ${EXPECTED_GENERATOR_VERSION}.`)
}
if (packageGeneratorVersion !== EXPECTED_GENERATOR_VERSION) {
  fail(`package.json must pin ${EXPECTED_GENERATOR} exactly to ${EXPECTED_GENERATOR_VERSION}.`)
}
if (JSON.stringify(lock.generator?.config) !== JSON.stringify(EXPECTED_GENERATOR_CONFIG)) {
  fail(`generator.config must be ${JSON.stringify(EXPECTED_GENERATOR_CONFIG)}.`)
}

if (process.exitCode) process.exit()
console.log(`Contract lock verified (${actualSha256}).`)
