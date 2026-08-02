import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'

const contractUrl = new URL('../docs/data-model/domain-model.json', import.meta.url)
const failures = []

function check (condition, message) {
  if (!condition) failures.push(message)
}

function isNonEmptyString (value) {
  return typeof value === 'string' && value.trim().length > 0
}

function canonicalJson (value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value)
      .filter(([key]) => key !== 'description')
      .sort(([left], [right]) => left.localeCompare(right))
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`).join(',')}}`
  }
  return JSON.stringify(value)
}

function checkExactKeys (actual, expected, context) {
  const actualKeys = Object.keys(actual ?? {}).sort()
  const expectedKeys = [...expected].sort()
  check(
    JSON.stringify(actualKeys) === JSON.stringify(expectedKeys),
    `${context} must contain exactly: ${expectedKeys.join(', ')} (found: ${actualKeys.join(', ')})`
  )
}

function checkUniqueNames (items, context) {
  const names = items.map(item => item?.name)
  const duplicates = names.filter((name, index) => names.indexOf(name) !== index)
  check(duplicates.length === 0, `${context} contains duplicate names: ${[...new Set(duplicates)].join(', ')}`)
  for (const name of names) check(isNonEmptyString(name), `${context} contains an item without a name`)
}

function isCanonicalDecimal (value) {
  return typeof value === 'string' && /^(?:0|-[1-9]\d*|[1-9]\d*)(?:\.\d*[1-9])?$/.test(value)
}

function checkDecimalSpec (field, context) {
  const spec = field.numeric
  check(spec && typeof spec === 'object', `${context}.${field.name}.numeric is required for decimal fields`)
  check(Number.isInteger(spec?.precision) && spec.precision > 0, `${context}.${field.name}.numeric.precision must be a positive integer`)
  check(Number.isInteger(spec?.scale) && spec.scale >= 0 && spec.scale <= spec.precision, `${context}.${field.name}.numeric.scale must be between 0 and precision`)
  check(isCanonicalDecimal(spec?.minimum), `${context}.${field.name}.numeric.minimum must be a canonical decimal string`)
  check(isCanonicalDecimal(spec?.maximum), `${context}.${field.name}.numeric.maximum must be a canonical decimal string`)
  for (const [boundName, bound] of [['minimum', spec?.minimum], ['maximum', spec?.maximum]]) {
    if (!isCanonicalDecimal(bound)) continue
    const unsigned = bound.replace('-', '')
    const [integerPart, fractionalPart = ''] = unsigned.split('.')
    check(integerPart.length <= spec.precision - spec.scale, `${context}.${field.name}.numeric.${boundName} exceeds integer precision`)
    check(fractionalPart.length <= spec.scale, `${context}.${field.name}.numeric.${boundName} exceeds scale`)
  }
  if (isCanonicalDecimal(spec?.minimum) && isCanonicalDecimal(spec?.maximum)) {
    check(Number(spec.minimum) <= Number(spec.maximum), `${context}.${field.name}.numeric minimum must not exceed maximum`)
  }
  if (Object.hasOwn(field, 'default') && field.default !== null) {
    check(isCanonicalDecimal(field.default), `${context}.${field.name}.default must be a canonical decimal string`)
    if (isCanonicalDecimal(field.default) && isCanonicalDecimal(spec?.minimum) && isCanonicalDecimal(spec?.maximum)) {
      check(Number(field.default) >= Number(spec.minimum) && Number(field.default) <= Number(spec.maximum), `${context}.${field.name}.default must be within numeric bounds`)
    }
  }
}

