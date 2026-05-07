# TestPapers API Spec (v2 draft)

> Scope: align the backend contract with the current Nuxt frontend.
>
> Current frontend status:
> - The app uses a unified `Workspace` page instead of separate `questions` and `papers` pages.
> - Question data is currently stored in browser `localStorage`, not fetched from HTTP APIs yet.
> - This document defines the target backend API that can replace the current local cache model later.

## 1. Conventions

- Protocol: `HTTPS`
- Base URL: `/api/v1`
- Content-Type: `application/json; charset=utf-8`
- Time format: `ISO 8601` UTC
- Field naming: `camelCase`
- Auth: `Authorization: Bearer <token>` if authentication is enabled

### 1.1 Response format

Success:

```json
{
  "success": true,
  "data": {},
  "meta": {
    "requestId": "req-001"
  }
}
```

Failure:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": [
      {
        "field": "difficulty",
        "reason": "must be one of: easy, medium, hard"
      }
    ]
  },
  "meta": {
    "requestId": "req-001"
  }
}
```

### 1.2 Pagination and sorting

- Pagination params: `page`, `pageSize`
- Sorting params: `sortBy`, `sortOrder`
- Recommended default sort: `createdAt desc`, then `id desc`

## 2. Frontend-aligned data model

### 2.1 Question

Matches the current frontend model in [useQuestionBank.ts](/D:/TestPaper/TestPapers/app/composables/useQuestionBank.ts:1).

```ts
interface EssayBlankSpace {
  lines: number
  lineHeight: number
}

interface Question {
  id: number
  type: 'choice' | 'blank' | 'essay'
  subject: string
  difficulty: 'easy' | 'medium' | 'hard'
  tags: string[]
  text: string
  options?: string[]
  answer: string
  hasLatex: boolean
  source?: string
  essayBlankSpace?: EssayBlankSpace
}
```

Rules:

- `type='choice'` requires `options`.
- `type='blank' | 'essay'` should omit `options`.
- `type='essay'` should include `essayBlankSpace` so export previews can reserve the intended writing area.
- `essayBlankSpace.lines` defines the number of writing lines; `essayBlankSpace.lineHeight` defines the pixel height per line.
- `hasLatex` may be computed by the backend from `text`, `answer`, and `options`.
- `source` is optional.

Recommended persisted backend shape:

```ts
interface QuestionEntity extends Question {
  createdAt: string
  updatedAt: string
}
```

### 2.2 Workspace paper draft

Matches the current right-side builder state in [QuestionWorkspace.vue](/D:/TestPaper/TestPapers/app/components/QuestionWorkspace.vue:202).

```ts
interface PaperDraft {
  title: string
  subject: string
  duration: number
  totalMarks: number
  questions: Question[]
}
```

Note:

- The current frontend stores full `Question` objects in the builder, not `questionId` references.
- A backend API should still normalize this into question references for persistence.

### 2.3 Optional persisted paper model

```ts
interface Paper {
  id: number
  title: string
  subject: string
  duration: number
  totalMarks: number
  questions: PaperQuestion[]
  status: 'draft' | 'published'
  createdAt: string
  updatedAt: string
}

