import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const component = readFileSync(new URL('../app/components/RecoverableAttachmentImage.vue', import.meta.url), 'utf8')
assert.match(component, /@error="failed = true"/, 'attachment rendering must detect unavailable bytes')
assert.match(component, /The question content is still available/, 'the placeholder must preserve entity context')
assert.match(component, /function retry/, 'failed attachment rendering must expose a retry')
assert.match(component, /watch\(\(\) => props\.src/, 'a refreshed signed or recovered URL must clear stale failure state')

for (const relativePath of [
  '../app/components/questions/QuestionBankCard.vue',
  '../app/components/questions/QuestionDetailModal.vue',
  '../app/components/PaperExportPanel.vue'
]) {
  const consumer = readFileSync(new URL(relativePath, import.meta.url), 'utf8')
  assert.match(consumer, /<RecoverableAttachmentImage/, `${relativePath} must use the non-destructive attachment placeholder`)
}

console.log('Attachment placeholder and retry contract check passed')