function checkField (field, context, model) {
  const allowedSyncClasses = new Set(['domain', 'sync_metadata', 'local_only', 'cloud_only', 'derived'])

  check(isNonEmptyString(field.name), `${context} must have a name`)
  check(Boolean(model.logicalTypes[field.type]), `${context}.${field.name} uses unknown logical type: ${field.type}`)
  check(Boolean(model.authorityClasses[field.authority]), `${context}.${field.name} uses unknown authority class: ${field.authority}`)
  check(typeof field.required === 'boolean', `${context}.${field.name}.required must be boolean`)
  check(allowedSyncClasses.has(field.syncClass), `${context}.${field.name} uses unknown syncClass: ${field.syncClass}`)
  check(field.hash === 'include' || field.hash === 'exclude', `${context}.${field.name}.hash must be include or exclude`)
  if (field.required === false) check(Object.hasOwn(field, 'default'), `${context}.${field.name} is optional and must declare a default`)
  if (field.type === 'decimal') checkDecimalSpec(field, context)
  if (field.type === 'enum') {
    check(Array.isArray(field.constraints) && field.constraints.length > 0, `${context}.${field.name} enum constraints must not be empty`)
    check(new Set(field.constraints ?? []).size === (field.constraints ?? []).length, `${context}.${field.name} enum constraints must be unique`)
    if (Object.hasOwn(field, 'default') && field.default !== null) {
      check(field.constraints?.includes(field.default), `${context}.${field.name}.default must be an allowed enum value`)
    }
  }
  if (field.type === 'short_text') {
    check(Array.isArray(field.constraints) && field.constraints.length > 0, `${context}.${field.name} short_text constraints must not be empty`)
  }

  if (field.syncClass === 'domain' || field.syncClass === 'sync_metadata') {
    check(isNonEmptyString(field.postgresql), `${context}.${field.name} must have a PostgreSQL projection`)
    check(isNonEmptyString(field.sqlite), `${context}.${field.name} must have a SQLite projection`)
  }
  if (field.syncClass === 'local_only') {
    check(field.postgresql === null, `${context}.${field.name} local_only PostgreSQL projection must be null`)
    check(isNonEmptyString(field.sqlite), `${context}.${field.name} local_only field must have a SQLite projection`)
  }
  if (field.syncClass === 'cloud_only') {
    check(isNonEmptyString(field.postgresql), `${context}.${field.name} cloud_only field must have a PostgreSQL projection`)
    check(field.sqlite === null, `${context}.${field.name} cloud_only SQLite projection must be null`)
  }
  if (field.syncClass === 'derived') {
    check(field.postgresql === null && field.sqlite === null, `${context}.${field.name} derived projections must both be null`)
  }
  if (field.hash === 'include') {
    check(field.syncClass === 'domain', `${context}.${field.name} can enter contentHash only when syncClass=domain`)
    check(field.authority === 'domain_content' || field.authority === 'identity', `${context}.${field.name} hash input must be domain content or identity`)
  }
}

let model
try {
  model = JSON.parse(await readFile(contractUrl, 'utf8'))
} catch (error) {
  console.error(`Unable to parse ${fileURLToPath(contractUrl)}: ${error.message}`)
  process.exit(1)
}

check(model.contract?.name === 'TestPapers local/cloud domain model', 'contract.name is unexpected')
check(/^\d+\.\d+\.\d+$/.test(model.contract?.version ?? ''), 'contract.version must be semantic version text')
check(model.contract?.status === 'accepted', 'contract.status must be accepted')
check(model.contract?.linearIssue === 'CLE-15', 'contract.linearIssue must be CLE-15')
check(model.identifierPolicy?.newIdentifiers?.includes('UUIDv7'), 'identifierPolicy must use UUIDv7 for new records')
check(model.identifierPolicy?.legacyIdentifiers?.includes('UUIDv4'), 'identifierPolicy must preserve existing UUIDv4 records')
check(model.identifierPolicy?.publicReferences?.includes('surrogate keys never do'), 'identifierPolicy must forbid surrogate keys at boundaries')

