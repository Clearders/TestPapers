# Fix Question Type Wheel — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the non-standard custom wheel widget with a standard scrollable checkbox list for question type selection.

**Architecture:** Replace the custom `gen-wheel-*` vertical scroll emulator (JS-driven `transform`, `opacity`, `scale`, mouse-wheel-only interaction) with a standard `<div>` native scroll container containing toggle buttons. Use native CSS `overflow-y: auto` for scrolling, standard button `tabIndex`/`keydown` for keyboard accessibility, and remove all custom JS wheel/scaling logic.

**Tech Stack:** Vue 3 + TypeScript, scoped CSS

**Affected files:**
- Modify: [components/QuestionWorkspace.vue](file:///d:/TestPaper/TestPapers/app/components/QuestionWorkspace.vue) — template (lines 151-190), script (lines 589-619), style (lines 1306-1382)

---

## Current State Analysis

The question type selector is a custom "wheel" widget (`gen-wheel-*`) at lines 151-189 of QuestionWorkspace.vue:

```html
<div class="gen-wheel-outer" @wheel.prevent="scrollWheel($event)">
  <div class="gen-wheel-mask gen-wheel-mask--top"></div>
  <div class="gen-wheel-viewport" ref="wheelViewport">
    <div class="gen-wheel-track" :style="{ transform: `translateY(${wheelOffset}px)` }">
      <button v-for="(type, i) in QUESTION_TYPE_ORDER" ... />
    </div>
  </div>
  <div class="gen-wheel-mask gen-wheel-mask--bottom"></div>
</div>
```

**Non-standard behaviors (violations):**

| Issue | Detail |
|-------|--------|
| No touch support | Only `@wheel.prevent`, no `@touchmove`/drag |
| No keyboard | No arrow keys, Enter/Space toggle |
| No ARIA | Missing `role="listbox"`, `aria-selected` |
| JS-driven animation | `wheelItemStyle()` computes opacity/scale per item |
| Transform-based scroll | `wheelOffset` computed via `-(wheelIndex - WHEEL_HALF) * ITEM_HEIGHT` |
| Fake clip masks | `.gen-wheel-mask` divs with gradient faking a scroll fade |
| Center highlighting | `gen-wheel-item--center::before` with negative z-index hack |
| 3 visible items | VISIBLE_COUNT=3, everything else hidden with `opacity: 0` |

**JS logic to remove:**
- `ITEM_HEIGHT`, `VISIBLE_COUNT`, `WHEEL_HALF` constants (lines 590-592)
- `wheelViewport` ref (line 594)
- `wheelIndex` ref (line 595)
- `wheelCenterIndex` computed (line 597)
- `wheelOffset` computed (lines 599-601)
- `wheelItemStyle()` function (lines 603-614)
- `scrollWheel()` function (lines 616-619)

**CSS to remove:**
- `.gen-wheel-outer` (lines 1306-1312)
- `.gen-wheel-mask`, `.gen-wheel-mask--top`, `.gen-wheel-mask--bottom` (lines 1313-1330)
- `.gen-wheel-viewport` (lines 1331-1335)
- `.gen-wheel-track` (lines 1336-1341)
- `.gen-wheel-item`, `.gen-wheel-item:hover` (lines 1342-1356)
- `.gen-wheel-item--center`, `.gen-wheel-item--center::before` (lines 1358-1372)
- `.gen-wheel-item--active .gen-wheel-label` (lines 1373-1376)
- `.gen-wheel-item--active.gen-wheel-item--center .gen-wheel-label` (lines 1376-1379)
- `.gen-wheel-check` (lines 1380-1382)

---

## Proposed Changes

### Task 1: Replace template — wheel → standard scrollable button list

**File:** `app/components/QuestionWorkspace.vue:151-189`

Replace the `gen-wheel-outer` block with a standard scrollable toggle list:

```html
<div class="gen-field">
  <label class="form-label">Question Type</label>
  <div
    class="gen-type-list"
    role="listbox"
    aria-label="Question types"
    aria-multiselectable="true"
  >
    <button
      v-for="type in QUESTION_TYPE_ORDER"
      :key="type"
      type="button"
      class="gen-type-option"
      :class="{ 'gen-type-option--active': generationForm.questionTypes.includes(type) }"
      role="option"
      :aria-selected="generationForm.questionTypes.includes(type)"
      @click="toggleQuestionType(type)"
    >
      <span class="gen-type-option-label">{{ QUESTION_TYPE_LABELS[type] }}</span>
      <span v-if="generationForm.questionTypes.includes(type)" class="gen-type-option-check">✓</span>
    </button>
  </div>
  <div v-if="generationForm.questionTypes.length" class="gen-type-counts">
    <div v-for="type in generationForm.questionTypes" :key="type" class="gen-type-count-row">
      <span class="gen-type-count-label">{{ QUESTION_TYPE_LABELS[type] }}</span>
      <input
        v-model.number="generationForm.typeCounts[type]"
        class="gen-type-count-input"
        type="number"
        min="1"
      />
    </div>
  </div>
</div>
```

### Task 2: Remove obsolete JS — wheel constants, refs, computed, functions

**File:** `app/components/QuestionWorkspace.vue:589-619`

Delete all wheel-related JS:

```typescript
// DELETE lines 590-619:
const ITEM_HEIGHT = 36        // DELETE
const VISIBLE_COUNT = 3       // DELETE
const WHEEL_HALF = Math.floor(VISIBLE_COUNT / 2)  // DELETE
const wheelViewport = ref<HTMLElement | null>(null)  // DELETE
const wheelIndex = ref(0)     // DELETE
const wheelCenterIndex = computed(() => wheelIndex.value)  // DELETE
const wheelOffset = computed(() => { ... })  // DELETE
function wheelItemStyle (index: number) { ... }  // DELETE
function scrollWheel (event: WheelEvent) { ... }  // DELETE
```

### Task 3: Replace CSS — wheel styles → standard scroll list styles

**File:** `app/components/QuestionWorkspace.vue:1306-1382`

Replace wheel CSS with standard scrollable list CSS:

```css
.gen-type-list {
  max-height: 160px;
  overflow-y: auto;
  border: 1px solid var(--color-border);
  border-radius: 12px;
  background: var(--color-surface);
  display: flex;
  flex-direction: column;
  overscroll-behavior: contain;
  scrollbar-width: thin;
  scrollbar-color: var(--color-border) transparent;
}
.gen-type-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-height: 40px;
  padding: 6px 14px;
  border: none;
  border-bottom: 1px solid var(--color-border);
  background: transparent;
  cursor: pointer;
  font-size: .85rem;
  font-weight: 500;
  color: var(--color-muted);
  transition: background 0.2s ease, color 0.2s ease;
  text-align: left;
  width: 100%;
}
.gen-type-option:last-child {
  border-bottom: none;
}
.gen-type-option:hover {
  background: rgba(79, 110, 247, 0.04);
  color: var(--color-text);
}
.gen-type-option:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: -2px;
  border-radius: 0;
}
.gen-type-option--active {
  background: rgba(79, 110, 247, 0.08);
  color: var(--color-primary);
  font-weight: 600;
  border-left: 3px solid var(--color-primary);
}
.gen-type-option--active:hover {
  background: rgba(79, 110, 247, 0.1);
}
.gen-type-option-label {
  flex: 1;
}
.gen-type-option-check {
  font-size: .7rem;
  color: var(--color-accent);
  font-weight: 700;
  flex-shrink: 0;
}
```

### Task 4: Verify with build

Run `npm run check` to verify TypeScript and build pass with no errors.

---

## Assumptions & Decisions

1. **Replace, don't patch**: The entire custom wheel widget is non-standard by design (no touch, no keyboard, no ARIA, no native scroll). Patching each issue individually is more work than a clean replacement.

2. **Keep all item types visible**: 6 question types fit comfortably in a 160px scroll container — no need to hide items. Better discoverability than the old 3-visible approach.

3. **Visual indicator**: Use `border-left: 3px solid primary` for selected state instead of the old center-highlight + checkmark combo. This is more standard for list selection.

4. **Overscroll containment**: Add `overscroll-behavior: contain` per Web Interface Guidelines (scroll in modal/drawer shouldn't propagate).

5. **Focus ring**: Use `:focus-visible` with `outline` for keyboard focus per WGAC guidelines, not `:focus`.

6. **`toggleQuestionType()` function unchanged**: The existing toggle logic (lines 1030-1041) is clean and doesn't need modification.

---

## Verification

1. Run `npm run check` — build must succeed
2. Visual check: All 6 question types visible in scrollable container
3. Interaction check: Click toggles selection, ✓ indicator appears/disappears
4. Keyboard check: Tab to options, Enter/Space to toggle
5. ARIA check: `role="listbox"`, `role="option"`, `aria-selected` present
6. Touch check: Scroll works on mobile (native `overflow-y: auto`)
7. Count inputs appear below when at least one type selected
