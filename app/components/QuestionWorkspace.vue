<template>
  <section class="workspace">
    <WorkspaceHeading
      :selected-count="paperQuestions.length"
      :total-marks="workspacePaper.totalMarks"
    />

    <WorkspaceSectionTabs v-model:active-section="activeSection" />

    <Transition name="fade" mode="out-in">
      <div v-if="activeSection === 'editor'" key="editor" class="workspace-section editor-section">
        <WorkspaceEditorToolbar
          @new-paper="newPaper"
          @open-bank="setActiveSection('bank')"
        />

        <ExamDraftPanel
          v-model:draft-name="examDraftName"
          v-model:selected-draft-id="selectedExamDraftId"
          :summary-text="examDraftSummaryText"
          :active-draft-name="activeExamDraftName"
          :drafts="examDrafts"
          :selected-draft="selectedExamDraft"
          :saved-at="examDraftSavedAt"
          :error="examDraftError"
          :has-current-draft-content="hasCurrentDraftContent"
          @save="saveCurrentExamDraft"
          @load="loadSelectedExamDraft"
          @delete-draft="deleteSelectedExamDraft"
        />

        <CloudDraftPanel
          v-if="isAuthenticated && canReadPapers"
          v-model:selected-draft-id="selectedCloudDraftId"
          v-model:draft-name="cloudDraftName"
          v-model:collaborator-username="cloudCollaboratorUsername"
          v-model:collaborator-role="cloudCollaboratorRole"
          :drafts="cloudDrafts"
          :active-draft="activeCloudDraft"
          :is-loading="isLoadingCloudDrafts"
          :is-saving="isSavingCloudDraft"
          :is-downloading="isDownloadingCloudDraft"
          :error="cloudDraftError"
          :conflict="cloudDraftConflict"
          :saved-at="cloudDraftSavedAt"
          :has-current-draft-content="hasCurrentDraftContent"
          :can-manage-active="canManageActiveCloudDraft"
          :can-edit-active="canEditActiveCloudDraft"
          @save="saveCloudDraftFromWorkspace"
          @load="loadSelectedCloudDraftFromWorkspace"
          @delete-draft="deleteSelectedCloudDraftFromWorkspace"
          @reload="loadCloudDrafts"
          @download="downloadCloudDraftDocx"
          @set-review-status="setCloudDraftReviewStatus"
          @add-collaborator="addCloudCollaboratorFromForm"
          @update-collaborator="updateCloudDraftCollaborator"
          @remove-collaborator="removeCloudDraftCollaboratorFromPanel"
        />

        <div class="editor-layout">
          <PaperBuilderPanel
            v-model:export-mode="exportMode"
            v-model:layout-density="layoutDensity"
            v-model:include-answers-in-export="includeAnswersInExport"
            :paper="workspacePaper"
            :generation-form="workspaceGenerationForm"
            :can-read-answers="canReadAnswers"
            :can-write-papers="canWritePapers"
            :is-generating="isGenerating"
            :generation-error="generationError"
            :generation-diagnostics="generationDiagnostics"
            :available-subjects="availableSubjects"
            :available-tags="availableTags"
            :is-loading-meta="isLoadingMeta"
            :meta-error="metaError"
            :exported="exported"
            :is-downloading-docx="isDownloadingDocx"
            :download-error="downloadError"
            :is-saving-paper="isSavingPaper"
            :save-error="saveError"
            :save-success="saveSuccess"
            :downloaded-layout-density="downloadedLayoutDensity"
            :can-download-docx="canDownloadDocx"
            :export-access-prompt="exportAccessPrompt"
            :show-inline-export-preview="false"
            @update:paper-title="paper.title = $event"
            @update:paper-subject="paper.subject = $event"
            @update:paper-duration="paper.duration = $event"
            @update:generation-form="Object.assign(generationForm, $event)"
            @update:total-marks="paper.totalMarks = $event"
            @generate="generatePaper"
            @move-up="moveUp"
            @move-down="moveDown"
            @remove-question="removeQuestion"
            @edit-temporary-question="openTemporaryQuestionEdit"
            @reset-temporary-question="resetTemporaryQuestionEdit"
            @save-paper="savePaper"
            @export-paper="exportPaper"
            @download-docx="downloadDocx"
            @clear-paper="clearPaper"
            @dismiss-export-access-prompt="dismissExportAccessPrompt"
          />

          <PaperLivePreview
            v-model:export-mode="exportMode"
            v-model:layout-density="layoutDensity"
            v-model:include-answers-in-export="includeAnswersInExport"
            :paper="workspacePaper"
            :can-read-answers="canReadAnswers"
            :downloaded-layout-density="downloadedLayoutDensity"
            :fullscreen="previewFullscreen"
            :comments-enabled="!!activeCloudDraft"
            :comment-count="activeCloudDraft?.commentCount || 0"
            :open-comment-count="activeCloudDraft?.openCommentCount || 0"
            @toggle-fullscreen="previewFullscreen = !previewFullscreen"
            @print-paper="printPaper"
            @toggle-comments="commentsDrawerOpen = !commentsDrawerOpen"
          />
        </div>
      </div>

      <div v-else key="bank" class="workspace-section">
        <QuestionBankPanel
          v-if="canReadQuestions"
          v-model:search="search"
          v-model:filter-subject="filterSubject"
          v-model:filter-difficulty="filterDifficulty"
          v-model:filter-type="filterType"
          v-model:filter-tag="filterTag"
          v-model:filter-has-latex="filterHasLatex"
          :bank-mode="bankMode"
          :available-subjects="availableSubjects"
          :available-tags="availableTags"
          :can-create-questions="canCreateQuestions"
          :current-questions="currentQuestions"
          :active-pagination="activePagination"
          :active-loading="activeLoading"
          :question-error="questionError"
          :meta-error="metaError"
          :shown-ids="shownIds"
          :paper-question-ids="paperQuestionIds"
          :can-read-answers="canReadAnswers"
          :can-review="canReview"
          :can-delete-question="canDeleteQuestion"
          :can-edit-question="canEditQuestion"
          @switch-bank-mode="switchBankMode"
          @toggle-question="toggleQuestion"
          @view-detail="openDetailModal"
          @edit="openEditModal"
          @report="openCorrectionModal"
          @delete="onDeleteQuestionFromCard"
          @page-change="goToPage"
          @toggle-answer="onToggleAnswer"
          @open-import="importModalOpen = true"
          @reset-filters="resetFilters"
        />
        <WorkspaceAccessPrompt
          v-else
          :title="workspaceAccessTitle"
          :message="workspaceAccessMessage"
          :is-authenticated="isAuthenticated"
        />
      </div>
    </Transition>

    <EditQuestionModal
      v-if="editingQuestion"
      :key="editingQuestion.id"
      :question="editingQuestion"
      :visible="!!editingQuestion"
      @close="closeEditModal"
      @saved="onQuestionEdited"
    />

    <QuestionCorrectionModal
      v-if="reportingQuestion"
      :key="reportingQuestion.id"
      :question="reportingQuestion"
      :visible="!!reportingQuestion"
      @close="closeCorrectionModal"
    />

    <QuestionDetailModal
      v-if="detailQuestion"
      :key="detailQuestion.id"
      :question="detailQuestion"
      :can-read-answers="canReadAnswers"
      @close="detailQuestion = null"
    />

    <QuestionImportModal
      v-if="importModalOpen"
      :can-create-questions="canCreateQuestions"
      @close="importModalOpen = false"
      @imported="onQuestionsImported"
    />

    <TemporaryQuestionEditModal
      v-if="temporaryEditingQuestion"
      :key="temporaryEditingQuestion.id"
      :question="temporaryEditingQuestion"
      :visible="!!temporaryEditingQuestion"
      @close="temporaryEditingQuestion = null"
      @save="applyTemporaryQuestionEdit"
      @reset="resetTemporaryQuestionEdit"
    />

    <DraftCommentsDrawer
      v-model:open="commentsDrawerOpen"
      v-model:filter="commentsFilter"
      v-model:message="newCommentMessage"
      v-model:selected-question-public-id="commentQuestionPublicId"
      :comments="activeCloudDraft?.comments || []"
      :questions="paperQuestions"
      :active-draft-name="activeCloudDraft?.name || ''"
      :can-comment="canCommentActiveCloudDraft"
      @add-comment="addCloudCommentFromDrawer"
      @update-comment-status="updateCloudDraftCommentStatus"
    />
  </section>
