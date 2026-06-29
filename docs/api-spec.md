# TestPapers API Reference

> Version: v10  
> Backend: FastAPI 0.136 / Python 3.14+  
> Frontend: Nuxt 4.4 / TypeScript  
> Last updated: 2026-06-28

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
| `admin` | `questions:read`, `questions:write`, `questions:delete`, `answers:read`, `papers:read`, `papers:write`, `users:manage` |
| `teacher` | `questions:read`, `questions:write`, `questions:delete`, `answers:read`, `papers:read`, `papers:write` |
| `viewer` | `questions:read`, `papers:read` |

`answers:read` controls whether answers are included in question, paper, revision, export preview, and DOCX responses. Passing `includeAnswer=true` does not override this permission.

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

`PaperUpdate` supports `title`, `subject`, `duration`, `totalMarks`, and `status`. `status` is `draft` or `published`; explicit `null` values are rejected.

Question order body:

```json
{
  "orders": [
    { "questionPublicId": "550e8400-e29b-41d4-a716-446655440000", "orderNo": 1 }
  ]
}
```

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
| 409 | `QUESTION_ALREADY_IN_PAPER` | Question already belongs to the paper |
| 409 | `USER_ALREADY_EXISTS` | Username already exists |
| 413 | `PAYLOAD_TOO_LARGE` | Upload exceeds size limit |
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
| `POST` | `/api/v1/papers/{paper_public_id}/export-preview` | `papers:read` | Export preview |
| `GET` | `/api/v1/papers/{paper_public_id}/download` | `papers:read` | Download DOCX |
| `POST` | `/api/v1/papers/draft-download` | `papers:read` | Download DOCX from an unsaved draft |
| `POST` | `/api/v1/tasks/ping` | `questions:read` | Worker check |
| `GET` | `/api/v1/tasks/{task_id}` | `questions:read` | Task status |
| `POST` | `/api/v1/tasks/export-paper/{paper_public_id}` | `papers:read` | Async export |
| `POST` | `/api/v1/tasks/validate-questions` | `questions:read` | Validate all questions |
| `POST` | `/api/v1/tasks/validate-question/{question_public_id}` | `questions:read` | Validate one question |
| `POST` | `/api/v1/tasks/cleanup-expired-sessions` | `users:manage` | Cleanup sessions |
| `POST` | `/api/v1/tasks/stats/questions` | `questions:read` | Question stats |
| `GET` | `/api/v1/health/postgres` | none | PostgreSQL health |
| `GET` | `/api/v1/health/redis` | none | Redis health |
