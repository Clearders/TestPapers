# TestPapers API Reference

> Version: v1.1.0
> Backend: FastAPI 0.136 / Python 3.13+  
> Frontend: Nuxt 4.4 / TypeScript  
> Last updated: 2026-08-09

This document reflects the current FastAPI implementation in `TestPaper-backend/testpaper_backend/api/routes` and the Pydantic schemas in `testpaper_backend/schemas`.

## Conventions

| Item | Value |
| --- | --- |
| API base path | `/api/v1` except `GET /` |
| Data format | JSON, camelCase fields |
| Datetime format | ISO 8601 |
| Browser auth | HttpOnly Cookie `testpapers_session` |
| Non-browser auth | `Authorization: Bearer <token>` |
| CSRF | Cookie-authenticated `POST`, `PUT`, `PATCH`, and `DELETE` requests require `X-CSRF-Token`; login and register are exempt |
| Request ID | Clients may send `X-Request-Id`; responses return `meta.requestId` |

Successful JSON responses use an envelope:

```json
{
  "success": true,
  "data": {},
  "meta": { "requestId": "550e8400-e29b-41d4-a716-446655440000" }
}
```

Errors use the same envelope shape:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": [{ "field": "difficulty", "reason": "Input should be 'easy', 'medium' or 'hard'" }]
  },
  "meta": { "requestId": "550e8400-e29b-41d4-a716-446655440000" }
}
```

`204 No Content` endpoints do not return a body. DOCX downloads return binary content and do not use the JSON envelope.

## Permissions

| Role | Permissions |
| --- | --- |
| `admin` | `questions:read`, `questions:write`, `questions:delete`, `answers:read`, `papers:read`, `papers:write`, `users:manage`, `banks:read`, `banks:write`, `banks:delete`, `banks:publish`, `banks:subscribe` |
| `teacher` | `questions:read`, `questions:write`, `questions:delete`, `answers:read`, `papers:read`, `papers:write`, `banks:read`, `banks:write`, `banks:delete`, `banks:publish`, `banks:subscribe` |
| `viewer` | `questions:read`, `papers:read`, `banks:read`, `banks:subscribe` |

`answers:read` controls whether answers are included in question, paper, revision, export preview, and DOCX responses. Passing `includeAnswer=true` does not override this permission.

Shared paper drafts use the existing paper permissions plus draft-level access roles. Creating a shared draft requires `papers:write`; listing, reading, commenting on, and downloading accessible drafts require `papers:read`. Draft owners and admins can rename, delete, and manage collaborators. Draft editors can update draft content and move a draft to `in_review`; draft viewers can read and comment only. Admins can access all shared drafts.

Question banks use the `banks:*` permissions plus bank-level access roles. Creating a bank requires `banks:write`; publishing and withdrawing require `banks:publish` plus owner/admin bank role; deleting requires `banks:delete` plus owner/admin bank role. Bank access roles are `owner`, `admin`, `editor`, and `viewer`; any authenticated user can read `public` banks. The public snapshot endpoints below are anonymous and expose only active public publications with answers redacted.

## Pagination

Question list endpoints return:

```json
{
  "items": [],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "total": 0,
    "totalPages": 0
  }
}
```

| Parameter | Type | Default | Notes |
| --- | --- | --- | --- |
| `page` | integer | `1` | Minimum `1` |
| `pageSize` | integer | `20` | `1` to `100` |
| `sortBy` | string | backend default | Optional sort field |
| `sortOrder` | `asc` / `desc` | `desc` | Sort direction |

## Rate Limits

| Scope | Default | Environment variables |
| --- | --- | --- |
| Login/register | 5 attempts per IP per 60 seconds | `RATE_LIMIT_MAX_ATTEMPTS`, `RATE_LIMIT_WINDOW_SECONDS` |
| Mutations | 30 attempts per IP per 60 seconds | `RATE_LIMIT_WRITE_MAX_ATTEMPTS`, `RATE_LIMIT_WRITE_WINDOW_SECONDS` |

Mutation rate limits apply to create, update, delete, upload, and task dispatch endpoints.

## Authentication

### `POST /api/v1/auth/login`

Logs in a user and sets `testpapers_session` and `testpapers_csrf` Cookies. Exempt from CSRF.

| Field | Type | Required | Constraints |
| --- | --- | --- | --- |
| `username` | string | yes | Minimum 1 character |
| `password` | string | yes | Minimum 1 character |

Response: `AuthSession`.

### `POST /api/v1/auth/register`

Registers a user and logs them in. Exempt from CSRF. Public registration creates `viewer` users.

| Field | Type | Required | Constraints |
| --- | --- | --- | --- |
| `username` | string | yes | 3 to 64 chars, trimmed and lowercased |
| `displayName` | string | yes | 1 to 120 chars, trimmed |
| `password` | string | yes | 8 to 128 chars, must contain a letter and a digit |

Response: `201 AuthSession`.

### Other Auth Endpoints

| Method | Path | Auth | Body | Response |
| --- | --- | --- | --- | --- |
| `GET` | `/api/v1/auth/me` | logged in | none | `UserEntity` |
| `POST` | `/api/v1/auth/refresh` | logged in | none | rotated `AuthSession` and Cookies |
| `POST` | `/api/v1/auth/logout` | logged in | none | `204`, clears auth and CSRF Cookies |
| `PATCH` | `/api/v1/auth/profile` | logged in | `ProfileUpdate` | `UserEntity` |
| `PUT` | `/api/v1/auth/password` | logged in | `PasswordChange` | `204` |
| `POST` | `/api/v1/auth/avatar` | logged in | `ImageUploadPayload` | `ImageUploadResponse` |
| `DELETE` | `/api/v1/auth/account` | logged in | none | `204`, soft-deletes the account and clears sessions |

`ProfileUpdate` must include `username`, `displayName`, or both. Username changes are limited to once every 30 days.

`ImageUploadPayload`:

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `filename` | string | yes | Original filename |
| `data` | string | yes | Base64 PNG data |
| `mimeType` | string | no | Defaults to `image/png`; only PNG is accepted |

### Native Client Authentication (Bearer Tokens)

Native Desktop/Mobile clients authenticate without Cookies using short-lived access tokens and rotating refresh tokens. Tokens are only ever transmitted in request headers or bodies, never in URLs. All native endpoints are exempt from CSRF (Bearer requests are already exempt; the token endpoints are exempt so clients without Cookies can log in).

#### `POST /api/v1/auth/token`

Logs in a native client and returns an access/refresh token pair. No Cookie is set.

| Field | Type | Required | Constraints |
| --- | --- | --- | --- |
| `username` | string | yes | Minimum 1 character |
| `password` | string | yes | Minimum 1 character |
| `deviceName` | string | yes | 1 to 120 chars, human-readable label |
| `deviceId` | string | yes | 1 to 128 chars, stable client-generated device identifier |

Response: `TokenPair`:

| Field | Type | Notes |
| --- | --- | --- |
| `accessToken` | string | Short-lived bearer token for API and WebSocket access |
| `refreshToken` | string | Long-lived token used only with the refresh endpoint |
| `expiresIn` | integer | Access token lifetime in seconds |
| `refreshExpiresIn` | integer | Refresh token lifetime in seconds |
| `user` | `UserEntity` | Authenticated user |

#### `POST /api/v1/auth/token/refresh`

Rotates a refresh token. The submitted refresh token and its access token are revoked immediately; a fresh pair is returned. Only `refresh`-type tokens are accepted.

| Field | Type | Required | Constraints |
| --- | --- | --- | --- |
| `refreshToken` | string | yes | Minimum 1 character |

Response: `TokenPair`. Error codes: `INVALID_TOKEN`, `TOKEN_EXPIRED`, `ACCOUNT_DISABLED`.

#### `GET /api/v1/auth/devices`

Requires authentication. Returns the current user's device sessions aggregated by `deviceId`.

Response: `DeviceSessionEntity[]`:

| Field | Type | Notes |
| --- | --- | --- |
| `deviceId` | string | Device identifier |
| `deviceName` | string | Device label |
| `lastSeenAt` | datetime or null | Most recent activity |
| `createdAt` | datetime | First seen |
| `current` | boolean | Whether this is the device of the current request |

#### `DELETE /api/v1/auth/devices/{device_id}`

Requires authentication. Revokes every token belonging to the device, including its sessions, access tokens, and refresh tokens. Returns `204`. Revoking the device used by the current request is rejected with `409 DEVICE_IS_CURRENT`.

### Native Auth Behavior

- Access tokens are accepted via `Authorization: Bearer <token>` on all API endpoints and the WebSocket endpoint.
- Refresh tokens must never be used as access credentials; they are rejected with `401 INVALID_TOKEN`.
- Changing the password revokes all tokens for the user except the current request's token. Deleting the account revokes every token.
- The `auth_audit_log` table records `login`, `refresh`, `device_revoked`, `password_changed`, and `account_deleted` events with device and IP context.

## Users

All user management endpoints require `users:manage`.

| Method | Path | Body | Response |
| --- | --- | --- | --- |
| `GET` | `/api/v1/users` | none | `UserEntity[]` |
| `POST` | `/api/v1/users` | `UserCreate` | `201 UserEntity` |
| `PATCH` | `/api/v1/users/{user_public_id}` | `UserUpdate` | `UserEntity` |
| `DELETE` | `/api/v1/users/{user_public_id}` | none | `204` |

`UserCreate` includes `username`, `displayName`, `password`, optional `role`, and optional `isActive`. `UserUpdate` supports `displayName`, `password`, `role`, and `isActive`; explicit `null` values are rejected.

## Questions

### List and Read

| Method | Path | Permission | Description |
| --- | --- | --- | --- |
| `GET` | `/api/v1/questions` | `questions:read` | Paginated question list |
| `GET` | `/api/v1/questions/mine` | `questions:read` | Current user's questions; same filters except `ownerId` |
| `GET` | `/api/v1/questions/{question_public_id}` | `questions:read` | Question detail |

List filters:

| Parameter | Type | Notes |
| --- | --- | --- |
| `q` | string | Full-text search; answers are searched only with `answers:read` |
| `subjects` | string | Comma-separated subjects |
| `difficulty` | `easy` / `medium` / `hard` | Optional |
| `type` | `single_choice` / `multiple_choice` / `true_false` / `blank` / `short_answer` / `essay` | Optional |
| `tags` | string | Comma-separated tags |
| `hasLatex` | boolean | Optional |
| `ownerId` | integer | Only on `/questions` |
| `includeAnswer` | boolean | Default `true`; still requires `answers:read` |
| `page`, `pageSize`, `sortBy`, `sortOrder` | mixed | See pagination |

### Create, Update, Delete

| Method | Path | Permission | Description |
| --- | --- | --- | --- |
| `POST` | `/api/v1/questions` | `questions:write` | Creates a question, returns `201 QuestionEntity`, broadcasts `question.created` |
| `PATCH` | `/api/v1/questions/{question_public_id}` | `questions:write` | Updates a question, creates a revision, broadcasts `question.updated` |
| `DELETE` | `/api/v1/questions/{question_public_id}` | `questions:delete` | Owner or admin only, returns `204`, broadcasts `question.deleted` |

`QuestionCreate` fields:

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `type` | `QuestionType` | yes | Question type |
| `subjects` | string[] | yes | At least one non-empty subject |
| `difficulty` | `Difficulty` | yes | `easy`, `medium`, or `hard` |
| `tags` | string[] | no | Trimmed, lowercased, deduplicated |
| `text` | string | yes | Non-empty question text |
| `options` | string[] | for choice/true-false | Cleared for non-choice questions |
| `answer` | string or string[] | yes | Multiple-choice requires an array; other types require a string |
| `hasLatex` | boolean | no | Optional hint |
| `source` | string | no | Trimmed |
| `essayBlankSpace` | object | no | Essay only; default `{ "lines": 6, "lineHeight": 28 }` |
| `images` | `QuestionImage[]` | no | Backend-uploaded PNG URLs only |
| `scoreWeight` | number | no | Default `1`, range `(0, 100]` |
| `ownerId` | integer | no | Server ownership rules apply |

`EssayBlankSpace.lines` must be `1` to `20`; `lineHeight` must be `20` to `48`.

### Revisions and Corrections

| Method | Path | Permission | Description |
| --- | --- | --- | --- |
| `GET` | `/api/v1/questions/{question_public_id}/revisions` | `questions:read` | Revision history; answer patches are redacted without `answers:read` |
| `DELETE` | `/api/v1/questions/{question_public_id}/revisions/{revision_id}` | `questions:delete` | Owner or admin only |
| `POST` | `/api/v1/questions/{question_public_id}/corrections` | `questions:read` | Submit a correction |
| `GET` | `/api/v1/questions/{question_public_id}/corrections` | `questions:read` | List corrections |
| `PATCH` | `/api/v1/questions/{question_public_id}/corrections/{correction_id}` | `questions:write` | Owner or admin accepts/rejects |
| `DELETE` | `/api/v1/questions/{question_public_id}/corrections/{correction_id}` | `questions:delete` | Owner or admin only |

Correction create body:

```json
{
  "category": "wrong_answer",
  "message": "The answer should be B."
}
```

`category`: `wrong_answer`, `unclear`, `typo`, or `other`.  
`status`: `open`, `accepted`, or `rejected`.

## Papers

### Create

`POST /api/v1/papers` requires `papers:write`, returns `201 PaperExpandedEntity`, and broadcasts `paper.created`.

`PaperCreate`:

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `title` | string | yes | Non-empty |
| `subject` | string | yes | Non-empty |
| `duration` | integer | yes | Minutes, greater than `0` |
| `totalMarks` | integer | yes | Greater than `0` |
| `ownerId` | integer | no | Server ownership rules apply |
| `questions` | `QuestionRef[]` | no | Defaults to `[]`; duplicate question refs are rejected |

`QuestionRef`: `questionPublicId`, `orderNo`, optional `marks`. `orderNo` and `marks` must be greater than `0`.

### Generate

`POST /api/v1/papers/generate` requires `papers:write`, uses the genetic algorithm generator, returns `201`, and broadcasts `paper.created`.

Response data:

```json
{
  "paper": {},
  "diagnostics": {}
}
```

`PaperGenerateRequest`:

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `title` | string | yes | Non-empty |
| `duration` | integer | yes | Greater than `0` |
| `totalMarks` | integer | yes | Greater than `0` |
| `difficultyCoefficient` | number | yes | `0` to `1`, rounded to 2 decimals |
| `questionTypes` | `{ questionType, count }[]` | yes | At least one target; `count > 0` |
| `ownQuestionsOnly` | boolean | no | Default `false` |
| `requiredTags` | string[] | no | Trimmed, lowercased, deduplicated |
| `preferredTags` | string[] | no | Trimmed, lowercased, deduplicated |
| `subjects` | string[] | yes | At least one non-empty subject |
| `subject` | string | no | Overwritten by joining `subjects` |

### Read and Mutate

| Method | Path | Permission | Description |
| --- | --- | --- | --- |
| `GET` | `/api/v1/papers/{paper_public_id}` | `papers:read` | Paper detail; `expand=questions` includes question entities; `includeAnswer` still requires `answers:read` |
| `PATCH` | `/api/v1/papers/{paper_public_id}` | `papers:write` | Owner or admin updates metadata, broadcasts `paper.updated` |
| `POST` | `/api/v1/papers/{paper_public_id}/questions` | `papers:write` | Owner or admin adds `QuestionRef[]`, broadcasts `paper.questions.added` |
| `DELETE` | `/api/v1/papers/{paper_public_id}/questions/{question_public_id}` | `papers:write` | Owner or admin removes a question, broadcasts `paper.question.removed` |
| `PUT` | `/api/v1/papers/{paper_public_id}/questions/order` | `papers:write` | Owner or admin updates order, broadcasts `paper.questions.reordered` |
| `PUT` | `/api/v1/papers/{paper_public_id}/questions` | `papers:write` | Owner or admin replaces the full `QuestionRef[]` list, broadcasts `paper.questions.reordered` |

`PaperUpdate` supports `title`, `subject`, `duration`, `totalMarks`, and `status`. `status` is `draft` or `published`; explicit `null` values are rejected.

Question order body:

```json
{
  "orders": [
    { "questionPublicId": "550e8400-e29b-41d4-a716-446655440000", "orderNo": 1 }
  ]
}
```

Full question-list replacement body:

```json
[
  { "questionPublicId": "550e8400-e29b-41d4-a716-446655440000", "orderNo": 1, "marks": 5 }
]
```

The replacement endpoint rejects duplicate question refs and returns `PaperExpandedEntity`.

### Export

`POST /api/v1/papers/{paper_public_id}/export-preview` requires `papers:read` and returns preview data without creating a file.

| Field | Type | Default |
| --- | --- | --- |
| `includeAnswer` | boolean | `true` |
| `questionOrder` | `paper` / `categorized` | `paper` |
| `layoutDensity` | `auto` / `normal` / `compact` / `dense` | `auto` |

`GET /api/v1/papers/{paper_public_id}/download` requires `papers:read` and downloads a DOCX for a saved paper.

| Query parameter | Type | Default |
| --- | --- | --- |
| `format` | `docx` | `docx` |
| `questionOrder` | `paper` / `categorized` | `paper` |
| `includeAnswer` | boolean | `true` |
| `layoutDensity` | `auto` / `normal` / `compact` / `dense` | `auto` |

Response headers include `Content-Disposition`, `X-Export-Format`, and `X-Layout-Density`.

`POST /api/v1/papers/draft-download` requires `papers:read` and downloads a DOCX from an unsaved paper draft without creating or updating a paper. It is used for temporary question edits that should affect preview/export but not the question bank.

Draft download body:

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `title` | string | yes | Non-empty |
| `subject` | string | yes | Non-empty |
| `duration` | integer | yes | Greater than `0` |
| `totalMarks` | integer | yes | Greater than `0` |
| `questions` | `PaperDraftQuestion[]` | yes | Full draft question snapshots; at least one |
| `includeAnswer` | boolean | no | Default `true`; still requires `answers:read` |
| `questionOrder` | `paper` / `categorized` | no | Default `paper` |
| `layoutDensity` | `auto` / `normal` / `compact` / `dense` | no | Default `auto` |

`PaperDraftQuestion` includes `questionPublicId`, `orderNo`, optional `marks`, and the editable question fields used by export: `type`, `subjects`, `difficulty`, `tags`, `text`, `options`, `answer`, `hasLatex`, `source`, `essayBlankSpace`, `images`, and `scoreWeight`.

Response headers include `Content-Disposition`, `X-Export-Format`, `X-Layout-Density`, and `X-Draft-Export: true`.

## Shared Drafts

Shared drafts persist collaborative paper workspace state in the cloud. They are separate from saved papers: saving or downloading a draft does not create or update a `paper` row unless the client explicitly calls the paper endpoints.

### List, Create, Read, Update, Delete

| Method | Path | Permission | Description |
| --- | --- | --- | --- |
| `GET` | `/api/v1/drafts` | `papers:read` | Lists drafts owned by or shared with the current user; admins see all drafts |
| `POST` | `/api/v1/drafts` | `papers:write` | Creates a shared draft, returns `201 PaperDraftDetail`, broadcasts `draft.updated` |
| `GET` | `/api/v1/drafts/{draft_public_id}` | `papers:read` | Reads a draft detail if the user has draft access |
| `PATCH` | `/api/v1/drafts/{draft_public_id}` | `papers:read` plus draft edit role | Updates draft name, state, or review status with optimistic revision checking |
| `DELETE` | `/api/v1/drafts/{draft_public_id}` | `papers:read` plus owner/admin draft role | Deletes a shared draft, returns `204`, broadcasts `draft.deleted` |

`PaperDraftCreate`:

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `name` | string | yes | Trimmed, 1 to 120 chars |
| `state` | object | yes | Workspace draft state; must include `state.paper` |
| `reviewStatus` | `draft` / `in_review` / `changes_requested` / `approved` | no | Defaults to `draft` |

`PaperDraftUpdate`:

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `baseRevision` | integer | yes | Must equal the current draft `revision`; conflicts return `409 DRAFT_REVISION_CONFLICT` with `currentRevision` |
| `name` | string | no | Owner/admin only |
| `state` | object | no | Full workspace draft state replacement |
| `reviewStatus` | `draft` / `in_review` / `changes_requested` / `approved` | no | Owner/admin can set any status; editors can only set `in_review`; approval is rejected while open comments remain |

`state.paper` may contain `title`, `subject`, `duration`, `totalMarks`, and `questions`. Question entries must be objects. If a question includes `publicId` or `text`, those values must be strings. Draft detail responses redact `answer` and `originalQuestion.answer` from `state.paper.questions` unless the caller has `answers:read`.

### Collaborators

| Method | Path | Permission | Description |
| --- | --- | --- | --- |
| `POST` | `/api/v1/drafts/{draft_public_id}/collaborators` | owner/admin draft role | Adds or updates a collaborator by username, broadcasts `draft.updated` |
| `PATCH` | `/api/v1/drafts/{draft_public_id}/collaborators/{user_public_id}` | owner/admin draft role | Updates a collaborator role, broadcasts `draft.updated` |
| `DELETE` | `/api/v1/drafts/{draft_public_id}/collaborators/{user_public_id}` | owner/admin draft role | Removes a collaborator, broadcasts `draft.updated` |

Collaborator create body:

```json
{
  "username": "teacher2",
  "role": "editor"
}
```

Collaborator roles are `viewer` and `editor`. The draft owner cannot be added as a collaborator. Unknown, inactive, or removed users return `USER_NOT_FOUND`.

### Comments

| Method | Path | Permission | Description |
| --- | --- | --- | --- |
| `POST` | `/api/v1/drafts/{draft_public_id}/comments` | `papers:read` plus draft access | Adds a comment, broadcasts `draft.comment.created` |
| `PATCH` | `/api/v1/drafts/{draft_public_id}/comments/{comment_public_id}` | draft access plus author/editor/owner/admin rule | Updates comment text or status, broadcasts `draft.comment.updated` |

Comment create body:

```json
{
  "questionPublicId": "550e8400-e29b-41d4-a716-446655440000",
  "message": "Check this mark allocation."
}
```

`questionPublicId` is optional. Comment statuses are `open` and `resolved`. Comment messages are trimmed and limited to 1000 characters.

### Cloud Draft Download

`GET /api/v1/drafts/{draft_public_id}/download` requires `papers:read`, checks normal draft access, and returns a DOCX binary directly. It does not use the JSON envelope and does not mutate the draft or create a saved paper.

The download is built from the stored draft state:

- Paper metadata comes from `state.paper.title`, `subject`, `duration`, and `totalMarks`; missing values fall back to the draft name, empty subject, 60 minutes, and 100 marks.
- Questions come from `state.paper.questions`, so temporary question edits in the shared draft are reflected in the DOCX.
- Question ordering uses `state.exportMode` (`paper` or `categorized`) and layout uses `state.layoutDensity` (`auto`, `normal`, `compact`, or `dense`).
- Answers are included only when `state.includeAnswersInExport` is truthy and the caller has `answers:read`.

Response headers include `Content-Disposition`, `X-Export-Format: docx`, `X-Layout-Density`, and `X-Cloud-Draft-Export: true`.

## Question Banks

Question banks are aggregate containers that group questions into shareable, publishable, and forkable units. A bank has a visibility of `private`, `team`, or `public`. `private` banks are visible only to the owner and admins; `team` banks are visible to bank members (owner, admin, editor, viewer); `public` banks are readable and subscribable by any authenticated user. Non-member reads of `private` or `team` banks return `404 BANK_NOT_FOUND` so existence is not leaked.

Bank access roles: `owner` (bank creator), `admin` (any user with `users:manage`), `editor` (can add/remove items), `viewer` (read-only). Visibility changes require the owner role. Publishing and withdrawing additionally require the `banks:publish` permission; deleting requires `banks:delete`; creating requires `banks:write`.

### List, Create, Read, Update, Delete

| Method | Path | Permission | Description |
| --- | --- | --- | --- |
| `GET` | `/api/v1/banks` | authenticated | Lists banks owned by, or shared with, the current user plus all `public` banks |
| `POST` | `/api/v1/banks` | `banks:write` | Creates a private-by-default bank, returns `201 QuestionBankEntity` |
| `GET` | `/api/v1/banks/{bank_public_id}` | bank read access | Reads a bank detail |
| `PATCH` | `/api/v1/banks/{bank_public_id}` | owner/admin bank role | Updates name, description, or visibility (visibility requires owner) |
| `DELETE` | `/api/v1/banks/{bank_public_id}` | `banks:delete` plus owner/admin bank role | Deletes a bank and cascades items/members/publications/subscriptions, returns `204` |

`GET /api/v1/banks` accepts optional `q`, `visibility` (`private`, `team`, or `public`), and `scope` (`visible`, `owned`, `subscribed`, or `public`; default `visible`). `q` is a trimmed, case-insensitive name/description search. Summaries add `isSubscribed`, `subscribedVersion`, and `hasUpdate`; `hasUpdate` is true only when the caller's pinned subscription is behind the active publication.

### Anonymous Public Discovery

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| `GET` | `/api/v1/public/banks` | none | Lists active public snapshots; optional `q` filters name and description |
| `GET` | `/api/v1/public/banks/{bank_public_id}` | none | Reads the current active public snapshot |

These routes expose only public ID, name, description, owner display data, active version, publication time, item and subscriber counts, and immutable snapshot state. Snapshot answers are always redacted for anonymous callers. A private, team-only, unpublished, withdrawn, or unknown bank returns `404 BANK_NOT_FOUND`; the response intentionally does not reveal which condition applied.

`BankCreate` body:

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `name` | string | yes | Trimmed, 1 to 120 chars |
| `description` | string | no | Trimmed, up to 1000 chars |
| `visibility` | `private` / `team` / `public` | no | Defaults to `private` |

`BankUpdate` accepts any subset of `name`, `description`, `visibility`; at least one field is required.

### Items

| Method | Path | Permission | Description |
| --- | --- | --- | --- |
| `GET` | `/api/v1/banks/{bank_public_id}/questions` | bank read access | Lists the bank's questions in insertion order; answers redacted to `[redacted]` unless the caller has `answers:read` |
| `POST` | `/api/v1/banks/{bank_public_id}/items` | owner/admin/editor bank role plus `questions:read` | Adds questions by public ID; duplicate IDs within the request return `422 VALIDATION_ERROR`; questions already in the bank return `409 BANK_ITEM_EXISTS` with `details.questionPublicIds` |
| `DELETE` | `/api/v1/banks/{bank_public_id}/items/{question_public_id}` | owner/admin/editor bank role | Removes a question from the bank |

`BankItemAdd` body: `{ "questionIds": ["550e8400-e29b-41d4-a716-446655440000", ...] }` with at least one entry.

### Members

| Method | Path | Permission | Description |
| --- | --- | --- | --- |
| `POST` | `/api/v1/banks/{bank_public_id}/members` | owner/admin bank role | Adds a member by username with role `viewer` or `editor` |
| `PATCH` | `/api/v1/banks/{bank_public_id}/members/{user_public_id}` | owner/admin bank role | Updates a member role |
| `DELETE` | `/api/v1/banks/{bank_public_id}/members/{user_public_id}` | owner/admin bank role | Removes a member; the member loses access immediately |

Member create body: `{ "username": "teacher2", "role": "editor" }`. The bank owner cannot be added as a member (`422 BANK_OWNER_CANNOT_BE_MEMBER`). Adding an existing member returns `422 BANK_MEMBER_EXISTS`.

### Publish and Versions

| Method | Path | Permission | Description |
| --- | --- | --- | --- |
| `POST` | `/api/v1/banks/{bank_public_id}/publish` | `banks:publish` plus owner/admin bank role | Creates an immutable versioned snapshot (`state` JSONB); empty banks return `422 BANK_PUBLISH_EMPTY`; already published banks return `409 BANK_ALREADY_PUBLISHED` |
| `POST` | `/api/v1/banks/{bank_public_id}/withdraw` | `banks:publish` plus owner/admin bank role | Timestamps and withdraws the active publication; unpublished banks return `409 BANK_NOT_PUBLISHED` |
| `GET` | `/api/v1/banks/{bank_public_id}/versions` | bank read access | Lists published version summaries |
| `GET` | `/api/v1/banks/{bank_public_id}/versions/{version}` | bank read access | Reads an immutable snapshot; unknown versions return `404 BANK_VERSION_NOT_FOUND` |

A published snapshot is immutable: later edits to the bank do not change previously published versions. Withdrawal retains the version in history (`withdrawnAt` is set and `isActive` becomes false); republishing after withdrawal allocates the next version. Snapshot reads go through the shared redaction entry point `load_bank_snapshot`: without `answers:read`, `items[].data.answer` is returned as `[redacted]` (or `["[redacted]"]` for multiple-choice questions) and the stored snapshot is never mutated.

### Subscribe and Fork

| Method | Path | Permission | Description |
| --- | --- | --- | --- |
| `POST` | `/api/v1/banks/{bank_public_id}/subscribe` | authenticated | Subscribes to a `public` or team-visible bank and pins a new subscription to the active publication; `private` banks return `422 BANK_SUBSCRIBE_PRIVATE`; idempotent and never silently advances an existing subscription |
| `PATCH` | `/api/v1/banks/{bank_public_id}/subscribe` | authenticated | Explicitly advances a subscription to the current active version using `{ "version": 2 }` |
| `DELETE` | `/api/v1/banks/{bank_public_id}/subscribe` | authenticated | Unsubscribes, returns `204` |
| `POST` | `/api/v1/banks/{bank_public_id}/fork` | bank read access | Forks a published version into a new `private` bank owned by the caller, returns `201` |

`BankSubscriptionEntity` returns `bankId`, `userId`, pinned `version`, `createdAt`, and `updatedAt`. The patch accepts a positive version number and succeeds without mutation when the caller is already pinned to it. It returns `404 BANK_SUBSCRIPTION_NOT_FOUND` when the caller has no subscription, `404 BANK_VERSION_NOT_FOUND` when the version does not exist, and `409 BANK_VERSION_NOT_ACTIVE` unless the requested version is the bank's current active publication. Subscription updates only move the pin; they never alter questions or forks.

`BankForkRequest` body: `{ "version": 1 }` — `version` is optional and defaults to the latest publication. Fork copies question records (new public IDs) rather than references, so the fork is independent of the original bank. Forking reads through `load_bank_snapshot`, so a caller without `answers:read` gets copied questions whose answers are `[redacted]` — forking can never bypass answer permissions. Banks with no published version return `409 BANK_NOT_PUBLISHED`.

## Metadata and Images

| Method | Path | Permission | Description |
| --- | --- | --- | --- |
| `GET` | `/api/v1/meta/subjects` | `questions:read` | Distinct subjects |
| `GET` | `/api/v1/meta/tags` | `questions:read` | Distinct tags |
| `POST` | `/api/v1/images/upload` | `questions:write` | Upload a Base64 PNG question image; returns `ImageUploadResponse` |

Avatar uploads are limited to 500KB. Question image uploads are PNG-only and are validated by the image service.

## Async Tasks

Task dispatch responses include:

```json
{
  "taskId": "task-id",
  "status": "dispatched"
}
```

| Method | Path | Permission | Description |
| --- | --- | --- | --- |
| `POST` | `/api/v1/tasks/ping` | `questions:read` | Worker connectivity check |
| `GET` | `/api/v1/tasks/{task_id}` | `questions:read` | Poll task status; access is scoped to allowed task IDs |
| `POST` | `/api/v1/tasks/export-paper/{paper_public_id}` | `papers:read` | Dispatch async paper export |
| `POST` | `/api/v1/tasks/validate-questions` | `questions:read` | Validate all questions |
| `POST` | `/api/v1/tasks/validate-question/{question_public_id}` | `questions:read` | Validate one question |
| `POST` | `/api/v1/tasks/cleanup-expired-sessions` | `users:manage` | Cleanup expired sessions |
| `POST` | `/api/v1/tasks/stats/questions` | `questions:read` | Compute question statistics |

`export-paper` query parameters: `question_order=paper|categorized`, `include_answer=true|false`, `format=json|csv|txt`.

## WebSocket

`WS /api/v1/ws`

Authentication priority:

1. `Authorization: Bearer <token>`
2. Cookie `testpapers_session`

On connect, the server sends `auth.connected`. Clients may send `{ "event": "ping" }`; the server replies with `{ "event": "pong" }`. The per-IP connection limit is 10 concurrent WebSocket connections.

All server-originated events include `eventId` (a stable event identifier) and `occurredAt` (an ISO 8601 timestamp). Clients must keep a bounded recent-ID cache and ignore replayed events, including those received after reconnect.

### Draft Presence (CLE-21)

Presence is ephemeral runtime state, not a persisted draft field or audit record. It is stored in Redis so active members are visible across API instances; a client renews its subscription every 15 seconds and entries expire after 45 seconds. If Redis is unavailable, the backend falls back to instance-local presence and clients display reconnecting/degraded status until Redis recovers.

Draft presence messages require read access to the identified draft:

| Direction | Event | Required payload | Behavior |
| --- | --- | --- | --- |
| Client → server | `draft.subscribe` | `draftPublicId` | Begins presence tracking and returns the current authoritative snapshot. |
| Client → server | `draft.unsubscribe` | `draftPublicId` | Stops presence tracking for that socket. |
| Client → server | `draft.presence.update` | `draftPublicId`, `activity` (`viewing` or `editing`) | Renews presence and updates the member activity. |
| Server → client | `draft.presence.snapshot` | `draftPublicId`, `members` | Authoritative online-member list; each member contains `user`, `activity`, and `lastSeenAt`. |
| Server → client | `draft.collaborators.updated` | `draftPublicId`, collaborator metadata | Signals collaborator/access changes without replacing local draft content. |

Connections resubscribe to the active draft after reconnect. A user with multiple open windows appears once; their activity is `editing` while any active window reports unsaved editing, otherwise `viewing`.

### Draft Reconciliation

`baseRevision` optimistic locking remains authoritative for persisted draft writes. On `draft.updated`, clients without local changes load the current revision. Clients with local changes retain their workspace, mark it stale, and must either load the latest revision or save the workspace as a new draft. Comment, collaborator, review, and presence events refresh only their relevant metadata; they never overwrite locally edited draft state.

Broadcast events:

| Event | Trigger |
| --- | --- |
| `question.created` | Question created |
| `question.updated` | Question updated |
| `question.deleted` | Question deleted |
| `paper.created` | Paper created manually or by generation |
| `paper.updated` | Paper metadata updated |
| `paper.questions.added` | Questions added to paper |
| `paper.question.removed` | Question removed from paper |
| `paper.questions.reordered` | Paper question order changed |
| `draft.updated` | Shared draft created, content changed, collaborator changed, or draft metadata changed |
| `draft.deleted` | Shared draft deleted |
| `draft.review.updated` | Shared draft review status changed |
| `draft.comment.created` | Shared draft comment added |
| `draft.comment.updated` | Shared draft comment edited or resolved |
| `draft.presence.snapshot` | Authoritative online draft-member snapshot |
| `draft.collaborators.updated` | Shared draft collaborator or access change |

## Health and Root

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| `GET` | `/` | none | Service info: `{ "service": "TestPaper Backend", "version": "1.0.0" }` |
| `GET` | `/api/v1/health/postgres` | none | PostgreSQL health check |
| `GET` | `/api/v1/health/redis` | none | Redis health check |

Health checks return `status=connected` and `latencyMs` on success. Failures return HTTP `503` with `data.status=disconnected`. Development may include diagnostic details; production hides low-level internals.

## Data Model Quick Reference

```typescript
type Permission =
  | 'questions:read'
  | 'questions:write'
  | 'questions:delete'
  | 'answers:read'
  | 'papers:read'
  | 'papers:write'
  | 'users:manage'