</template>

<script setup lang="ts">
import type { WorkspaceSection } from '~/composables/useQuestionWorkspaceRouteState'
import type { Question } from '~/types/question'
import type { DraftCollaboratorRole, DraftCommentStatus } from '~/types/draft'
import type { ExportMode, GenerationDiagnostics, LayoutDensity } from '~/types/generation'
import type { BankMode, GeneratedPaperResponse } from '~/domain/papers'
import {
  buildPaperGeneratePayload,
  createDefaultGenerationForm,
  createDefaultPaper
} from '~/domain/papers'
import { apiErrorMessage } from '~/utils/apiError'

const EditQuestionModal = defineAsyncComponent(() => import('~/components/questions/EditQuestionModal.vue'))
const QuestionCorrectionModal = defineAsyncComponent(() => import('~/components/questions/QuestionCorrectionModal.vue'))
const QuestionDetailModal = defineAsyncComponent(() => import('~/components/questions/QuestionDetailModal.vue'))
const QuestionImportModal = defineAsyncComponent(() => import('~/components/questions/QuestionImportModal.vue'))
const TemporaryQuestionEditModal = defineAsyncComponent(() => import('~/components/TemporaryQuestionEditModal.vue'))

const {
  canCreateQuestions,
  canReadAnswers,
  questions,
  myQuestions,
  loadQuestions,
  loadMyQuestions,
  isLoading,
  isLoadingMine,
  error: questionError,
  questionPagination,
  myQuestionPagination,
  availableSubjects,
  availableTags,
  loadMeta,
  isLoadingMeta,
  metaError
} = useQuestionBank()
const { hasPermission, isAuthenticated, isAuthReady, user } = useAuth()
const { apiFetch, apiFetchRaw } = useApi()
const { on: onRealtimeEvent } = useRealtime()
const {
  activeSection,
  search,
  filterSubject,
  filterDifficulty,
  filterType,
  filterTag,
  filterHasLatex,
  bankMode,
  syncQuery,
  resetFilters,
  toQuestionQuery
} = useQuestionWorkspaceRouteState()
const shownIds = reactive(new Set<number>())
const exportMode = ref<ExportMode>('paper')
const layoutDensity = ref<LayoutDensity>('auto')
const includeAnswersInExport = ref(false)
const isGenerating = ref(false)
const generationError = ref('')
const generationDiagnostics = ref<GenerationDiagnostics | null>(null)
const isActive = ref(true)
const previewFullscreen = ref(false)
const importModalOpen = ref(false)
const commentsDrawerOpen = ref(false)
const commentsFilter = ref<'open' | 'resolved' | 'all'>('open')
const newCommentMessage = ref('')
const commentQuestionPublicId = ref('')
const cloudCollaboratorUsername = ref('')
const cloudCollaboratorRole = ref<DraftCollaboratorRole>('viewer')
let searchLoadTimer: ReturnType<typeof setTimeout> | null = null

