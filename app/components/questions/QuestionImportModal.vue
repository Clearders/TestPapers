<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="modal-panel import-panel" role="dialog" aria-modal="true" aria-label="Import questions">
      <div class="modal-head">
        <div>
          <h2><AppIcon name="upload" /> Import Questions</h2>
          <p>Upload CSV or JSON, review validation, then import valid rows.</p>
        </div>
        <button class="modal-close" type="button" aria-label="Close" @click="$emit('close')">&times;</button>
      </div>

      <div class="modal-body">
        <div v-if="!canCreateQuestions" class="status-banner status-banner--error">
          You need questions:write permission to import questions.
        </div>

        <div class="import-actions">
          <label class="btn btn-outline import-file-label">
            <AppIcon name="upload" />
            Choose File
            <input type="file" accept=".csv,.json,text/csv,application/json" @change="onFileSelected">
          </label>
          <button class="btn btn-outline" type="button" @click="downloadTemplate">
            <AppIcon name="download" />
            Template CSV
          </button>
          <button
            class="btn btn-primary"
            type="button"
            :disabled="!canCreateQuestions || importing || !validRows.length"
            @click="importValidRows"
          >
            <span v-if="importing" class="spinner" />
            {{ importing ? 'Importing...' : `Import ${validRows.length}` }}
          </button>
        </div>

        <p v-if="fileName" class="form-hint">Selected: {{ fileName }}</p>
        <div v-if="fatalError" class="status-banner status-banner--error">{{ fatalError }}</div>

        <div v-if="rows.length" class="import-summary">
          <span class="tag">{{ validRows.length }} valid</span>
          <span class="tag tag-warn">{{ invalidRows.length }} invalid</span>
          <span v-if="importedCount" class="tag tag-success">{{ importedCount }} imported</span>
        </div>

        <div v-if="rows.length" class="import-table-wrap">
          <table class="import-table">
            <thead>
              <tr>
                <th>Row</th>
                <th>Status</th>
                <th>Question</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in rows" :key="row.rowNumber">
                <td>{{ row.rowNumber }}</td>
                <td>
                  <span class="row-status" :class="'row-status--' + rowStatus(row).kind">
                    {{ rowStatus(row).label }}
                  </span>
                </td>
                <td>
                  <span v-if="row.input">{{ row.input.text }}</span>
                  <span v-else class="muted">Not importable</span>
                </td>
                <td>{{ rowStatus(row).message || row.errors.join('; ') || '-' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { QuestionImportRow } from '~/domain/questions'
import { QUESTION_IMPORT_TEMPLATE, parseQuestionImportText } from '~/domain/questions'
import { apiErrorMessage } from '~/utils/apiError'

defineProps<{
  canCreateQuestions: boolean
}>()

const emit = defineEmits<{
  close: []
  imported: [count: number]
}>()

type ImportStatus = {
  kind: 'ready' | 'invalid' | 'imported' | 'error'
  label: string
  message: string
}

const { addQuestion } = useQuestionBank()
const fileName = ref('')
const fatalError = ref('')
const rows = ref<QuestionImportRow[]>([])
const importing = ref(false)
const importedCount = ref(0)
const importStatuses = reactive(new Map<number, ImportStatus>())

const validRows = computed(() => rows.value.filter(row => row.input && !row.errors.length && rowStatus(row).kind !== 'imported'))
const invalidRows = computed(() => rows.value.filter(row => row.errors.length || !row.input))

async function onFileSelected (event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  fileName.value = file.name
  importedCount.value = 0
  importStatuses.clear()
  const parsed = parseQuestionImportText(await file.text(), file.name)
  rows.value = parsed.rows
  fatalError.value = parsed.fatalError
  input.value = ''
}

async function importValidRows () {
  if (importing.value || !validRows.value.length) return
  importing.value = true
  let count = 0
  try {
    for (const row of validRows.value) {
      const input = row.input
      if (!input) continue
      try {
        await addQuestion(input)
        importStatuses.set(row.rowNumber, { kind: 'imported', label: 'Imported', message: '' })
        count += 1
      } catch (error) {
        importStatuses.set(row.rowNumber, {
          kind: 'error',
          label: 'Failed',
          message: apiErrorMessage(error, 'Failed to import this row.')
        })
      }
    }
    importedCount.value += count
    if (count) emit('imported', count)
  } finally {
    importing.value = false
  }
}

function rowStatus (row: QuestionImportRow): ImportStatus {
  const status = importStatuses.get(row.rowNumber)
  if (status) return status
  if (row.errors.length || !row.input) return { kind: 'invalid', label: 'Invalid', message: row.errors.join('; ') }
  return { kind: 'ready', label: 'Ready', message: '' }
}

function downloadTemplate () {
  const blob = new Blob([QUESTION_IMPORT_TEMPLATE], { type: 'text/csv;charset=utf-8' })
  const objectUrl = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = objectUrl
  link.download = 'question-import-template.csv'
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1_000)
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 140;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: rgba(15, 12, 28, 0.48);
  backdrop-filter: blur(8px);
}

.modal-panel {
  width: min(860px, 100%);
  max-height: calc(100vh - 40px);
  overflow: auto;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface-raised);
  box-shadow: var(--shadow);
}

.modal-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 18px 20px 14px;
  border-bottom: 1px solid var(--color-border);
}

.modal-head h2 {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 1.08rem;
}

.modal-head p {
  margin-top: 4px;
  color: var(--color-muted);
  font-size: .86rem;
}

.modal-close {
  display: inline-grid;
  place-items: center;
  width: 34px;
  height: 34px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-surface-solid);
  color: var(--color-muted);
  font-size: 1.2rem;
}

.modal-body {
  padding: 18px 20px 20px;
}

.import-actions,
.import-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
  margin-bottom: 12px;
}

.import-file-label input {
  display: none;
}

.import-table-wrap {
  max-height: 420px;
  overflow: auto;
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
}

.import-table {
  width: 100%;
  border-collapse: collapse;
  font-size: .86rem;
}

.import-table th,
.import-table td {
  padding: 10px 12px;
  border-bottom: 1px solid var(--color-border);
  text-align: left;
  vertical-align: top;
}

.import-table th {
  position: sticky;
  top: 0;
  z-index: 1;
  background: var(--color-surface-solid);
  color: var(--color-muted);
  font-size: .76rem;
  text-transform: uppercase;
}

.row-status {
  display: inline-flex;
  padding: 2px 8px;
  border-radius: var(--radius-pill);
  font-size: .75rem;
  font-weight: 750;
}

.row-status--ready {
  color: var(--color-primary);
  background: rgba(118, 87, 255, 0.12);
}

.row-status--invalid,
.row-status--error {
  color: var(--color-danger-text);
  background: var(--color-danger-bg);
}

.row-status--imported {
  color: var(--color-success-text);
  background: var(--color-success-bg);
}

.tag-warn {
  color: var(--color-warning);
  background: var(--color-warning-bg);
}

.tag-success {
  color: var(--color-success-text);
  background: var(--color-success-bg);
}

.muted {
  color: var(--color-muted);
}

.spinner {
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255, 255, 255, .35);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin .7s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
