import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const usePaperExport = readFileSync(join(root, 'app/composables/usePaperExport.ts'), 'utf8')
const useWorkspaceDraft = readFileSync(join(root, 'app/composables/useWorkspaceDraft.ts'), 'utf8')

function assert(condition, message) {
  if (!condition) {
    console.error(`[paper-persistence-flow] ${message}`)
    process.exitCode = 1
  }
}

assert(
  usePaperExport.includes("await apiFetch<PaperEntityResponse>(`/papers/${savedPaperId.value}`,") &&
    usePaperExport.includes("method: 'PATCH'") &&
    usePaperExport.includes('body: buildPaperMetadataPayload(paper)'),
  'changed drafts with savedPaperId must PATCH existing paper metadata before export/save.'
)

assert(
  usePaperExport.includes("await apiFetch(`/papers/${savedPaperId.value}/questions`,") &&
    usePaperExport.includes("method: 'PUT'") &&
    usePaperExport.includes('body: buildPaperPayload(paper).questions'),
  'changed drafts with savedPaperId must replace existing paper question refs instead of POSTing a new paper.'
)

assert(
  usePaperExport.includes('if (getStatusCode(error) !== 404) throw error') &&
    usePaperExport.includes('forgetSavedPaper()'),
  'the update path should only fall back to paper creation when the saved backend paper is gone.'
)

assert(
  usePaperExport.includes('const useDraftDownload = hasTemporaryQuestionEdits(paper)') &&
    usePaperExport.includes("apiFetchRaw('/papers/draft-download'") &&
    usePaperExport.includes('hasExportPermission(useDraftDownload ? false : !hasReusableSavedPaper())') &&
    usePaperExport.includes('? await requestDraftDocxDownload()'),
  'temporary question edits must export through draft-download without creating or updating a persisted paper.'
)

assert(
  useWorkspaceDraft.includes('savedPaperId.value = draft.savedPaperId') &&
    !useWorkspaceDraft.includes('signatureMatches'),
  'workspace draft hydration must keep savedPaperId even when the saved signature is stale.'
)

if (process.exitCode) process.exit(process.exitCode)
console.log('[paper-persistence-flow] OK')