const paper = reactive(createDefaultPaper())
const generationForm = reactive(createDefaultGenerationForm())
const workspacePaper = computed(() => ({
  ...createDefaultPaper(),
  ...(paper || {}),
  questions: Array.isArray(paper?.questions) ? paper.questions : []
}))
const paperQuestions = computed(() => workspacePaper.value.questions)
const workspaceGenerationForm = computed(() => ({
  ...createDefaultGenerationForm(),
  ...(generationForm || {}),
  questionTypes: Array.isArray(generationForm?.questionTypes) ? generationForm.questionTypes : [],
  subjects: Array.isArray(generationForm?.subjects) ? generationForm.subjects : [],
  requiredTags: Array.isArray(generationForm?.requiredTags) ? generationForm.requiredTags : [],
  preferredTags: Array.isArray(generationForm?.preferredTags) ? generationForm.preferredTags : []
}))

const editingQuestion = ref<Question | null>(null)
const reportingQuestion = ref<Question | null>(null)
const detailQuestion = ref<Question | null>(null)

const canReadQuestions = computed(() => hasPermission('questions:read'))
const canReadPapers = computed(() => hasPermission('papers:read'))
const workspaceAccessTitle = computed(() => isAuthenticated.value ? 'Question bank access required' : 'Create an account to use the question bank')
const workspaceAccessMessage = computed(() => (
  isAuthenticated.value
    ? 'Your account can open the workspace, but it does not have permission to read the question bank. Contact the administrator for access.'
    : 'You can prepare paper details in the editor. Create an account to search questions, build papers from the bank, and export exam papers.'
))
const isAdmin = computed(() => hasPermission('users:manage'))
const canReview = computed(() => hasPermission('questions:write'))

function canEditQuestion (q: Question) {
  if (!hasPermission('questions:write')) return false
  if (isAdmin.value) return true
  return q.ownerId === null || q.ownerId === user.value?.id
}

