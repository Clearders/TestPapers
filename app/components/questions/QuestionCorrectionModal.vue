<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="visible" class="modal-overlay" @click.self="$emit('close')">
        <div class="modal-panel" role="dialog" aria-modal="true" aria-label="Report issue">
          <div class="modal-head">
            <h2>Report Issue — Question #{{ question.id }}</h2>
            <button class="modal-close" type="button" aria-label="Close" @click="$emit('close')">&times;</button>
          </div>

          <div class="modal-body">
            <form @submit.prevent="handleSubmit">
              <div class="form-group">
                <label class="form-label" for="corr-category">Issue Type</label>
                <select id="corr-category" v-model="category" class="form-input" required>
                  <option value="">Select a category…</option>
                  <option value="wrong_answer">Wrong Answer</option>
                  <option value="unclear">Unclear Description</option>
                  <option value="typo">Typo / Formatting</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div class="form-group">
                <label class="form-label" for="corr-message">Description</label>
                <textarea
                  id="corr-message"
                  v-model="message"
                  class="form-input form-textarea"
                  placeholder="Describe the issue with this question…"
                  maxlength="1000"
                  required
                />
                <span class="form-hint">{{ message.length }} / 1000</span>
              </div>

              <div class="form-actions">
                <button type="submit" class="btn btn-primary" :disabled="isSubmitting || !category || !message.trim()">
                  {{ isSubmitting ? 'Submitting…' : 'Submit Report' }}
                </button>
                <button type="button" class="btn btn-outline" @click="$emit('close')">Cancel</button>
              </div>

              <div v-if="errorMsg" class="status-banner status-banner--error modal-status">
                {{ errorMsg }}
              </div>
            </form>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import type { Question, CorrectionCategory  } from '~/types/question'
import { apiErrorMessage } from '~/utils/apiError'

const props = defineProps<{
  question: Question
  visible: boolean
}>()

const emit = defineEmits<{
  close: []
  submitted: []
}>()

const { submitCorrection } = useQuestionBank()
const isSubmitting = ref(false)
const errorMsg = ref('')
const category = ref('')
const message = ref('')

watch(() => props.visible, (val) => {
  if (val) {
    category.value = ''
    message.value = ''
    errorMsg.value = ''
  }
})

async function handleSubmit () {
  errorMsg.value = ''
  isSubmitting.value = true
  try {
    await submitCorrection(props.question.publicId, {
      category: category.value as CorrectionCategory,
      message: message.value.trim()
    })
    emit('submitted')
    emit('close')
  } catch (err) {
    errorMsg.value = apiErrorMessage(err, 'Failed to submit report.')
  } finally {
    isSubmitting.value = false
  }
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 300;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(15, 23, 42, 0.45);
  backdrop-filter: blur(4px);
  padding: 20px;
}
.modal-panel {
  width: 100%;
  max-width: 480px;
  max-height: 90vh;
  overflow-y: auto;
  overscroll-behavior: contain;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl);
  box-shadow: 0 24px 48px rgba(0, 0, 0, 0.18);
  display: flex;
  flex-direction: column;
}
.modal-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--color-border);
}
.modal-head h2 {
  font-size: 1.05rem;
  font-weight: 700;
}
.modal-close {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  font-size: 1.3rem;
  color: var(--color-muted);
  border-radius: var(--radius-md);
  cursor: pointer;
}
.modal-close:hover {
  background: var(--color-bg);
  color: var(--color-text);
}
.modal-body {
  padding: 20px;
}
.form-textarea {
  min-height: 100px;
  resize: vertical;
}
.form-actions {
  display: flex;
  gap: 8px;
  margin-top: 8px;
}
.modal-status {
  margin-top: 12px;
}
@media (max-width: 560px) {
  .modal-panel {
    max-width: 100%;
    border-radius: var(--radius-xl) var(--radius-xl) 0 0;
  }
  .modal-overlay {
    align-items: flex-end;
    padding: 0;
  }
}

</style>