const requiredScopes = ['cloud_synced', 'collaborative_shared', 'local_private']
checkExactKeys(model.replicationScopes, requiredScopes, 'replicationScopes')
for (const scope of requiredScopes) {
  const rule = model.replicationScopes[scope]
  check(isNonEmptyString(rule?.meaning), `replicationScopes.${scope}.meaning is required`)
  check(isNonEmptyString(rule?.localAuthority), `replicationScopes.${scope}.localAuthority is required`)
  check(isNonEmptyString(rule?.localProjection), `replicationScopes.${scope}.localProjection is required`)
  check(isNonEmptyString(rule?.cloudProjection), `replicationScopes.${scope}.cloudProjection is required`)
}
check(
  JSON.stringify(model.scopeTransitions?.allowed) === JSON.stringify([
    'local_private->cloud_synced',
    'local_private->collaborative_shared',
    'cloud_synced->collaborative_shared',
    'collaborative_shared->cloud_synced'
  ]),
  'scopeTransitions.allowed is unexpected'
)
check(
  JSON.stringify(model.scopeTransitions?.forbidden) === JSON.stringify([
    'cloud_synced->local_private',
    'collaborative_shared->local_private'
  ]),
  'scopeTransitions.forbidden is unexpected'
)
check(isNonEmptyString(model.scopeTransitions?.rule), 'scopeTransitions.rule is required')

const requiredAuthorities = ['attribution', 'domain_content', 'identity', 'lifecycle', 'locator', 'ownership', 'scope_transition']
checkExactKeys(model.authorityClasses, requiredAuthorities, 'authorityClasses')
for (const authority of requiredAuthorities) {
  check(isNonEmptyString(model.authorityClasses[authority]?.rule), `authorityClasses.${authority}.rule is required`)
  for (const scope of requiredScopes) {
    check(isNonEmptyString(model.authorityClasses[authority]?.[scope]), `authorityClasses.${authority}.${scope} is required`)
  }
}

const requiredLogicalTypes = ['boolean', 'decimal', 'enum', 'instant', 'json', 'nonnegative_i32', 'nonnegative_i64', 'positive_i32', 'sha256', 'short_text', 'stable_id', 'text', 'version_counter']
checkExactKeys(model.logicalTypes, requiredLogicalTypes, 'logicalTypes')
for (const [type, mapping] of Object.entries(model.logicalTypes ?? {})) {
  check(isNonEmptyString(mapping.postgresql), `logicalTypes.${type}.postgresql is required`)
  check(isNonEmptyString(mapping.sqlite), `logicalTypes.${type}.sqlite is required`)
}
check(model.logicalTypes.version_counter?.minimum === '1', 'version_counter minimum must be 1')
check(model.logicalTypes.version_counter?.maximum === '9223372036854775807', 'version_counter maximum must fit signed 64-bit stores')
check(model.logicalTypes.nonnegative_i64?.minimum === '0', 'nonnegative_i64 minimum must be 0')
check(model.logicalTypes.nonnegative_i64?.maximum === '9223372036854775807', 'nonnegative_i64 maximum must fit signed 64-bit stores')
check(model.logicalTypes.nonnegative_i32?.minimum === 0, 'nonnegative_i32 minimum must be 0')
check(model.logicalTypes.nonnegative_i32?.maximum === 2147483647, 'nonnegative_i32 maximum must fit PostgreSQL integer')
check(model.logicalTypes.positive_i32?.minimum === 1, 'positive_i32 minimum must be 1')
check(model.logicalTypes.positive_i32?.maximum === 2147483647, 'positive_i32 maximum must fit PostgreSQL integer')
check(isNonEmptyString(model.logicalTypes.decimal?.wireFormat), 'decimal wireFormat is required')

const envelope = model.syncEnvelope ?? []
const requiredEnvelopeFields = ['contentHash', 'createdAt', 'deletedAt', 'deletedById', 'id', 'ownerId', 'replicationScope', 'schemaVersion', 'updatedAt', 'version']
checkUniqueNames(envelope, 'syncEnvelope')
checkExactKeys(Object.fromEntries(envelope.map(field => [field.name, true])), requiredEnvelopeFields, 'syncEnvelope fields')
for (const field of envelope) checkField(field, 'syncEnvelope', model)