function canDeleteQuestion (q: Question) {
  if (!hasPermission('questions:delete')) return false
  if (isAdmin.value) return true
  return q.ownerId === null || q.ownerId === user.value?.id
}

const currentQuestions = computed(() => bankMode.value === 'mine' ? myQuestions.value : questions.value)
const activePagination = computed(() => bankMode.value === 'mine' ? myQuestionPagination.value : questionPagination.value)
const activeLoading = computed(() => bankMode.value === 'mine' ? isLoadingMine.value : isLoading.value)

const hasCurrentDraftContent = computed(() => {
  const questions = Array.isArray(paperQuestions.value) ? paperQuestions.value : []
  const subjects = Array.isArray(workspaceGenerationForm.value.subjects) ? workspaceGenerationForm.value.subjects : []
  const requiredTags = Array.isArray(workspaceGenerationForm.value.requiredTags) ? workspaceGenerationForm.value.requiredTags : []
  const preferredTags = Array.isArray(workspaceGenerationForm.value.preferredTags) ? workspaceGenerationForm.value.preferredTags : []
  return Boolean(
    workspacePaper.value.title.trim() ||
    workspacePaper.value.subject.trim() ||
    questions.length ||
    subjects.length ||
    requiredTags.length ||
    preferredTags.length
  )
})

const savedPaperId = ref<string | null>(null)
const savedPaperSignature = ref('')

const {
  suppressDraftSave,
  examDrafts,
  activeExamDraftId,
  examDraftError,
  examDraftSavedAt,
  currentPaperSignature,
  createWorkspaceDraft,
  applyWorkspaceDraft,
  restoreWorkspaceDraft,
  loadExamDraftSummaries,
  saveExamDraft,
  loadExamDraft,
  deleteExamDraft,
  clearActiveExamDraft,
  clearWorkspaceDraft,
  scheduleWorkspaceDraftSave,
  clearDraftSaveTimer
} = useWorkspaceDraft({
  paper,
  generationForm,
  exportMode,
  layoutDensity,
  includeAnswersInExport,
  canReadAnswers,
  savedPaperId,
  savedPaperSignature,
  generationDiagnostics,
  user
})

const {
  exported,
  exportAccessPrompt,
  isDownloadingDocx,
  isSavingPaper,
  downloadError,
  saveError,
  saveSuccess,
  downloadedLayoutDensity,
  canWritePapers,
  canDownloadDocx,
  dismissExportAccessPrompt,
  exportPaper,
  printPaper,
  savePaper,
  downloadDocx,
  resetExportState,
  applyGenerationResult
} = usePaperExport({
  paper,
  exportMode,
  layoutDensity,
  includeAnswersInExport,
  canReadAnswers,
  isAuthenticated,
  savedPaperId,
  savedPaperSignature,
  currentPaperSignature,
  hasPermission,
  apiFetch,
  apiFetchRaw
})

const {
  paperQuestionIds,
  temporaryEditingQuestion,
  toggleQuestion,
  removeQuestion,
  moveUp,
  moveDown,
  openTemporaryQuestionEdit,
  applyTemporaryQuestionEdit,
  resetTemporaryQuestionEdit
} = usePaperQuestionActions({
  paper,
  onPaperQuestionsChanged: () => {
    downloadedLayoutDensity.value = null
  }
})

const {
  examDraftName,
  selectedExamDraftId,
  activeExamDraftName,
  selectedExamDraft,
  examDraftSummaryText,
  resetExamDraftSelection,
  saveCurrentExamDraft,
  loadSelectedExamDraft,
  deleteSelectedExamDraft
} = useExamDraftControls({
  examDrafts,
  activeExamDraftId,
  hasCurrentDraftContent,
  defaultDraftName: () => paper.title.trim() || `Exam draft ${examDrafts.value.length + 1}`,
  saveExamDraft,
  loadExamDraft,
  deleteExamDraft,
  onDraftLoaded: () => {
    exported.value = false
    downloadedLayoutDensity.value = null
  }
})

