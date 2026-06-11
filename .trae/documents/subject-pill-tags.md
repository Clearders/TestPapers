# Subject Pill Tags — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the auto-generate Subject text input+datalist with multi-select pill/chip buttons, supporting multiple subjects per paper generation.

**Architecture:** Replace the `<input>`+`<datalist>` with clickable chip buttons (`gen-subject-chip`) styled like the existing Tag Filters chips. Change `generationForm.subject` (string) to `generationForm.subjects` (string[]). Update the backend `PaperGenerateRequest` and `build_generation_candidates()` to accept `subjects: string[]` with `WHERE subject IN (...)`.

**Tech Stack:** Vue 3 + TypeScript (frontend), Python FastAPI + SQLAlchemy (backend)

**Affected files:**
- Modify: [QuestionWorkspace.vue](file:///d:/TestPaper/TestPapers/app/components/QuestionWorkspace.vue) — template, script, style
- Modify: [paper_generation.py](file:///d:/TestPaper/TestPaper-backend/testpaper_backend/services/paper_generation.py) — `build_generation_candidates()`
- Modify: [schemas.py](file:///d:/TestPaper/TestPaper-backend/testpaper_backend/schemas.py) — `PaperGenerateRequest`

---

## Current State Analysis

**Frontend** — Subject field at [QuestionWorkspace.vue L115-128](file:///d:/TestPaper/TestPapers/app/components/QuestionWorkspace.vue#L116-L128):

```html
<div class="gen-field">
  <label class="form-label" htmlFor="gen-subject-input">Subject</label>
  <input
    id="gen-subject-input"
    v-model="generationForm.subject"
    class="form-input"
    list="gen-subjects"
    placeholder="e.g. Mathematics…"
  />
  <datalist id="gen-subjects">
    <option v-for="subject in availableSubjects" :key="subject" :value="subject" />
  </datalist>
</div>
```

State at L591:
```ts
const generationForm = reactive<GenerationFormState>({
  ...
  subject: '',
  ...
})
```

Type at L511:
```ts
interface GenerationFormState {
  ...
  subject: string
  ...
}
```

Disabled check at L248:
```html
:disabled="isGenerating || !generationForm.subject.trim() || !paper.title.trim() || !generationForm.questionTypes.length"
```

Payload builder at L866-880:
```ts
const subject = generationForm.subject.trim()
// ...uses subject as string in payload.subject
return {
  ...
  subject,
  ...
}
```

**Backend** — currently accepts single `subject: str`:

`schemas.py` PaperGenerateRequest has `subject: str`.
`paper_generation.py:118-119` uses:
```python
statement = select(QuestionRow).where(
    func.lower(func.trim(QuestionRow.subject)) == subject.lower(),
)
```

---

## Proposed Changes

### Task 1: Update backend schema — subject → subjects array

**File:** `testpaper_backend/schemas.py`

Change `PaperGenerateRequest.subject` from `str` to `list[str]`:

```python
class PaperGenerateRequest(BaseModel):
    # ... existing fields ...
    subjects: list[str] = Field(default_factory=list, min_length=1)
    # ...
```

### Task 2: Update backend generation service — IN clause

**File:** `testpaper_backend/services/paper_generation.py:115-149`

Change `build_generation_candidates()` to accept and query multiple subjects:

```python
def build_generation_candidates(payload: PaperGenerateRequest, owner_id: int | None = None):
    subjects = [s.strip().lower() for s in payload.subjects if s.strip()]
    if not subjects:
        raise ValueError("At least one subject is required")
    selected_types = {t.questionType for t in payload.questionTypes}
    statement = select(QuestionRow).where(
        func.lower(func.trim(QuestionRow.subject)).in_(subjects),
    )
    if selected_types:
        statement = statement.where(QuestionRow.type.in_(selected_types))
    if owner_id is not None:
        statement = statement.where(QuestionRow.ownerId == owner_id)
    # ... rest unchanged
```

### Task 3: Update frontend state — GenerationFormState

**File:** `app/components/QuestionWorkspace.vue:511-522`

Change `subject: string` → `subjects: string[]`:

```ts
interface GenerationFormState {
  difficultyCoefficient: number
  questionTypes: QuestionType[]
  typeCounts: Record<string, number>
  subjects: string[]
  requiredTagsStr: string
  requiredTags: string[]
  preferredTagsStr: string
  preferredTags: string[]
  customTagInput: string
}
```

Update default value at L591:

```ts
const generationForm = reactive<GenerationFormState>({
  difficultyCoefficient: 0.5,
  questionTypes: ['single_choice'],
  typeCounts: { single_choice: 5 },
  subjects: [],
  requiredTagsStr: '',
  requiredTags: [],
  preferredTagsStr: '',
  preferredTags: [],
  customTagInput: ''
})
```

### Task 4: Update frontend template — input+datalist → pill chips

**File:** `app/components/QuestionWorkspace.vue:115-128`

Replace the input/datalist block:

```html
<div class="gen-field">
  <label class="form-label">Subjects</label>
  <div v-if="availableSubjects.length" class="gen-subject-pool">
    <button
      v-for="subject in availableSubjects"
      :key="subject"
      type="button"
      class="gen-subject-chip"
      :class="{ 'gen-subject-chip--active': generationForm.subjects.includes(subject) }"
      @click="toggleSubject(subject)"
    >{{ subject }}</button>
  </div>
  <div v-else-if="isLoadingMeta" class="gen-subject-loading" aria-live="polite">
    Loading subjects…
  </div>
  <p v-else class="form-hint">No subjects available. Create questions with subjects first.</p>
</div>
```

### Task 5: Add frontend toggle logic

**File:** `app/components/QuestionWorkspace.vue` — add after `toggleQuestionType()` (around L1030)

```ts
function toggleSubject (subject: string) {
  const index = generationForm.subjects.indexOf(subject)
  if (index === -1) {
    generationForm.subjects = [...generationForm.subjects, subject]
  } else {
    generationForm.subjects = generationForm.subjects.filter(s => s !== subject)
  }
}
```

### Task 6: Update disabled check and payload builder

**File:** `app/components/QuestionWorkspace.vue`

Disabled check at L248 — change `generationForm.subject.trim()` → `generationForm.subjects.length`:

```html
:disabled="isGenerating || !generationForm.subjects.length || !paper.title.trim() || !generationForm.questionTypes.length"
```

Payload builder at L866 — change single subject → array:

```ts
function buildPaperGeneratePayload (): PaperGeneratePayload | null {
  if (!paper.title.trim() || !generationForm.subjects.length) {
    generationError.value = 'Please enter a paper title and select at least one subject.'
    return null
  }

  return {
    title: paper.title.trim(),
    subjects: [...generationForm.subjects],
    duration: toPositiveInteger(paper.duration, DEFAULT_PAPER.duration),
    totalMarks: toPositiveInteger(paper.totalMarks, DEFAULT_PAPER.totalMarks),
    difficultyCoefficient: toBoundedNumber(generationForm.difficultyCoefficient, 0.5, 0, 1),
    questionTypes: generationForm.questionTypes.map(type => ({
      questionType: type,
      count: generationForm.typeCounts[type] || 1
    })),
    ownQuestionsOnly: bankMode.value === 'mine',
    ...(generationForm.requiredTags.length ? { requiredTags: generationForm.requiredTags } : {}),
    ...(generationForm.preferredTags.length ? { preferredTags: generationForm.preferredTags } : {})
  }
}
```

Update `PaperGeneratePayload` interface at L496-502:

```ts
interface PaperGeneratePayload extends PaperMetadataPayload {
  difficultyCoefficient: number
  questionTypes: Array<{ questionType: QuestionType; count: number }>
  ownQuestionsOnly: boolean
  subjects: string[]
  requiredTags?: string[]
  preferredTags?: string[]
}
```

### Task 7: Add CSS styles for subject chips

**File:** `app/components/QuestionWorkspace.vue` — add after `.gen-tag-chip` styles:

```css
.gen-subject-pool {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  max-height: 140px;
  overflow-y: auto;
  padding: 2px 0;
}
.gen-subject-chip {
  display: inline-flex;
  align-items: center;
  padding: 3px 10px;
  border-radius: 999px;
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  font-size: .78rem;
  font-weight: 500;
  color: var(--color-muted);
  cursor: pointer;
  transition: border-color 0.2s ease, color 0.2s ease, background 0.2s ease;
}
.gen-subject-chip:hover {
  color: var(--color-text);
  border-color: var(--color-primary);
  background: rgba(79, 110, 247, 0.04);
}
.gen-subject-chip--active {
  border-color: var(--color-primary);
  background: rgba(79, 110, 247, 0.08);
  color: var(--color-primary);
  font-weight: 600;
}
.gen-subject-loading {
  font-size: .82rem;
  color: var(--color-muted);
  padding: 8px 0;
}
```

### Task 8: Verify — frontend build

Run `npm run check` in `d:\TestPaper\TestPapers`, verify exit code 0.

### Task 9: Verify — backend (optional, check syntax)

Run `python -m py_compile testpaper_backend/services/paper_generation.py testpaper_backend/schemas.py` to verify no syntax errors.

---

## Assumptions & Decisions

1. **Multi-select pills**: User explicitly chose multi-select. Each click toggles a subject on/off. This aligns with existing Tag Filters chip pattern in the same component.

2. **No custom input**: User chose not to keep a custom text input — only backend-sourced subjects via `/meta/subjects`.

3. **Reuse existing chip style**: `.gen-subject-chip` mirrors `.gen-tag-chip` CSS pattern — same border radius (999px), same size (.78rem), same transition properties. Active state uses primary blue with left accent removed (pills don't need left border).

4. **Backend IN clause**: `WHERE subject IN (...)` replaces `WHERE subject = ...`. Multiple subjects mean the generated paper draws from all selected subjects' question pools. This is semantically correct for multi-subject paper composition.

5. **Frontend label changes from "Subject" to "Subjects"**: Reflects multi-select nature.

6. **`availableSubjects` already fetched**: The existing `loadMeta()` call fetches subjects — no new API call needed. Empty state handled gracefully.

7. **`toggleSubject()`** analogous to `toggleTag()` and `toggleQuestionType()` — follows existing patterns.

---

## Verification

1. Run `npm run check` — frontend build must succeed
2. Visual check: All available subjects rendered as pill chips
3. Click toggle: Selected chips turn primary blue, ✓ not needed (already clear from visual distinction)
4. Multi-select: Multiple subjects can be selected simultaneously
5. Disabled button: Generate button disabled when no subjects selected
6. Payload: Check browser network tab — payload sends `subjects: ["Mathematics", "Physics"]` array
7. Backend compilation: `py_compile` passes with no errors