const envelopeByName = new Map(envelope.map(field => [field.name, field]))
check(envelopeByName.get('id')?.type === 'stable_id' && envelopeByName.get('id')?.required, 'syncEnvelope.id must be a required stable_id')
check(envelopeByName.get('id')?.authority === 'identity', 'syncEnvelope.id authority must be identity')
check(envelopeByName.get('ownerId')?.type === 'stable_id' && envelopeByName.get('ownerId')?.required, 'syncEnvelope.ownerId must be a required stable_id')
check(envelopeByName.get('ownerId')?.authority === 'ownership', 'syncEnvelope.ownerId authority must be ownership')
check(envelopeByName.get('replicationScope')?.authority === 'scope_transition', 'syncEnvelope.replicationScope authority must be scope_transition')
check(envelopeByName.get('schemaVersion')?.type === 'positive_i32', 'syncEnvelope.schemaVersion must be positive_i32')
check(envelopeByName.get('version')?.type === 'version_counter', 'syncEnvelope.version must be a positive signed-64-bit version_counter')
check(envelopeByName.get('contentHash')?.type === 'sha256', 'syncEnvelope.contentHash must be sha256')
check(envelopeByName.get('deletedAt')?.required === false, 'syncEnvelope.deletedAt must be nullable')
check(envelopeByName.get('schemaVersion')?.default === 1, 'syncEnvelope.schemaVersion default must be 1')
check(envelopeByName.get('version')?.default === 1, 'syncEnvelope.version default must be 1')
check(envelopeByName.get('deletedAt')?.default === null, 'syncEnvelope.deletedAt default must be null')
check(envelopeByName.get('deletedById')?.default === null, 'syncEnvelope.deletedById default must be null')

const requiredEntities = ['attachment', 'comment', 'draft', 'favorite', 'paper', 'question', 'setting']
const entities = model.entities ?? []
checkUniqueNames(entities, 'entities')
checkExactKeys(Object.fromEntries(entities.map(entity => [entity.name, true])), requiredEntities, 'entities')

const expectedEntityShapes = {
  question: {
    owner: 'user_or_system',
    scopes: ['local_private', 'cloud_synced', 'collaborative_shared'],
    fields: {
      type: ['enum', true], subjects: ['json', true], difficulty: ['enum', true], tags: ['json', true],
      text: ['text', true], options: ['json', false], answer: ['json', true], hasLatex: ['boolean', true],
      source: ['text', false], essayBlankSpace: ['json', false], scoreWeight: ['decimal', true]
    },
    unique: []
  },
  paper: {
    owner: 'user_or_system',
    scopes: ['local_private', 'cloud_synced', 'collaborative_shared'],
    fields: {
      title: ['short_text', true], subject: ['short_text', true], durationMinutes: ['positive_i32', true],
      totalMarks: ['decimal', true], status: ['enum', true], items: ['json', true]
    },
    unique: []
  },
  draft: {
    owner: 'user_or_system',
    scopes: ['local_private', 'cloud_synced', 'collaborative_shared'],
    fields: {
      name: ['short_text', true], paperId: ['stable_id', false], state: ['json', true],
      reviewStatus: ['enum', true], updatedById: ['stable_id', false]
    },
    unique: []
  },
  attachment: {
    owner: 'user_or_system',
    scopes: ['local_private', 'cloud_synced', 'collaborative_shared'],
    fields: {
      targetType: ['enum', true], targetId: ['stable_id', true], fileName: ['short_text', true],
      mediaType: ['short_text', true], byteSize: ['nonnegative_i64', true], blobHash: ['sha256', true],
      caption: ['text', false], position: ['nonnegative_i32', true], uploadedById: ['stable_id', false],
      cloudObjectKey: ['text', false], localRelativePath: ['text', false]
    },
    unique: ['targetType', 'targetId', 'position']
  },
  comment: {
    owner: 'author_user',
    scopes: ['cloud_synced', 'collaborative_shared'],
    fields: {
      targetType: ['enum', true], targetId: ['stable_id', true], parentCommentId: ['stable_id', false],
      anchor: ['json', false], body: ['text', true], status: ['enum', true], resolvedAt: ['instant', false],
      resolvedById: ['stable_id', false]
    },
    unique: []
  },
  favorite: {
    owner: 'user',
    scopes: ['cloud_synced'],
    fields: { targetType: ['enum', true], targetId: ['stable_id', true] },
    unique: ['ownerId', 'targetType', 'targetId']
  },
  setting: {
    owner: 'user_or_local_profile',
    scopes: ['local_private', 'cloud_synced'],
    fields: { settingScope: ['enum', true], key: ['short_text', true], value: ['json', true] },
    unique: ['ownerId', 'settingScope', 'key']
  }
}