const {
  cloudDrafts,
  activeCloudDraft,
  selectedCloudDraftId,
  cloudDraftName,
  cloudDraftError,
  cloudDraftSavedAt,
  cloudDraftConflict,
  isLoadingCloudDrafts,
  isSavingCloudDraft,
  isDownloadingCloudDraft,
  canManageActiveCloudDraft,
  canEditActiveCloudDraft,
  canCommentActiveCloudDraft,
  clearActiveCloudDraft,
  loadCloudDrafts,
  loadCloudDraft,
  saveActiveCloudDraft,
  setCloudDraftReviewStatus,
  deleteSelectedCloudDraft,
  addCloudDraftCollaborator,
  updateCloudDraftCollaborator,
  removeCloudDraftCollaborator,
  addCloudDraftComment,
  updateCloudDraftComment,
  downloadCloudDraftDocx
} = useSharedDrafts({
  createWorkspaceDraft,
  applyWorkspaceDraft,
  defaultDraftName: () => paper.title.trim() || `Cloud draft ${cloudDrafts.value.length + 1}`,
  onDraftLoaded: () => {
    exported.value = false
    downloadedLayoutDensity.value = null
    commentsDrawerOpen.value = false
  }
})

watch(
  [isAuthReady, canReadQuestions],
  ([ready, allowed]) => {
    if (!import.meta.client || !ready) return
    restoreWorkspaceDraft()
    loadExamDraftSummaries()
    if (canReadPapers.value) void loadCloudDrafts()
    if (allowed) {
      void loadCurrentPage(1)
      void loadMeta()
    }
  },
  { immediate: true }
)

watch([search, filterSubject, filterDifficulty, filterType, filterTag, filterHasLatex], () => {
  if (import.meta.client && isActive.value) {
    syncQuery()
    if (searchLoadTimer) clearTimeout(searchLoadTimer)
    searchLoadTimer = setTimeout(() => {
      searchLoadTimer = null
      if (isActive.value && canReadQuestions.value) void loadCurrentPage(1)
    }, 250)
  }
})

watch([bankMode, activeSection], () => {
  if (import.meta.client && isActive.value) syncQuery()
})

watch(isAuthenticated, (authenticated) => {
  if (!authenticated) {
    clearActiveCloudDraft()
    commentsDrawerOpen.value = false
  }
})

if (import.meta.client) {
  for (const event of ['draft.updated', 'draft.review.updated', 'draft.comment.created', 'draft.comment.updated']) {
    onRealtimeEvent(event, handleDraftRealtimeEvent)
  }
}

onBeforeUnmount(() => {
  isActive.value = false
  if (searchLoadTimer) clearTimeout(searchLoadTimer)
  clearDraftSaveTimer()
})

watch(canReadAnswers, (allowed) => {
  if (!allowed) includeAnswersInExport.value = false
})

watch(
  [paper, generationForm, exportMode, layoutDensity, includeAnswersInExport, generationDiagnostics],
  () => scheduleWorkspaceDraftSave(),
  { deep: true }
)

function setActiveSection (section: WorkspaceSection) {
  activeSection.value = section
}

async function switchBankMode (mode: BankMode) {
  bankMode.value = mode
  await loadCurrentPage(1)
}

async function loadCurrentPage (page: number) {
  if (bankMode.value === 'mine') {
    await loadMyQuestions(toQuestionQuery(page))
    return
  }
  await loadQuestions(toQuestionQuery(page))
}

function goToPage (page: number) {
  void loadCurrentPage(page)
}

function onToggleAnswer (id: number) {
  if (shownIds.has(id)) shownIds.delete(id)
  else shownIds.add(id)
}

function onDeleteQuestionFromCard (question: Question) {
  removeQuestion(question.id)
}

function clearPaper () {
  if (!window.confirm('Clear all questions from the paper? This cannot be undone.')) return
  suppressDraftSave.value = true
  paper.questions.length = 0
  resetExportState()
  clearWorkspaceDraft()
  void nextTick(() => {
    suppressDraftSave.value = false
  })
}

function newPaper () {
  const hasDraft = hasCurrentDraftContent.value
  if (hasDraft && !window.confirm('Start a new paper and clear the current draft?')) return
  suppressDraftSave.value = true
  const nextPaper = createDefaultPaper()
  paper.title = nextPaper.title
  paper.subject = nextPaper.subject
  paper.duration = nextPaper.duration
  paper.totalMarks = nextPaper.totalMarks
  paper.questions.splice(0, paper.questions.length)
  Object.assign(generationForm, createDefaultGenerationForm())
  generationDiagnostics.value = null
  resetExamDraftSelection()
  clearActiveExamDraft()
  clearActiveCloudDraft()
  commentsDrawerOpen.value = false
  resetExportState()
  clearWorkspaceDraft()
  void nextTick(() => {
    suppressDraftSave.value = false
  })
}

watch([exportMode, layoutDensity, includeAnswersInExport], () => {
  downloadedLayoutDensity.value = null
})

