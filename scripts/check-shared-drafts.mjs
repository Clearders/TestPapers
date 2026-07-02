import assert from 'node:assert/strict'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import ts from 'typescript'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const tempRoot = join(root, '.cache', 'shared-drafts-check')

function compileModule (sourcePath, outputPath) {
  const source = readFileSync(join(root, sourcePath), 'utf8')
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022
    }
  }).outputText

  const destination = join(tempRoot, outputPath)
  mkdirSync(dirname(destination), { recursive: true })
  writeFileSync(destination, output)
}

rmSync(tempRoot, { recursive: true, force: true })
compileModule('app/domain/drafts/index.ts', 'drafts/index.mjs')

const {
  canCommentOnSharedDraft,
  canEditSharedDraft,
  canManageSharedDraft,
  draftCommentCount,
  groupDraftComments,
  isDraftRevisionConflict,
  nextReviewStatuses
} = await import(pathToFileURL(join(tempRoot, 'drafts/index.mjs')))

const ownerDraft = { accessRole: 'owner', reviewStatus: 'draft' }
const editorDraft = { accessRole: 'editor', reviewStatus: 'changes_requested' }
const approvedEditorDraft = { accessRole: 'editor', reviewStatus: 'approved' }
const viewerDraft = { accessRole: 'viewer', reviewStatus: 'in_review' }

assert.equal(canManageSharedDraft(ownerDraft), true, 'owners should manage shared drafts')
assert.equal(canManageSharedDraft(editorDraft), false, 'editors should not manage sharing or deletion')
assert.equal(canEditSharedDraft(editorDraft), true, 'editors should edit draft content')
assert.equal(canEditSharedDraft(viewerDraft), false, 'viewers should not edit draft content')
assert.equal(canCommentOnSharedDraft(viewerDraft), true, 'viewers should be able to comment')
assert.equal(canCommentOnSharedDraft(null), false, 'missing drafts should not be commentable')

const comments = [
  { publicId: 'comment-1', status: 'open', message: 'Needs a graph.' },
  { publicId: 'comment-2', status: 'resolved', message: 'Fixed typo.' },
  { publicId: 'comment-3', status: 'open', message: 'Check marks.' }
]
const grouped = groupDraftComments(comments)
assert.deepEqual(grouped.open.map(comment => comment.publicId), ['comment-1', 'comment-3'], 'open comments should group in order')
assert.deepEqual(grouped.resolved.map(comment => comment.publicId), ['comment-2'], 'resolved comments should group in order')
assert.equal(draftCommentCount(comments), 3, 'all comments should be counted when no status filter is supplied')
assert.equal(draftCommentCount(comments, 'open'), 2, 'open comment counts should filter by status')

assert.deepEqual(
  nextReviewStatuses(ownerDraft),
  ['draft', 'in_review', 'changes_requested', 'approved'],
  'owners should be able to set every review state'
)
assert.deepEqual(nextReviewStatuses(editorDraft), ['in_review'], 'editors should only request review')
assert.deepEqual(nextReviewStatuses(approvedEditorDraft), [], 'approved editor drafts should not expose editor transitions')
assert.deepEqual(nextReviewStatuses(viewerDraft), [], 'viewers should not expose review transitions')

assert.equal(
  isDraftRevisionConflict({ code: 'DRAFT_REVISION_CONFLICT', currentRevision: 4 }),
  true,
  'draft revision conflict errors should be detected'
)
assert.equal(isDraftRevisionConflict({ code: 'VALIDATION_ERROR' }), false, 'unrelated API errors should not be conflicts')
assert.equal(isDraftRevisionConflict(null), false, 'null errors should not be conflicts')

console.log('[shared-drafts] OK')