for (const entity of entities) {
  const context = `entities.${entity.name}`
  const expectedShape = expectedEntityShapes[entity.name]
  if (!expectedShape) {
    check(false, `${context} is not a supported entity`)
    continue
  }
  check(entity.usesSyncEnvelope === true, `${context} must use the sync envelope`)
  check(isNonEmptyString(entity.description), `${context}.description is required`)
  check(entity.ownerRule?.field === 'ownerId', `${context} must have exactly one owner through ownerId`)
  check(isNonEmptyString(entity.ownerRule?.principal), `${context}.ownerRule.principal is required`)
  check(entity.ownerRule?.principal === expectedShape.owner, `${context}.ownerRule.principal must be ${expectedShape.owner}`)
  check(isNonEmptyString(entity.ownerRule?.transfer), `${context}.ownerRule.transfer is required`)
  check(isNonEmptyString(entity.historyPolicy), `${context}.historyPolicy is required`)
  check(isNonEmptyString(entity.conflictPolicy), `${context}.conflictPolicy is required`)

  const scopes = entity.scopes ?? []
  check(scopes.length > 0, `${context}.scopes must not be empty`)
  check(new Set(scopes).size === scopes.length, `${context}.scopes must be unique`)
  check(
    JSON.stringify([...scopes].sort()) === JSON.stringify([...expectedShape.scopes].sort()),
    `${context}.scopes must be exactly: ${expectedShape.scopes.join(', ')}`
  )
  for (const scope of scopes) check(Boolean(model.replicationScopes[scope]), `${context} uses unknown scope: ${scope}`)
  checkExactKeys(entity.replicationRules, scopes, `${context}.replicationRules`)
  for (const scope of scopes) {
    check(isNonEmptyString(entity.replicationRules?.[scope]), `${context}.replicationRules.${scope} is required`)
  }

  const fields = entity.fields ?? []
  check(fields.length > 0, `${context}.fields must not be empty`)
  checkUniqueNames(fields, `${context}.fields`)
  checkExactKeys(Object.fromEntries(fields.map(field => [field.name, true])), Object.keys(expectedShape.fields), `${context}.fields`)
  for (const field of fields) checkField(field, context, model)
  for (const field of fields) {
    const [expectedType, expectedRequired] = expectedShape.fields[field.name]
    check(field.type === expectedType, `${context}.${field.name}.type must be ${expectedType}`)
    check(field.required === expectedRequired, `${context}.${field.name}.required must be ${expectedRequired}`)
  }
  check(fields.some(field => field.hash === 'include'), `${context} needs at least one contentHash input`)

  const effectiveNames = [...requiredEnvelopeFields, ...fields.map(field => field.name)]
  check(new Set(effectiveNames).size === effectiveNames.length, `${context} shadows a sync envelope field`)

  for (const uniqueField of entity.unique ?? []) {
    check(effectiveNames.includes(uniqueField), `${context}.unique refers to unknown field: ${uniqueField}`)
  }
  check(
    JSON.stringify(entity.unique ?? []) === JSON.stringify(expectedShape.unique),
    `${context}.unique must be exactly: ${expectedShape.unique.join(', ') || '(none)'}`
  )
  if (entity.scopeConstraints) {
    checkExactKeys(entity.scopeConstraints, scopes, `${context}.scopeConstraints`)
    for (const scope of scopes) {
      check(Array.isArray(entity.scopeConstraints[scope]) && entity.scopeConstraints[scope].length > 0, `${context}.scopeConstraints.${scope} must not be empty`)
    }
  }
}

