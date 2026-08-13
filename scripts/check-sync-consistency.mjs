import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'

const root = new URL('../', import.meta.url)
const schemaBytes = await readFile(new URL('contracts/sync-consistency-v1.schema.json', root))
const fixtureBytes = await readFile(new URL('contracts/sync-consistency-v1.fixtures.json', root))
const schema = JSON.parse(schemaBytes)
const fixtures = JSON.parse(fixtureBytes)
const lock = JSON.parse(await readFile(new URL('contracts/sync-consistency-v1.lock.json', root), 'utf8'))
const sha256 = value => createHash('sha256').update(value).digest('hex')
const canonical = value => {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  if (value !== null && typeof value === 'object') return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`
  return JSON.stringify(value)
}

export function runSyncConsistencyScenario (scenario) {
  const entities = new Map()
  const conflicts = []
  const operationResults = []
  for (const operation of scenario.operations) {
    const key = `${operation.entityType}:${operation.entityId}`
    const entity = entities.get(key)
    if (!entity) {
      if (!['create', 'attach'].includes(operation.kind) || operation.baseVersion !== undefined) throw new Error(`invalid initial operation ${operation.operationId}`)
      entities.set(key, { entityType: operation.entityType, entityId: operation.entityId, version: 1, tombstone: false, payload: structuredClone(operation.payload ?? null) })
      operationResults.push({ operationId: operation.operationId, status: 'applied', acceptedVersion: 1 })
      continue
    }
    if (operation.baseVersion !== entity.version) {
      const reason = entity.tombstone ? 'tombstoneDivergence' : 'divergentContent'
      conflicts.push({ operationId: operation.operationId, device: operation.device, entityType: operation.entityType, entityId: operation.entityId, kind: operation.kind, baseVersion: operation.baseVersion, cloudVersion: entity.version, reason })
      operationResults.push({ operationId: operation.operationId, status: 'conflict', cloudVersion: entity.version, reason })
      continue
    }
    if (operation.kind === 'create') throw new Error(`duplicate create ${operation.operationId}`)
    entity.version += 1
    if (['delete', 'detach'].includes(operation.kind)) entity.tombstone = true
    else {
      entity.tombstone = false
      entity.payload = structuredClone(operation.payload ?? null)
    }
    operationResults.push({ operationId: operation.operationId, status: 'applied', acceptedVersion: entity.version })
  }
  return { entities: [...entities.values()].sort((left, right) => `${left.entityType}:${left.entityId}`.localeCompare(`${right.entityType}:${right.entityId}`)), conflicts, operationResults }
}

export function syncConsistencyFailure (scenario, actual) {
  return `sync consistency mismatch seed=${scenario.seed} operations=${canonical(scenario.operations)} diff=${canonical({ expected: scenario.expected, actual })}`
}

const schemaHash = sha256(schemaBytes)
const fixtureHash = sha256(fixtureBytes)
if (lock.schemaSha256 !== schemaHash || lock.fixturesSha256 !== fixtureHash || lock.semanticFingerprint !== sha256(`${schemaHash}:${fixtureHash}`)) throw new Error('Sync consistency lock is stale')
if (schema.properties.dslVersion.const !== fixtures.dslVersion || fixtures.dslVersion !== lock.dslVersion) throw new Error('Sync consistency DSL versions differ')
const scenarioIds = fixtures.scenarios.map(scenario => scenario.id)
const operations = fixtures.scenarios.flatMap(scenario => scenario.operations)
if (new Set(scenarioIds).size !== scenarioIds.length || new Set(operations.map(operation => operation.operationId)).size !== operations.length) throw new Error('Scenario and operation IDs must be unique')
if (canonical([...new Set(operations.map(operation => operation.kind))].sort()) !== canonical(['attach', 'create', 'delete', 'detach', 'restore', 'update'])) throw new Error('Lifecycle and attachment coverage is incomplete')

for (const scenario of fixtures.scenarios) {
  if (!scenario.operations.every(operation => scenario.devices.includes(operation.device))) throw new Error(`Unknown device in ${scenario.id}`)
  const actual = runSyncConsistencyScenario(scenario)
  if (canonical(actual) !== canonical(scenario.expected)) throw new Error(syncConsistencyFailure(scenario, actual))
}

const diagnosticScenario = fixtures.scenarios[0]
const wrong = runSyncConsistencyScenario(diagnosticScenario)
wrong.entities[0].version = 999
const diagnostic = syncConsistencyFailure(diagnosticScenario, wrong)
if (!diagnostic.includes(`seed=${diagnosticScenario.seed}`) || !diagnostic.includes('operations=') || !diagnostic.includes('"expected"') || !diagnostic.includes('"actual"')) throw new Error('Failure diagnostics are not reproducible')

console.log(`Sync consistency scenarios verified (${lock.semanticFingerprint}; ${fixtures.scenarios.length} scenarios).`)