interface PaperQuestion {
  questionId: number
  orderNo: number
  marks?: number
}
```

## 3. Current frontend storage behavior

The frontend currently uses browser cache instead of HTTP:

- Storage key: `testpapers-question-bank`
- Load source:
  - cached questions from `localStorage`
  - fallback to built-in sample questions
- Question creation:
  - adds a new question locally
  - auto-generates `id`
  - persists back to `localStorage`

Relevant implementation:

- [useQuestionBank.ts](/D:/TestPaper/TestPapers/app/composables/useQuestionBank.ts:14)
- [add-problem.vue](/D:/TestPaper/TestPapers/app/pages/add-problem.vue:214)
- [QuestionWorkspace.vue](/D:/TestPaper/TestPapers/app/components/QuestionWorkspace.vue:3)

This means the backend API below is a target contract, not a currently consumed one.

## 4. Questions API

### 4.1 List questions

- `GET /api/v1/questions`

Use cases:

- Workspace search
- Subject filter
- Difficulty filter

Query params:

- `q`: matches `text`, `subject`, `answer`, `tags`
- `subject`
- `difficulty`: `easy | medium | hard`
- `type`: `choice | blank | essay`
- `tags`: comma-separated list
- `hasLatex`: `true | false`
- `includeAnswer`: `true | false`, default `true` for trusted authoring UI, `false` for public exam clients
- `page`
- `pageSize`
- `sortBy`
- `sortOrder`

Example:

`GET /api/v1/questions?q=calculus&subject=Mathematics&difficulty=hard`

### 4.2 Get question detail

- `GET /api/v1/questions/{id}`

Query params:

- `includeAnswer=true|false`

### 4.3 Create question

- `POST /api/v1/questions`

Maps to the form in [add-problem.vue](/D:/TestPaper/TestPapers/app/pages/add-problem.vue:1).

Request example:

```json
{
  "type": "essay",
  "subject": "Physics",
  "difficulty": "medium",
  "tags": ["mechanics"],
  "text": "Explain how $F = ma$ relates force, mass, and acceleration.",
  "answer": "Force equals mass multiplied by acceleration.",
  "source": "Chapter 2, Review",
  "essayBlankSpace": {
    "lines": 6,
    "lineHeight": 28
  }
}
```

Response:

- `201 Created`

Recommended behavior:

- backend computes `hasLatex`
- backend returns the stored `QuestionEntity`

### 4.4 Update question

- `PATCH /api/v1/questions/{id}`

Supports partial updates.

### 4.5 Delete question

- `DELETE /api/v1/questions/{id}`

Response:

- `204 No Content`

## 5. Papers API

These APIs are optional today because the current builder is local-only, but they define the backend contract if paper persistence is added.

### 5.1 Create paper

- `POST /api/v1/papers`

Request example:

```json
{
  "title": "Mid-term Examination 2026",
  "subject": "Mathematics",
  "duration": 60,
  "totalMarks": 100,
  "questions": [
    { "questionId": 1, "orderNo": 1 },
    { "questionId": 4, "orderNo": 2 }
  ]
}
```

Response:

- `201 Created`

### 5.2 Get paper detail

- `GET /api/v1/papers/{id}`

Query params:

- `expand=questions`
- `includeAnswer=true|false`

### 5.3 Update paper metadata

- `PATCH /api/v1/papers/{id}`

Supported fields:

- `title`
- `subject`
- `duration`
- `totalMarks`
- `status`

### 5.4 Add, remove, and reorder paper questions

- `POST /api/v1/papers/{id}/questions`
- `DELETE /api/v1/papers/{id}/questions/{questionId}`
- `PUT /api/v1/papers/{id}/questions/order`

Reorder request:

```json
{
  "orders": [
    { "questionId": 4, "orderNo": 1 },
    { "questionId": 1, "orderNo": 2 }
  ]
}
```

### 5.5 Export preview

- `POST /api/v1/papers/{id}/export-preview`

Request:

```json
{
  "format": "json",
  "includeAnswer": false,
  "questionOrder": "paper"
}
```

`questionOrder` may be `paper` or `categorized`. `categorized` groups questions in forward section order: multiple-choice, fill-in-the-blank, then essay. Within each section, questions keep their paper-builder order.

Recommended response payload:

```json
{
  "paper": {},
  "questions": [],
  "renderHint": {
    "format": "json",
    "questionOrder": "paper"
  }
}
```

## 6. Meta API

Recommended helper endpoints:

- `GET /api/v1/meta/subjects`
- `GET /api/v1/meta/tags`

These can replace frontend-derived filter values later.

## 7. Error codes

- `400 BAD_REQUEST`: `INVALID_QUERY_PARAM`
- `401 UNAUTHORIZED`: `UNAUTHORIZED`
- `403 FORBIDDEN`: `FORBIDDEN`
- `404 NOT_FOUND`: `QUESTION_NOT_FOUND`, `PAPER_NOT_FOUND`
- `409 CONFLICT`: `QUESTION_ALREADY_IN_PAPER`, `PAPER_VERSION_CONFLICT`
- `422 UNPROCESSABLE_ENTITY`: `VALIDATION_ERROR`
- `429 TOO_MANY_REQUESTS`: `RATE_LIMITED`
- `500 INTERNAL_SERVER_ERROR`: `INTERNAL_ERROR`

## 8. Page-to-API mapping

- [questions.vue](/D:/TestPaper/TestPapers/app/pages/questions.vue:1)
  - page role: unified workspace
  - target APIs:
    - `GET /api/v1/questions`
    - optional paper APIs if server persistence is added

- [add-problem.vue](/D:/TestPaper/TestPapers/app/pages/add-problem.vue:1)
  - page role: create question
  - target API:
    - `POST /api/v1/questions`

- [QuestionWorkspace.vue](/D:/TestPaper/TestPapers/app/components/QuestionWorkspace.vue:1)
  - UI role:
    - search/filter question bank
    - inspect answers
    - assemble local paper draft
  - target APIs:
    - `GET /api/v1/questions`
    - optional `POST/PATCH /api/v1/papers`
    - optional question ordering endpoints

## 9. Versioning

- Current spec version: `v2 draft`
- URL versioning: `/api/v1`
- Non-breaking changes:
  - adding optional fields
  - adding new endpoints
- Breaking changes:
  - removing fields
  - changing enum values
  - changing response structure

## 10. Notes for implementation

- The current frontend expects full question content including `answer`.
- If the backend later restricts answer visibility, the workspace client must distinguish authoring mode from exam delivery mode.
- If paper persistence is introduced, the frontend should move builder state out of component-local reactive state and into an API-backed store.