function getEntityField (entityName, fieldName) {
  return entities.find(entity => entity.name === entityName)?.fields?.find(field => field.name === fieldName)
}

const expectedEnums = {
  'question.type': ['single_choice', 'multiple_choice', 'true_false', 'blank', 'short_answer', 'essay'],
  'question.difficulty': ['easy', 'medium', 'hard'],
  'paper.status': ['draft', 'published', 'archived'],
  'draft.reviewStatus': ['draft', 'in_review', 'approved', 'changes_requested'],
  'attachment.targetType': ['question', 'paper', 'draft', 'comment'],
  'comment.targetType': ['question', 'paper', 'draft'],
  'comment.status': ['open', 'resolved'],
  'favorite.targetType': ['question', 'paper'],
  'setting.settingScope': ['device', 'account']
}
for (const [path, expectedValues] of Object.entries(expectedEnums)) {
  const [entityName, fieldName] = path.split('.')
  const actualValues = getEntityField(entityName, fieldName)?.constraints
  check(JSON.stringify(actualValues) === JSON.stringify(expectedValues), `${path} enum values must be exactly: ${expectedValues.join(', ')}`)
}

const expectedDefaults = {
  'question.tags': [],
  'question.options': null,
  'question.hasLatex': false,
  'question.source': null,
  'question.essayBlankSpace': null,
  'question.scoreWeight': '1',
  'paper.status': 'draft',
  'paper.items': [],
  'draft.paperId': null,
  'draft.reviewStatus': 'draft',
  'draft.updatedById': null,
  'attachment.caption': null,
  'attachment.position': 0,
  'attachment.uploadedById': null,
  'attachment.cloudObjectKey': null,
  'attachment.localRelativePath': null,
  'comment.parentCommentId': null,
  'comment.anchor': null,
  'comment.status': 'open',
  'comment.resolvedAt': null,
  'comment.resolvedById': null
}
for (const [path, expectedDefault] of Object.entries(expectedDefaults)) {
  const [entityName, fieldName] = path.split('.')
  const field = getEntityField(entityName, fieldName)
  check(Object.hasOwn(field ?? {}, 'default'), `${path} must declare a default`)
  check(JSON.stringify(field?.default) === JSON.stringify(expectedDefault), `${path} default is unexpected`)
}
check(getEntityField('paper', 'items')?.constraints?.some(value => value.includes('questionSnapshot is required')), 'paper.items must require an authoritative questionSnapshot')
const settingEntity = entities.find(entity => entity.name === 'setting')
check(
  JSON.stringify(settingEntity?.scopeConstraints) === JSON.stringify({ local_private: ['settingScope=device'], cloud_synced: ['settingScope=account'] }),
  'setting.scopeConstraints must bind device settings to local_private and account settings to cloud_synced'
)