interface UserEntity {
  id: number
  publicId: string
  username: string
  displayName: string
  role: 'admin' | 'teacher' | 'viewer'
  permissions: Permission[]
  isActive: boolean
  avatarUrl: string | null
  createdAt: string
  updatedAt: string
}

interface QuestionEntity {
  id: number
  publicId: string
  type: 'single_choice' | 'multiple_choice' | 'true_false' | 'blank' | 'short_answer' | 'essay'
  subjects: string[]
  difficulty: 'easy' | 'medium' | 'hard'
  tags: string[]
  text: string
  options: string[] | null
  answer?: string | string[]
  hasLatex: boolean | null
  source: string | null
  essayBlankSpace: { lines: number; lineHeight: number } | null
  images: { url: string; caption?: string | null }[]
  scoreWeight: number
  ownerId: number | null
  createdAt: string
  updatedAt: string
}

interface QuestionRef {
  questionPublicId: string
  orderNo: number
  marks?: number | null
}

interface PaperEntity {
  id: number
  publicId: string
  title: string
  subject: string
  duration: number
  totalMarks: number
  ownerId: number | null
  questions: QuestionRef[]
  status: 'draft' | 'published'
  createdAt: string
  updatedAt: string
}

interface AuthSession {
  expiresAt: string
  user: UserEntity
}

