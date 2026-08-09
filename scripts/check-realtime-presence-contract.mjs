import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const realtimeSource = readFileSync(join(root, 'app/composables/useRealtime.ts'), 'utf8')
const presenceSource = readFileSync(join(root, 'app/composables/useDraftPresence.ts'), 'utf8')

assert.match(realtimeSource, /const MAX_SEEN_EVENT_IDS = 500/, 'realtime event deduplication should retain a bounded cache')
assert.match(
  realtimeSource,
  /eventId\?: string, occurredAt\?: string, payload\?: unknown/,
  'realtime frames should accept the versioned event envelope'
)
assert.match(
  realtimeSource,
  /if \(message\.eventId && hasSeenEvent\(message\.eventId\)\) return/,
  'realtime duplicate event IDs should not be dispatched'
)
assert.match(
  realtimeSource,
  /seenEventIdQueue\.length > MAX_SEEN_EVENT_IDS[\s\S]*?seenEventIdQueue\.shift\(\)/,
  'realtime event IDs should be evicted in FIFO order'
)
assert.match(
  realtimeSource,
  /function onConnected \(handler: RealtimeConnectedHandler\)/,
  'realtime should expose a connection lifecycle subscription'
)
assert.match(
  realtimeSource,
  /socket\.onopen = \(\) => \{[\s\S]*?emitConnected\(\)/,
  'connection lifecycle subscriptions should run after every socket open'
)

assert.match(
  presenceSource,
  /event: 'draft\.subscribe', draftId: activeDraftId\.value/,
  'draft presence should subscribe to the active draft'
)
assert.match(
  presenceSource,
  /event: 'draft\.unsubscribe', draftId: activeDraftId\.value/,
  'draft presence should unsubscribe before clearing the active draft'
)
assert.match(
  presenceSource,
  /event: 'draft\.presence\.update',[\s\S]*?activity: activity\(\)/,
  'draft presence updates should publish the current editing state'
)
assert.match(
  presenceSource,
  /onConnected\(\(\) => subscribe\(\)\)/,
  'draft presence should resubscribe after realtime reconnects'
)
assert.match(
  presenceSource,
  /on\('draft\.presence\.snapshot',[\s\S]*?payload\.draftId !== activeDraftId\.value/,
  'draft presence snapshots should be scoped to the active draft'
)
assert.match(
  presenceSource,
  /setInterval\(\(\) => publishPresence\(\), PRESENCE_HEARTBEAT_MS\)/,
  'draft presence should renew its activity periodically'
)

console.log('Realtime event and draft presence contract check passed')