const paperItemFields = model.valueObjects?.paperItem?.fields ?? []
checkUniqueNames(paperItemFields, 'valueObjects.paperItem.fields')
check(paperItemFields.some(field => field.name === 'id' && field.type === 'stable_id' && field.required), 'paperItem must have a required stable id')
const expectedValueObjects = {
  paperItem: { id: ['stable_id', true], questionId: ['stable_id', false], order: ['nonnegative_i32', true], marks: ['decimal', false], questionSnapshot: ['json', true] },
  commentAnchor: { entityId: ['stable_id', false], paperItemId: ['stable_id', false], field: ['short_text', false] }
}
checkExactKeys(model.valueObjects, Object.keys(expectedValueObjects), 'valueObjects')
for (const [valueObjectName, valueObject] of Object.entries(model.valueObjects ?? {})) {
  const expectedFields = expectedValueObjects[valueObjectName]
  if (!expectedFields) {
    check(false, `valueObjects.${valueObjectName} is not supported`)
    continue
  }
  check(isNonEmptyString(valueObject.description), 'Every value object needs a description')
  checkUniqueNames(valueObject.fields ?? [], `valueObjects.${valueObjectName}.fields`)
  checkExactKeys(
    Object.fromEntries((valueObject.fields ?? []).map(field => [field.name, true])),
    Object.keys(expectedFields),
    `valueObjects.${valueObjectName}.fields`
  )
  for (const field of valueObject.fields ?? []) {
    check(Boolean(model.logicalTypes[field.type]), `Value object field ${field.name} uses unknown type: ${field.type}`)
    check(typeof field.required === 'boolean', `Value object field ${field.name}.required must be boolean`)
    const [expectedType, expectedRequired] = expectedFields[field.name]
    check(field.type === expectedType, `valueObjects.${valueObjectName}.${field.name}.type must be ${expectedType}`)
    check(field.required === expectedRequired, `valueObjects.${valueObjectName}.${field.name}.required must be ${expectedRequired}`)
    if (field.type === 'decimal') checkDecimalSpec(field, `valueObjects.${valueObjectName}`)
  }
}

const requiredRelationships = {
  paper_item_question: ['paper.items[].questionId', 'question.id', 'optional_provenance_snapshot_required', 'same_or_authorized_read_at_snapshot', 'readable_at_snapshot', 'retain_source', 'no_source_mutation', 'no_source_mutation', 'no_source_mutation'],
  draft_paper: ['draft.paperId', 'paper.id', 'optional_provenance_snapshot_required', 'same_or_authorized_read_at_snapshot', 'readable_at_snapshot', 'retain_source', 'no_source_mutation', 'no_source_mutation', 'no_source_mutation'],
  attachment_target: ['attachment.(targetType,targetId)', 'question|paper|draft|comment.id', 'required_live_target', 'same_owner', 'same_scope', 'cascade_tombstone', 'explicit_only', 'cascade_to_source', 'cascade_to_source'],
  comment_target: ['comment.(targetType,targetId)', 'question|paper|draft.id', 'required_live_target', 'authorized_actor', 'not_broader_than_target_access', 'cascade_tombstone', 'explicit_only', 'revalidate_access', 'cascade_thread_scope'],
  comment_parent: ['comment.parentCommentId', 'comment.id', 'optional_live_parent', 'independent_authors', 'same_target_and_scope', 'cascade_tombstone', 'explicit_only', 'forbidden', 'cascade_thread_scope'],
  favorite_target: ['favorite.(targetType,targetId)', 'question|paper.id', 'required_live_target', 'authorized_actor', 'target_cloud_or_shared', 'cascade_tombstone', 'explicit_only', 'revalidate_access', 'no_source_mutation']
}
const relationships = model.relationships ?? []
checkUniqueNames(relationships, 'relationships')
checkExactKeys(Object.fromEntries(relationships.map(relationship => [relationship.name, true])), Object.keys(requiredRelationships), 'relationships')
const relationshipRuleFields = [
  'existence', 'ownerCompatibility', 'scopeCompatibility', 'onTargetTombstone', 'onTargetRestore',
  'postgresqlEnforcement', 'sqliteEnforcement', 'onTargetOwnerTransfer', 'onTargetScopeChange'
]
for (const relationship of relationships) {
  const context = `relationships.${relationship.name}`
  const [source, target, existenceMode, ownerMode, scopeMode, tombstoneAction, restoreAction, ownerTransferAction, scopeChangeAction] = requiredRelationships[relationship.name] ?? []
  check(relationship.source === source, `${context}.source must be ${source}`)
  check(relationship.target === target, `${context}.target must be ${target}`)
  check(relationship.existenceMode === existenceMode, `${context}.existenceMode must be ${existenceMode}`)
  check(relationship.ownerCompatibilityMode === ownerMode, `${context}.ownerCompatibilityMode must be ${ownerMode}`)
  check(relationship.scopeCompatibilityMode === scopeMode, `${context}.scopeCompatibilityMode must be ${scopeMode}`)
  check(relationship.tombstoneAction === tombstoneAction, `${context}.tombstoneAction must be ${tombstoneAction}`)
  check(relationship.restoreAction === restoreAction, `${context}.restoreAction must be ${restoreAction}`)
  check(relationship.ownerTransferAction === ownerTransferAction, `${context}.ownerTransferAction must be ${ownerTransferAction}`)
  check(relationship.scopeChangeAction === scopeChangeAction, `${context}.scopeChangeAction must be ${scopeChangeAction}`)
  for (const field of relationshipRuleFields) check(isNonEmptyString(relationship[field]), `${context}.${field} is required`)
}