interface ImageUploadResponse {
  url: string
  filename: string
  mimeType: string
}

type DraftAccessRole = 'owner' | 'admin' | 'editor' | 'viewer'
type DraftCollaboratorRole = 'viewer' | 'editor'
type DraftCommentStatus = 'open' | 'resolved'
type DraftReviewStatus = 'draft' | 'in_review' | 'changes_requested' | 'approved'

interface DraftUserRef {
  publicId: string
  username: string
  displayName: string
}

interface PaperDraftCollaboratorEntity {
  user: DraftUserRef
  role: DraftCollaboratorRole
  createdAt: string
  updatedAt: string
}

interface PaperDraftCommentEntity {
  id: number
  publicId: string
  questionPublicId?: string | null
  message: string
  status: DraftCommentStatus
  author?: DraftUserRef | null
  createdAt: string
  updatedAt: string
}

interface PaperDraftSummary {
  id: number
  publicId: string
  name: string
  owner: DraftUserRef | null
  accessRole: DraftAccessRole
  reviewStatus: DraftReviewStatus
  revision: number
  collaboratorCount: number
  commentCount: number
  openCommentCount: number
  updatedBy: DraftUserRef | null
  createdAt: string
  updatedAt: string
}

interface PaperDraftDetail extends PaperDraftSummary {
  state: Record<string, unknown>
  collaborators: PaperDraftCollaboratorEntity[]
  comments: PaperDraftCommentEntity[]
}
```

## Common Error Codes

| HTTP | Code | Meaning |
| --- | --- | --- |
| 400 | `USERNAME_CHANGE_TOO_SOON` | Username was changed within the 30-day window |
| 401 | `UNAUTHORIZED` | Missing authentication |
| 401 | `INVALID_TOKEN` | Invalid token |
| 401 | `TOKEN_EXPIRED` | Expired token |
| 401 | `INVALID_CREDENTIALS` | Username or password is incorrect |
| 401 | `INVALID_PASSWORD` | Current password is incorrect |
| 401 | `ACCOUNT_DISABLED` | Account is disabled |
| 403 | `FORBIDDEN` | Insufficient permission |
| 403 | `CSRF_MISSING` | Missing CSRF token |
| 403 | `CSRF_MISMATCH` | CSRF token mismatch |
| 404 | `QUESTION_NOT_FOUND` | Question does not exist |
| 404 | `PAPER_NOT_FOUND` | Paper does not exist |
| 404 | `USER_NOT_FOUND` | User does not exist |
| 404 | `CORRECTION_NOT_FOUND` | Correction does not exist |
| 404 | `REVISION_NOT_FOUND` | Revision does not exist |
| 404 | `DRAFT_NOT_FOUND` | Draft does not exist or is not accessible |
| 404 | `COLLABORATOR_NOT_FOUND` | Draft collaborator does not exist |
| 404 | `COMMENT_NOT_FOUND` | Draft comment does not exist |
| 404 | `BANK_NOT_FOUND` | Bank does not exist or is not accessible |
| 404 | `BANK_VERSION_NOT_FOUND` | Bank version does not exist |
| 404 | `BANK_SUBSCRIPTION_NOT_FOUND` | Caller has no subscription to the bank |
| 404 | `BANK_ITEM_NOT_FOUND` | Question is not in the bank |
| 404 | `MEMBER_NOT_FOUND` | Bank member does not exist |
| 409 | `QUESTION_ALREADY_IN_PAPER` | Question already belongs to the paper |
| 409 | `DRAFT_REVISION_CONFLICT` | Shared draft `baseRevision` is stale |
| 409 | `USER_ALREADY_EXISTS` | Username already exists |
| 409 | `BANK_ITEM_EXISTS` | One or more questions already exist in the bank |
| 409 | `BANK_ALREADY_PUBLISHED` | Bank is already published; withdraw before publishing again |
| 409 | `BANK_NOT_PUBLISHED` | Bank is not published or has no version to fork |
| 409 | `BANK_VERSION_NOT_ACTIVE` | Only the current active publication can be selected for a subscription |
| 413 | `PAYLOAD_TOO_LARGE` | Upload exceeds size limit |
| 422 | `DRAFT_OPEN_COMMENTS` | Shared draft cannot be approved until open comments are resolved |
| 422 | `BANK_PUBLISH_EMPTY` | Bank must contain at least one question before publishing |
| 422 | `BANK_SUBSCRIBE_PRIVATE` | Private banks cannot be subscribed |
| 422 | `BANK_OWNER_CANNOT_BE_MEMBER` | Bank owner cannot be added as a member |
| 422 | `BANK_MEMBER_EXISTS` | User is already a member of the bank |
| 422 | `VALIDATION_ERROR` | Request validation failed |
| 422 | `INSUFFICIENT_QUESTIONS` | Auto-generation has too few candidates |
| 429 | `RATE_LIMIT_EXCEEDED` | Too many requests |
| 500 | `INTERNAL_ERROR` | Server error |
| 503 | health failure | Dependency is unavailable |

## Endpoint Index

| Method | Path | Permission | Description |
| --- | --- | --- | --- |
| `GET` | `/` | none | Service info |
| `POST` | `/api/v1/auth/login` | none | Login |
| `POST` | `/api/v1/auth/register` | none | Register and login |
| `POST` | `/api/v1/auth/token` | none | Native login (Bearer token pair) |
| `POST` | `/api/v1/auth/token/refresh` | none | Rotate native refresh token |
| `GET` | `/api/v1/auth/devices` | logged in | List device sessions |
| `DELETE` | `/api/v1/auth/devices/{device_id}` | logged in | Revoke a device |
| `GET` | `/api/v1/auth/me` | logged in | Current user |
| `POST` | `/api/v1/auth/refresh` | logged in | Refresh session |
| `POST` | `/api/v1/auth/logout` | logged in | Logout |
| `PATCH` | `/api/v1/auth/profile` | logged in | Update profile |
| `PUT` | `/api/v1/auth/password` | logged in | Change password |
| `POST` | `/api/v1/auth/avatar` | logged in | Upload avatar |
| `DELETE` | `/api/v1/auth/account` | logged in | Delete account |
| `WS` | `/api/v1/ws` | logged in | Realtime events |
| `GET` | `/api/v1/users` | `users:manage` | List users |
| `POST` | `/api/v1/users` | `users:manage` | Create user |
| `PATCH` | `/api/v1/users/{user_public_id}` | `users:manage` | Update user |
| `DELETE` | `/api/v1/users/{user_public_id}` | `users:manage` | Delete user |
| `GET` | `/api/v1/meta/subjects` | `questions:read` | Subjects |
| `GET` | `/api/v1/meta/tags` | `questions:read` | Tags |
| `POST` | `/api/v1/images/upload` | `questions:write` | Upload question image |
| `GET` | `/api/v1/questions` | `questions:read` | List questions |
| `GET` | `/api/v1/questions/mine` | `questions:read` | My questions |
| `GET` | `/api/v1/questions/{question_public_id}` | `questions:read` | Question detail |
| `POST` | `/api/v1/questions` | `questions:write` | Create question |
| `PATCH` | `/api/v1/questions/{question_public_id}` | `questions:write` | Update question |
| `DELETE` | `/api/v1/questions/{question_public_id}` | `questions:delete` | Delete question |
| `GET` | `/api/v1/questions/{question_public_id}/revisions` | `questions:read` | List revisions |
| `DELETE` | `/api/v1/questions/{question_public_id}/revisions/{revision_id}` | `questions:delete` | Delete revision |
| `POST` | `/api/v1/questions/{question_public_id}/corrections` | `questions:read` | Create correction |
| `GET` | `/api/v1/questions/{question_public_id}/corrections` | `questions:read` | List corrections |
| `PATCH` | `/api/v1/questions/{question_public_id}/corrections/{correction_id}` | `questions:write` | Update correction status |
| `DELETE` | `/api/v1/questions/{question_public_id}/corrections/{correction_id}` | `questions:delete` | Delete correction |
| `POST` | `/api/v1/papers` | `papers:write` | Create paper |
| `POST` | `/api/v1/papers/generate` | `papers:write` | Generate paper |
| `GET` | `/api/v1/papers/{paper_public_id}` | `papers:read` | Paper detail |
| `PATCH` | `/api/v1/papers/{paper_public_id}` | `papers:write` | Update paper |
| `POST` | `/api/v1/papers/{paper_public_id}/questions` | `papers:write` | Add questions |
| `DELETE` | `/api/v1/papers/{paper_public_id}/questions/{question_public_id}` | `papers:write` | Remove question |
| `PUT` | `/api/v1/papers/{paper_public_id}/questions/order` | `papers:write` | Reorder questions |
| `PUT` | `/api/v1/papers/{paper_public_id}/questions` | `papers:write` | Replace all paper questions |
| `POST` | `/api/v1/papers/{paper_public_id}/export-preview` | `papers:read` | Export preview |
| `GET` | `/api/v1/papers/{paper_public_id}/download` | `papers:read` | Download DOCX |
| `POST` | `/api/v1/papers/draft-download` | `papers:read` | Download DOCX from an unsaved draft |
| `GET` | `/api/v1/drafts` | `papers:read` | List shared drafts |
| `POST` | `/api/v1/drafts` | `papers:write` | Create shared draft |
| `GET` | `/api/v1/drafts/{draft_public_id}` | `papers:read` | Shared draft detail |
| `PATCH` | `/api/v1/drafts/{draft_public_id}` | draft access | Update shared draft |
| `DELETE` | `/api/v1/drafts/{draft_public_id}` | owner/admin draft role | Delete shared draft |
| `POST` | `/api/v1/drafts/{draft_public_id}/collaborators` | owner/admin draft role | Add or update draft collaborator |
| `PATCH` | `/api/v1/drafts/{draft_public_id}/collaborators/{user_public_id}` | owner/admin draft role | Update draft collaborator |
| `DELETE` | `/api/v1/drafts/{draft_public_id}/collaborators/{user_public_id}` | owner/admin draft role | Remove draft collaborator |
| `POST` | `/api/v1/drafts/{draft_public_id}/comments` | draft access | Add draft comment |
| `PATCH` | `/api/v1/drafts/{draft_public_id}/comments/{comment_public_id}` | draft access | Update draft comment |
| `GET` | `/api/v1/drafts/{draft_public_id}/download` | `papers:read` | Download DOCX from a cloud draft |
| `GET` | `/api/v1/public/banks` | none | Discover active public bank snapshots |
| `GET` | `/api/v1/public/banks/{bank_public_id}` | none | Read an active public bank snapshot |
| `GET` | `/api/v1/banks` | authenticated | List question banks |
| `POST` | `/api/v1/banks` | `banks:write` | Create question bank |
| `GET` | `/api/v1/banks/{bank_public_id}` | bank read access | Question bank detail |
| `PATCH` | `/api/v1/banks/{bank_public_id}` | owner/admin bank role | Update question bank |
| `DELETE` | `/api/v1/banks/{bank_public_id}` | `banks:delete` plus owner/admin bank role | Delete question bank |
| `GET` | `/api/v1/banks/{bank_public_id}/questions` | bank read access | List bank questions |
| `POST` | `/api/v1/banks/{bank_public_id}/items` | owner/admin/editor bank role | Add questions to bank |
| `DELETE` | `/api/v1/banks/{bank_public_id}/items/{question_public_id}` | owner/admin/editor bank role | Remove question from bank |
| `POST` | `/api/v1/banks/{bank_public_id}/members` | owner/admin bank role | Add bank member |
| `PATCH` | `/api/v1/banks/{bank_public_id}/members/{user_public_id}` | owner/admin bank role | Update bank member role |
| `DELETE` | `/api/v1/banks/{bank_public_id}/members/{user_public_id}` | owner/admin bank role | Remove bank member |
| `POST` | `/api/v1/banks/{bank_public_id}/publish` | `banks:publish` plus owner/admin bank role | Publish bank version |
| `POST` | `/api/v1/banks/{bank_public_id}/withdraw` | `banks:publish` plus owner/admin bank role | Withdraw bank |
| `GET` | `/api/v1/banks/{bank_public_id}/versions` | bank read access | List bank versions |
| `GET` | `/api/v1/banks/{bank_public_id}/versions/{version}` | bank read access | Bank version snapshot |
| `POST` | `/api/v1/banks/{bank_public_id}/fork` | bank read access | Fork bank |
| `POST` | `/api/v1/banks/{bank_public_id}/subscribe` | authenticated | Subscribe to bank |
| `PATCH` | `/api/v1/banks/{bank_public_id}/subscribe` | authenticated | Advance pinned subscription to active version |
| `DELETE` | `/api/v1/banks/{bank_public_id}/subscribe` | authenticated | Unsubscribe from bank |
| `POST` | `/api/v1/tasks/ping` | `questions:read` | Worker check |
| `GET` | `/api/v1/tasks/{task_id}` | `questions:read` | Task status |
| `POST` | `/api/v1/tasks/export-paper/{paper_public_id}` | `papers:read` | Async export |
| `POST` | `/api/v1/tasks/validate-questions` | `questions:read` | Validate all questions |
| `POST` | `/api/v1/tasks/validate-question/{question_public_id}` | `questions:read` | Validate one question |
| `POST` | `/api/v1/tasks/cleanup-expired-sessions` | `users:manage` | Cleanup sessions |
| `POST` | `/api/v1/tasks/stats/questions` | `questions:read` | Question stats |
| `GET` | `/api/v1/health/postgres` | none | PostgreSQL health |
| `GET` | `/api/v1/health/redis` | none | Redis health |
