<template>
  <div class="gen-field">
    <label id="gen-tags-label" class="form-label">Tag Filters <span class="gen-optional">(optional)</span></label>
    <div v-if="availableTags.length" class="gen-tag-pool" role="group" aria-labelledby="gen-tags-label">
      <button
        v-for="tag in availableTags"
        :key="tag"
        type="button"
        class="gen-tag-chip"
        :class="tagChipClass(tag)"
        @click="toggleTag($event, tag)"
      >{{ tag }}</button>
    </div>
    <div v-else-if="isLoadingMeta" class="gen-tag-loading" aria-live="polite">
      Loading tags...
    </div>
    <div v-if="selectedTagsDisplay.length" class="gen-selected-tags">
      <span
        v-for="tag in selectedTagsDisplay"
        :key="tag.value"
        class="gen-selected-pill"
        :class="'gen-spill--' + tag.group"
      >
        {{ tag.value }}
        <button type="button" class="gen-pill-remove" aria-label="Remove" @click="removeTag(tag.value)">x</button>
      </span>
    </div>
    <label class="form-label" for="gen-custom-tag">Custom Tag</label>
    <input
      id="gen-custom-tag"
      v-model="customTagInput"
      class="form-input gen-tag-input"
      name="customTag"
      placeholder="Type custom tag and press Enter..."
      @keydown.enter.prevent="addCustomTag"
    >
    <p class="form-hint">Click a tag to add as Required; Shift+click for Preferred. Tap x to remove.</p>
  </div>
</template>

<script setup lang="ts">
import type { GenerationFormState } from '~/types/generation'

const props = defineProps<{
  generationForm: GenerationFormState
  availableTags: string[]
  isLoadingMeta: boolean
}>()

const emit = defineEmits<{
  'update:generationForm': [value: GenerationFormState]
}>()

const customTagInput = ref('')

function updateForm (form: GenerationFormState) {
  emit('update:generationForm', form)
}

function toggleTag (event: MouseEvent, tag: string) {
  const form = { ...props.generationForm }
  const shift = event.shiftKey
  if (form.requiredTags.includes(tag)) {
    form.requiredTags = form.requiredTags.filter(t => t !== tag)
  } else if (form.preferredTags.includes(tag)) {
    form.preferredTags = form.preferredTags.filter(t => t !== tag)
  } else if (shift) {
    form.preferredTags = [...form.preferredTags, tag]
  } else {
    form.requiredTags = [...form.requiredTags, tag]
  }
  updateForm(form)
}

function removeTag (tag: string) {
  const form = { ...props.generationForm }
  form.requiredTags = form.requiredTags.filter(t => t !== tag)
  form.preferredTags = form.preferredTags.filter(t => t !== tag)
  updateForm(form)
}

function addCustomTag () {
  const input = customTagInput.value.trim()
  if (!input) return
  const tags = input.split(',').map(t => t.trim().toLowerCase()).filter(Boolean)
  const form = { ...props.generationForm }
  for (const tag of tags) {
    if (!form.requiredTags.includes(tag) && !form.preferredTags.includes(tag)) {
      form.requiredTags = [...form.requiredTags, tag]
    }
  }
  customTagInput.value = ''
  form.customTagInput = ''
  updateForm(form)
}

const selectedTagsDisplay = computed(() => {
  const display: { value: string; group: string }[] = []
  for (const tag of props.generationForm.requiredTags) {
    if (!display.some(d => d.value === tag)) display.push({ value: tag, group: 'required' })
  }
  for (const tag of props.generationForm.preferredTags) {
    const existing = display.find(d => d.value === tag)
    if (existing) existing.group = 'both'
    else display.push({ value: tag, group: 'preferred' })
  }
  return display
})

function tagChipClass (tag: string) {
  if (props.generationForm.requiredTags.includes(tag)) return 'gen-chip--required'
  if (props.generationForm.preferredTags.includes(tag)) return 'gen-chip--preferred'
  return ''
}
</script>

<style scoped>
.gen-field {
  display: flex;
  flex-direction: column;
  gap: 8px;
  position: relative;
  z-index: 1;
  animation: revealUp .34s var(--ease-out) both;
  animation-delay: .16s;
}

.gen-optional {
  font-weight: 400;
  color: var(--color-muted);
  font-size: .8rem;
}

.gen-tag-pool {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  max-height: 140px;
  overflow-y: auto;
  padding: 2px 0;
}

.gen-tag-chip {
  display: inline-flex;
  align-items: center;
  padding: 3px 10px;
  border-radius: var(--radius-pill);
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  font-size: .78rem;
  font-weight: 500;
  color: var(--color-muted);
  cursor: pointer;
  transition: border-color .22s ease, color .22s ease, background .22s ease, transform .22s var(--ease-spring), box-shadow .22s ease;
  animation: genChipIn .24s var(--ease-out) both;
}

.gen-tag-chip:hover {
  color: var(--color-text);
  border-color: var(--color-primary);
  background: rgba(79, 110, 247, 0.04);
  transform: translateY(-1px);
  box-shadow: var(--shadow-soft);
}

.gen-chip--required {
  border-color: var(--color-primary);
  background: rgba(79, 110, 247, 0.08);
  color: var(--color-primary);
  font-weight: 600;
}

.gen-chip--preferred {
  border-color: var(--color-accent);
  background: rgba(34, 197, 94, 0.08);
  color: var(--color-success-text);
  font-weight: 600;
}

.gen-tag-loading {
  font-size: .82rem;
  color: var(--color-muted);
  padding: 8px 0;
}

.gen-selected-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
}

.gen-selected-pill {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 10px;
  border-radius: var(--radius-pill);
  font-size: .78rem;
  font-weight: 500;
  animation: genChipIn .24s var(--ease-out) both;
}

.gen-spill--required {
  background: rgba(79, 110, 247, 0.12);
  color: var(--color-primary);
  border: 1px solid rgba(79, 110, 247, 0.25);
}

.gen-spill--preferred {
  background: rgba(34, 197, 94, 0.12);
  color: var(--color-success-text);
  border: 1px solid rgba(34, 197, 94, 0.25);
}

.gen-spill--both {
  background: linear-gradient(135deg, rgba(79, 110, 247, 0.12), rgba(34, 197, 94, 0.12));
  color: var(--color-text);
  border: 1px solid rgba(79, 110, 247, 0.25);
}

.gen-pill-remove {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: inherit;
  font-size: .85rem;
  line-height: 1;
  cursor: pointer;
  opacity: 0.5;
  transition: opacity 0.2s ease;
}

.gen-pill-remove:hover {
  opacity: 1;
}

.gen-tag-input {
  font-size: .82rem;
  margin-top: 8px;
}

@media (max-width: 560px) {
  .gen-tag-pool {
    max-height: 200px;
  }
}
</style>