const requiredLifecycleRules = ['conflictBoundary', 'delete', 'history', 'protocolDeferral', 'purge', 'restore', 'update']
checkExactKeys(model.lifecycleInvariants, requiredLifecycleRules, 'lifecycleInvariants')
for (const [name, rule] of Object.entries(model.lifecycleInvariants ?? {})) {
  check(isNonEmptyString(rule), `lifecycleInvariants.${name} is required`)
}

const requiredBoundaries = ['cloudMigrations', 'localMigrations', 'sharedLibraryAcl', 'syncProtocol']
checkExactKeys(model.implementationBoundaries, requiredBoundaries, 'implementationBoundaries')
check(model.implementationBoundaries?.localMigrations?.includes('CLE-25'), 'localMigrations must defer Desktop implementation to CLE-25')
check(model.implementationBoundaries?.syncProtocol?.includes('CLE-29'), 'syncProtocol must defer wire behavior to CLE-29')
check(model.implementationBoundaries?.sharedLibraryAcl?.includes('CLE-19'), 'sharedLibraryAcl must defer publication ACLs to CLE-19')

check(model.hashPolicy?.algorithm === 'SHA-256', 'hashPolicy.algorithm must be SHA-256')
check(isNonEmptyString(model.hashPolicy?.canonicalization), 'hashPolicy.canonicalization is required')
check(isNonEmptyString(model.hashPolicy?.payload), 'hashPolicy.payload is required')
check(Array.isArray(model.hashPolicy?.excluded) && model.hashPolicy.excluded.length > 0, 'hashPolicy.excluded must not be empty')

const semanticFingerprint = createHash('sha256').update(canonicalJson(model)).digest('hex')
const expectedSemanticFingerprint = 'aeb6934e9a4ab0f5e6fc1a0c48aaab3445ddde331b5becd494f33bc03d9fe1a1'
check(
  semanticFingerprint === expectedSemanticFingerprint,
  `Contract semantics changed; review and update the expected fingerprint (${semanticFingerprint})`
)

try {
  const adrUrl = new URL(model.contract.adr, contractUrl)
  const adr = await readFile(adrUrl, 'utf8')
  for (const heading of ['## Logical ERD', '## Ownership and replication matrix', '## Lifecycle and history semantics', '## Conflict semantics', '## PostgreSQL/SQLite parity']) {
    check(adr.includes(heading), `ADR is missing required section: ${heading}`)
  }
  for (const entity of requiredEntities) {
    check(adr.toLowerCase().includes(entity), `ADR does not mention required entity: ${entity}`)
  }
} catch (error) {
  failures.push(`Unable to read contract ADR: ${error.message}`)
}

if (failures.length > 0) {
  console.error(`Data-model contract validation failed with ${failures.length} error(s):`)
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

const domainFieldCount = entities.reduce((count, entity) => count + entity.fields.length, 0)
console.log(
  `Data-model contract OK: ${entities.length} entities, ${envelope.length} envelope fields, ` +
  `${domainFieldCount} entity fields, ${requiredScopes.length} replication scopes.`
)
