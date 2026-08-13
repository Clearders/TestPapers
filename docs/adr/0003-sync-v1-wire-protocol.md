# ADR-0003: Sync v1 Wire Protocol and Stable Error Catalogue

- Status: Accepted
- Date: 2026-08-13
- Decision owners: TestPapers maintainers
- Linear: [CLE-90](https://linear.app/clearders/issue/CLE-90)
- Parent: [CLE-29](https://linear.app/clearders/issue/CLE-29)
- Depends on: [ADR-0002](0002-local-cloud-domain-model-and-ownership.md)
- Cloud API contract target: `1.2.0`
- Sync protocol version: `1`

## Context

ADR-0002 defines stable IDs, ownership, replication scopes, canonical content hashes, versions, tombstones, history, and the no-silent-overwrite boundary. Desktop already persists those fields, local history, pending mutations, and conflict candidates, but it deliberately has no network synchronization implementation. The Cloud schema and public API also do not yet expose a synchronization boundary.

All clients need one wire protocol before Cloud migrations, generated clients, queues, conflict UX, and consistency tests can proceed. The protocol must remain correct with at-least-once delivery: a client or intermediary may repeat a request after the server committed it, responses may arrive late, and different devices may submit mutations concurrently.

## Decision

TestPapers adopts the JSON-over-HTTPS Sync v1 protocol described here. The protocol is additive under `/api/v1/sync`, uses the existing success/error envelope and Bearer authentication, and is independent of Redis, Celery, WebSocket delivery, and physical database layouts.

This ADR fixes operation names, request and response fields, transaction and concurrency boundaries, attachment transfer operations, and stable errors. CLE-94 adds the complete cursor-compaction and recovery state machines. CLE-93 publishes generated JSON Schema, OpenAPI `1.2.0`, language bindings, fixtures, and semantic fingerprints without changing the behavior fixed here.

## Normative language and encoding

`MUST`, `MUST NOT`, `SHOULD`, and `MAY` are normative. JSON names use camelCase. Requests and responses use UTF-8 `application/json`, except attachment chunk and content bodies. Unknown request fields are rejected until a later compatible protocol version explicitly permits them.

Every Sync endpoint requires a top-level or query parameter `protocolVersion=1`. A server MUST reject an unsupported value before reading or mutating domain data. Successful JSON responses retain the platform envelope:

```json
{
  "success": true,
  "data": {},
  "meta": { "requestId": "019c0000-0000-7000-8000-000000000001" }
}
```

Errors retain the platform error envelope. `error.code` and the documented keys in `error.details` are wire-stable; the human-readable message is not:

```json
{
  "success": false,
  "error": {
    "code": "SYNC_CONFLICT",
    "message": "The mutation base is stale.",
    "details": {
      "operationId": "019c0000-0000-7000-8000-000000000010",
      "conflictId": "019c0000-0000-7000-8000-000000000011"
    }
  },
  "meta": { "requestId": "019c0000-0000-7000-8000-000000000001" }
}
```

## Shared scalar types

| Type | Wire representation | Rules |
| --- | --- | --- |
| Stable ID | string | Lowercase hyphenated UUID; existing UUIDv4 and new UUIDv7 are accepted |
| Protocol version | integer | Exactly `1` |
| Entity version | integer | `1..9223372036854775807`; never derived from time |
| Hash | string | Lowercase 64-character SHA-256 hex |
| Instant | string | UTC RFC 3339 with an explicit `Z`; informational, never a concurrency authority |
| Cursor | string | Opaque URL-safe token; clients MUST NOT parse, sort, or construct it |
| Sequence | string | Opaque decimal token used only for diagnostics and deterministic ordering |

The synchronized entity type is one of `question`, `paper`, `draft`, `attachment`, `comment`, `favorite`, or `setting`. Entity payloads are canonical snapshots conforming to ADR-0002 and the versioned domain dictionary. Projection-only paths, object keys, queue state, credentials, and server integer keys never appear in a domain payload.

## Mutation model

### Mutation fields

Each mutation has this logical shape:

```json
{
  "operationId": "019c0000-0000-7000-8000-000000000010",
  "entityType": "question",
  "entityId": "019c0000-0000-7000-8000-000000000020",
  "kind": "update",
  "baseVersion": 4,
  "baseContentHash": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "payload": {},
  "dependsOn": []
}
```

| Field | Required | Meaning |
| --- | --- | --- |
| `operationId` | yes | Client-generated stable UUID and operation-level idempotency identity |
| `entityType` | yes | One of the seven synchronized entities |
| `entityId` | yes | Stable domain ID; never a Cloud surrogate key |
| `kind` | yes | `create`, `update`, `delete`, `restore`, `rename`, `attach`, or `detach` |
| `baseVersion` | except create | Version that the user or device edited |
| `baseContentHash` | except create | Hash paired with `baseVersion` |
| `payload` | depends on kind | Candidate snapshot or the operation-specific fields defined below |
| `dependsOn` | yes | Earlier operation IDs in the same batch; empty when independent |

`dependsOn` MUST form an acyclic graph and may refer only to earlier entries in the same batch. An operation runs only when every dependency is `applied` or `noop`.

### Mutation kinds

| Kind | Base | Payload | Accepted effect |
| --- | --- | --- | --- |
| `create` | MUST be absent | Complete candidate snapshot with version `1` | Creates a never-before-used ID |
| `update` | required | Complete candidate snapshot | Creates the next semantic version |
| `delete` | required | Optional deletion reason only | Creates a tombstone version |
| `restore` | required and MUST name the tombstone | Complete restored snapshot | Clears deletion fields in a newer version |
| `rename` | required | `{ "name": string }` or `{ "title": string }` as applicable | Explicit semantic update for audit and UX |
| `attach` | required for target; attachment create may be a dependency | `{ "attachmentId": UUID, "position": integer }` | Creates or restores a versioned reference |
| `detach` | required for target | `{ "attachmentId": UUID }` | Tombstones the reference; bytes are not immediately purged |

An existing entity mutation MUST include both base fields. If either differs from the current canonical state, the mutation becomes an explicit conflict. A stale live snapshot MUST NOT restore a tombstone. An explicit `restore` based on the current tombstone is required.

A payload whose canonical semantic hash equals the current hash and which has no lifecycle, ownership, scope, or attribution change is a `noop`; it does not increment the entity version or append another semantic version.

## Transactional Push

`POST /api/v1/sync/push` submits an ordered batch.

```json
{
  "protocolVersion": 1,
  "batchId": "019c0000-0000-7000-8000-000000000100",
  "deviceId": "desktop-8e0e1c7f",
  "mutations": []
}
```

`batchId` is the batch idempotency key. The server stores a digest of the canonical request and the complete response. Repeating the same `batchId` and digest MUST return the original response without re-running authorization, version creation, side effects, or accounting. Reusing the ID with different canonical content returns `SYNC_IDEMPOTENCY_MISMATCH`.

The server opens one database transaction for the batch and a savepoint for each operation. Operations are evaluated in request order:

1. Validate protocol, batch bounds, authentication, ownership, and dependency graph.
2. For each operation, verify dependencies and current authorization.
3. Lock or conditionally update the current entity version.
4. Apply the mutation, history entry, change-log entry, and operation result in its savepoint.
5. Roll back only that savepoint for a rejected or conflicting operation.
6. Commit the batch result and its idempotency record atomically.

Unrelated valid operations MAY succeed when another operation fails. A failed operation never leaves a domain write without its history/change-log entry, and every dependent operation returns `dependencyFailed`. Catastrophic transaction failure returns no per-operation success; retrying the same `batchId` is safe.

The initial bounds are 100 mutations, 1 MiB canonical JSON per mutation, and 10 MiB per batch excluding attachment bytes. The contract may lower these bounds for a deployment but MUST advertise the effective limits and return `SYNC_BATCH_TOO_LARGE`, never truncate.

Push returns HTTP 200 whenever the batch itself was accepted, even if individual operations conflict or fail validation:

```json
{
  "protocolVersion": 1,
  "batchId": "019c0000-0000-7000-8000-000000000100",
  "results": [
    {
      "operationId": "019c0000-0000-7000-8000-000000000010",
      "status": "applied",
      "entityVersion": 5,
      "contentHash": "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      "changeCursor": "opaque-change-cursor"
    }
  ]
}
```

Operation status is one of:

| Status | Meaning |
| --- | --- |
| `applied` | A new accepted semantic version was committed |
| `noop` | The requested semantic state already exists; no version was created |
| `conflict` | Both accepted and candidate states were preserved under `conflictId` |
| `rejected` | Authorization, validation, or invariant failure; `error` is present |
| `dependencyFailed` | A declared dependency did not apply; `failedDependencyIds` is present |

HTTP failure is reserved for a request that cannot be treated as a valid batch, such as authentication failure, unsupported protocol, malformed dependency graph, oversized batch, or idempotency mismatch.

## Incremental Pull

`GET /api/v1/sync/pull?protocolVersion=1&deviceId=...&cursor=...&limit=100` reads changes after an opaque cursor. `cursor` is absent only for an initial incremental read when the server still retains the device horizon. `limit` defaults to 100 and is bounded to `1..500`.

```json
{
  "protocolVersion": 1,
  "changes": [
    {
      "sequence": "1042",
      "entityType": "question",
      "entityId": "019c0000-0000-7000-8000-000000000020",
      "kind": "update",
      "version": 5,
      "contentHash": "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      "updatedAt": "2026-08-13T01:00:00Z",
      "snapshot": {}
    }
  ],
  "nextCursor": "opaque-next-cursor",
  "hasMore": false
}
```

Sync v1 sends complete canonical snapshots rather than patches. A delete change carries the complete tombstone envelope and no live domain content. A restore carries the complete restored snapshot. Changes are strictly ordered by the server change-log sequence, not by client timestamps.

Pull is repeatable: presenting the same cursor produces the same logical page while that history remains retained. A client MUST apply a page in one local transaction and MUST NOT discard or acknowledge the input cursor until that transaction commits. Receiving a version/hash already applied is a no-op. Receiving a divergent remote version while an unacknowledged local candidate exists creates a local conflict; it never overwrites the candidate.

When the requested history is no longer retained, the server returns `SYNC_CURSOR_EXPIRED` with a `snapshotUrl` and the oldest retained diagnostic sequence. CLE-94 fixes the compaction horizon and complete rebuild state machine.

## Cursor acknowledgement

`POST /api/v1/sync/ack` records that a device durably applied a pull page:

```json
{
  "protocolVersion": 1,
  "deviceId": "desktop-8e0e1c7f",
  "cursor": "opaque-next-cursor"
}
```

Acknowledgement is monotonic per authenticated account and device. Repeating the current cursor or an older valid cursor is a no-op and returns the stored current cursor. A cursor from another account/device, a fabricated cursor, or a cursor ahead of any page issued to the device returns `SYNC_CURSOR_INVALID`. Server receipt alone never proves local application; the client sends ack only after its SQLite transaction commits.

## Consistent Snapshot

`GET /api/v1/sync/snapshot?protocolVersion=1&deviceId=...&cursor=...&limit=500` rebuilds a new device or an expired replica. The first request omits `cursor`; the server opens a consistent logical snapshot and returns `snapshotId`, entries, `nextCursor`, `hasMore`, and a `resumeCursor` representing the change-log boundary immediately after the snapshot.

Snapshot pages contain current live entities and retained tombstones authorized for the account. Pagination stays bound to the same `snapshotId`; it does not mix later writes into the snapshot. Expired snapshot sessions return `SYNC_SNAPSHOT_EXPIRED` and must restart in separate staging storage.

Clients MUST stage and validate all pages before atomically replacing the acknowledged replica. Pending mutations, local-private records, unresolved conflicts, and unuploaded blobs are outside the replacement set and MUST be preserved. After swap, the client continues Pull from `resumeCursor` and acknowledges it only after applying any intervening changes.

## Versions and conflicts

Sync v1 exposes generic version resources for entities authorized to the caller:

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/v1/sync/entities/{entityType}/{entityId}/versions` | Paginated immutable accepted versions |
| `POST` | `/api/v1/sync/entities/{entityType}/{entityId}/versions/{version}/restore` | Create a new version from an older snapshot |
| `GET` | `/api/v1/sync/conflicts/{conflictId}` | Read base, local candidate, and current Cloud snapshots |
| `POST` | `/api/v1/sync/conflicts/{conflictId}/resolve` | Resolve with an idempotency key |
| `POST` | `/api/v1/sync/resolutions/{resolutionId}/undo` | Create a compensating version |

A conflict record contains `conflictId`, entity identity, common base, candidate, current canonical snapshot or tombstone, originating device, timestamps, and resolution status. The common base is retained even when automatic field comparison is possible.

Resolution action is one of:

| Action | Required data | Result |
| --- | --- | --- |
| `keepLocal` | Candidate version/hash | Candidate becomes a new accepted version after current authorization check |
| `useCloud` | Current Cloud version/hash | Conflict closes without changing Cloud state; local replica adopts it |
| `saveCopy` | New stable entity ID | Candidate creates a separate entity; original remains unchanged |
| `manualMerge` | Complete merged candidate plus both compared hashes | Merged candidate becomes a new accepted version |
| `restoreVersion` | Historical version and current base | Historical content becomes a new accepted version |

Every resolving or undoing write has its own `operationId`, uses the same idempotency rules as Push, appends an audit record, and never rewrites history. Repeating it cannot create another version. Undo is a compensating version, not deletion of the resolution record.

The existing collaborative draft `revision` and `DRAFT_REVISION_CONFLICT` remain the live WebSocket collaboration mechanism. Personal-device sync conflicts use Sync v1 versions and `SYNC_CONFLICT`. A client MUST label and present them separately.

## Attachment transfer

Attachment metadata synchronizes through Push/Pull. Blob bytes are immutable and content-addressed by `blobHash`; they never appear in JSON mutation payloads.

| Method | Path | Body/result |
| --- | --- | --- |
| `POST` | `/api/v1/sync/attachments/initiate` | Hash, size, media type, target identity; returns deduplicated completion or upload session |
| `PUT` | `/api/v1/sync/attachments/uploads/{uploadId}/chunks/{index}` | Raw bytes plus chunk hash; idempotent per index and hash |
| `GET` | `/api/v1/sync/attachments/uploads/{uploadId}` | Session expiry and missing chunk indexes |
| `POST` | `/api/v1/sync/attachments/uploads/{uploadId}/complete` | Verifies full byte count/hash and publishes the blob |
| `GET` | `/api/v1/sync/attachments/{attachmentId}/content` | Authorized bytes with immutable hash/length headers |

Initiate performs target ACL checks before revealing whether a hash exists. Deduplication shares only immutable bytes; each attachment keeps its own ID, owner, target, metadata, version, and tombstone. A repeated chunk with the same hash is a no-op; a different hash for the same index is rejected. Completion is idempotent and does not make corrupt or incomplete bytes visible.

Content download always re-authorizes the attachment through its live target. Object keys and unsigned storage URLs are never returned. A tombstone removes the logical reference before any delayed reference-counted byte reclamation.

## Stable error catalogue

The following codes are reserved for Sync v1. Clients MUST branch on `code`, `retryable`, and the listed detail keys rather than message text.

| Code | HTTP | Retryable | Stable detail keys | Meaning |
| --- | ---: | --- | --- | --- |
| `SYNC_PROTOCOL_UNSUPPORTED` | 426 | no | `supportedVersions`, `receivedVersion` | Client and server have no supported protocol in common |
| `SYNC_BATCH_INVALID` | 422 | no | `field`, `reason` | Malformed mutation, dependency cycle, or unsupported operation |
| `SYNC_BATCH_TOO_LARGE` | 413 | after split | `maxMutations`, `maxMutationBytes`, `maxBatchBytes` | Advertised batch bound exceeded |
| `SYNC_IDEMPOTENCY_MISMATCH` | 409 | no | `idempotencyKey` | An existing batch/operation ID was reused with different content |
| `SYNC_DEPENDENCY_FAILED` | 424 | after dependency | `operationId`, `failedDependencyIds` | A required earlier operation did not apply |
| `SYNC_CONFLICT` | 409 | user action | `operationId`, `conflictId`, `entityType`, `entityId` | Base version/hash is stale or delete/update competes |
| `SYNC_CURSOR_INVALID` | 400 | restart request | `reason` | Cursor is fabricated, from another scope, or was never issued |
| `SYNC_CURSOR_EXPIRED` | 410 | snapshot | `snapshotUrl`, `oldestRetainedSequence` | Change history needed by the cursor was compacted |
| `SYNC_SNAPSHOT_EXPIRED` | 410 | restart snapshot | `snapshotId` | Consistent snapshot session expired before completion |
| `SYNC_ENTITY_FORBIDDEN` | 403 | no | `entityType`, `entityId`, `operationId` | Caller cannot read or mutate the entity |
| `SYNC_ENTITY_NOT_FOUND` | 404 | no | `entityType`, `entityId`, `operationId` | Entity is absent and no retained tombstone is visible |
| `SYNC_ENTITY_SCHEMA_UNSUPPORTED` | 422 | upgrade client | `entityType`, `schemaVersion`, `supportedSchemaVersions` | Payload schema cannot be consumed |
| `SYNC_UPLOAD_EXPIRED` | 410 | re-initiate | `uploadId` | Resumable upload session expired |
| `SYNC_UPLOAD_CHUNK_MISMATCH` | 409 | correct chunk | `uploadId`, `chunkIndex`, `expectedHash`, `receivedHash` | Chunk index was reused with different bytes |
| `SYNC_ATTACHMENT_HASH_MISMATCH` | 422 | re-upload | `uploadId`, `expectedHash`, `actualHash` | Completed bytes do not match the declared blob hash |

The existing `INVALID_TOKEN`, `TOKEN_EXPIRED`, `ACCOUNT_DISABLED`, `FORBIDDEN`, `RATE_LIMIT_EXCEEDED`, and `INTERNAL_ERROR` remain valid platform errors. Authentication and account errors take precedence before entity details are disclosed. `INTERNAL_ERROR` never reports an operation as applied; clients safely retry the unchanged idempotency key.

Per-operation failures inside an accepted Push batch use the same code and detail structure in the result's `error` member. `SYNC_DEPENDENCY_FAILED` is represented by the `dependencyFailed` operation status and may also be surfaced as the corresponding error object.

## Authorization, privacy, and observability

- All Sync endpoints require a valid native Bearer access token. Browser Cookie/CSRF use may be added only with an explicit threat-model update.
- `deviceId` must belong to the authenticated token session; a request cannot nominate another device.
- Authorization is checked on every replayable operation before first execution and the authorized result is stored. Account or device revocation prevents new requests; it does not rewrite a previously committed idempotent result.
- Logs and metrics may contain request ID, operation ID, entity type, status, sizes, latency, and error code. They MUST NOT contain entity payloads, answers, blob bytes, access/refresh tokens, raw cursors, or signed locators.
- Rate limiting occurs before expensive payload processing but after authentication. A rate-limited request does not consume its idempotency key.

## Required invariants

Every implementation and fixture suite MUST preserve these invariants:

1. No accepted update is selected by wall-clock timestamp or arrival order alone.
2. A stale base never overwrites a newer version or tombstone.
3. Every accepted semantic mutation atomically creates current state, immutable history, and a change-log entry.
4. Exact replay creates no additional semantic version, audit action, attachment reference, or side effect.
5. A Pull page is acknowledged only after its local transaction commits.
6. Snapshot rebuilding never discards pending mutations, local-private data, conflicts, or unuploaded blobs.
7. Conflicts retain common base, local candidate, and Cloud state until an audited resolution.
8. Attachment byte deduplication never bypasses metadata ownership or target ACLs.
9. Existing collaborative revisions remain distinct from personal-device sync conflicts.

## Compatibility and rollout

Sync v1 is additive to Cloud API `1.2.0`; existing Web CRUD and WebSocket clients continue using their current endpoints. Sync capability is enabled per account and entity behind a server feature flag. Unsupported clients receive the stable protocol error and continue operating locally.

Schema evolution within protocol v1 may add optional response fields or advertise new entity schema versions. Changing required fields, mutation meaning, idempotency identity, cursor opacity, error-code semantics, or the no-silent-overwrite boundary requires a new sync protocol version and an overlap window in which the server supports both versions.

Rollback disables new Sync requests but preserves additive schema, accepted versions, tombstones, idempotency results, cursors, conflicts, and client pending data. Rollback MUST NOT hard-delete history or tell clients to discard unacknowledged changes.

## Consequences

### Positive

- Cloud, Desktop, Web, and Mobile can implement against one deterministic contract.
- At-least-once delivery and partial batch failure do not create duplicate semantic changes.
- Full snapshots and explicit base versions favor correctness and diagnosability over premature bandwidth optimization.
- Conflict, deletion, restore, and attachment behavior share the ADR-0002 lifecycle boundary.

### Costs

- The server stores idempotency results, immutable versions, change-log entries, conflicts, and device cursors.
- Full snapshot changes use more bandwidth than patches.
- Clients require staging storage and persistent queue state before they can enable Sync.
- Error and operation semantics become compatibility commitments across four repositories.

## Acceptance checklist

- [x] Push, Pull, Ack, Snapshot, version/conflict, and attachment operations are defined.
- [x] Mutation identity, dependency, base version/hash, payload, and result fields are fixed.
- [x] Create, update, delete, restore, rename, attach, and detach are covered.
- [x] Transaction savepoints, partial failure, exact replay, and concurrency conflict behavior are fixed.
- [x] The stable error catalogue includes HTTP, retryability, and structured details.
- [x] Wall-clock last-write-wins and silent resurrection are prohibited.
- [x] Personal sync conflicts and collaborative draft revisions are distinct.
- [x] Cursor compaction details and cross-language generated artifacts remain in CLE-94 and CLE-93.