async function generatePaper () {
  generationError.value = ''
  generationDiagnostics.value = null
  if (!canWritePapers.value) {
    generationError.value = 'You do not have permission to generate papers.'
    return
  }
  const payload = buildPaperGeneratePayload(paper, generationForm, bankMode.value)
  if (!payload) {
    generationError.value = 'Please enter a paper title and select at least one subject.'
    return
  }
  isGenerating.value = true

  try {
    const response = await apiFetch<GeneratedPaperResponse>('/papers/generate', {
      method: 'POST',
      body: payload
    })

    applyGenerationResult(response)
    generationDiagnostics.value = response.data.diagnostics
  } catch (error) {
    generationError.value = apiErrorMessage(error, 'Failed to generate paper.')
  } finally {
    isGenerating.value = false
  }
}

function openEditModal (question: Question) {
  editingQuestion.value = question
}

function closeEditModal () {
  editingQuestion.value = null
}

function onQuestionEdited () {
  void loadCurrentPage(1)
}

function openCorrectionModal (question: Question) {
  reportingQuestion.value = question
}

function closeCorrectionModal () {
  reportingQuestion.value = null
}

function openDetailModal (question: Question) {
  detailQuestion.value = question
}

function onQuestionsImported () {
  void loadMeta()
  void loadCurrentPage(1)
}

function handleDraftRealtimeEvent (payload: unknown) {
  if (!isRecord(payload)) return
  if (canReadPapers.value) void loadCloudDrafts()
  const draftId = typeof payload.draftId === 'string' ? payload.draftId : ''
  const actorId = typeof payload.actorId === 'number' ? payload.actorId : null
  if (draftId && draftId === activeCloudDraft.value?.publicId && actorId !== user.value?.id) {
    cloudDraftConflict.value = true
  }
}

async function saveCloudDraftFromWorkspace () {
  await saveActiveCloudDraft()
}

async function loadSelectedCloudDraftFromWorkspace () {
  if (!selectedCloudDraftId.value) return
  const targetName = cloudDrafts.value.find(draft => draft.publicId === selectedCloudDraftId.value)?.name || 'this cloud draft'
  const replacingDifferentDraft = activeCloudDraft.value?.publicId !== selectedCloudDraftId.value
  if (replacingDifferentDraft && hasCurrentDraftContent.value && !window.confirm(`Load "${targetName}" and replace the current paper?`)) return
  await loadCloudDraft(selectedCloudDraftId.value)
}

async function deleteSelectedCloudDraftFromWorkspace () {
  if (!selectedCloudDraftId.value) return
  const targetName = cloudDrafts.value.find(draft => draft.publicId === selectedCloudDraftId.value)?.name || 'this cloud draft'
  if (!window.confirm(`Delete "${targetName}"? This cannot be undone.`)) return
  await deleteSelectedCloudDraft()
}

async function addCloudCollaboratorFromForm () {
  const username = cloudCollaboratorUsername.value.trim()
  if (!username) return
  const updated = await addCloudDraftCollaborator(username, cloudCollaboratorRole.value)
  if (updated) cloudCollaboratorUsername.value = ''
}

async function removeCloudDraftCollaboratorFromPanel (userPublicId: string) {
  if (!window.confirm('Remove this collaborator from the cloud draft?')) return
  await removeCloudDraftCollaborator(userPublicId)
}

async function addCloudCommentFromDrawer () {
  const message = newCommentMessage.value.trim()
  if (!message) return
  const updated = await addCloudDraftComment(message, commentQuestionPublicId.value || null)
  if (updated) {
    newCommentMessage.value = ''
    commentQuestionPublicId.value = ''
  }
}

async function updateCloudDraftCommentStatus (commentPublicId: string, status: DraftCommentStatus) {
  await updateCloudDraftComment(commentPublicId, { status })
}

function isRecord (value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
</script>

<style scoped>
.workspace-section {
  min-width: 0;
}

.editor-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.05fr) minmax(380px, .95fr);
  gap: 24px;
  align-items: start;
}

:deep(.katex-display),
:deep(.latex-block) {
  max-width: 100%;
  overflow-x: auto;
  overflow-y: hidden;
}

@media (max-width: 1080px) {
  .editor-layout {
    grid-template-columns: 1fr;
  }
}

@media print {
  .editor-layout {
    display: block;
  }

  :deep(.workspace-heading),
  :deep(.workspace-tabs),
  :deep(.editor-toolbar),
  :deep(.paper-panel) {
    display: none !important;
  }
}
</style>
