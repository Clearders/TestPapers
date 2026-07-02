import type { PaperQuestion, PaperState } from '~/domain/papers'
import type { Question } from '~/types/question'
import { clonePaperQuestion } from '~/domain/papers'

export interface UsePaperQuestionActionsParams {
  paper: PaperState
  onPaperQuestionsChanged?: () => void
}

export function usePaperQuestionActions (params: UsePaperQuestionActionsParams) {
  const { paper, onPaperQuestionsChanged } = params
  const temporaryEditingQuestion = ref<PaperQuestion | null>(null)

  function questions () {
    return Array.isArray(paper?.questions) ? paper.questions : []
  }

  const paperQuestionIds = computed(() => {
    const ids = new Set<number>()
    for (const q of questions()) ids.add(q.id)
    return ids
  })

  function markQuestionsChanged () {
    onPaperQuestionsChanged?.()
  }

  function removeQuestion (id: number) {
    const idx = questions().findIndex(q => q.id === id)
    if (idx === -1) return false
    paper.questions.splice(idx, 1)
    markQuestionsChanged()
    return true
  }

  function toggleQuestion (question: Question) {
    if (paperQuestionIds.value.has(question.id)) {
      removeQuestion(question.id)
      return
    }
    paper.questions.push(clonePaperQuestion(question))
    markQuestionsChanged()
  }

  function moveUp (idx: number) {
    if (idx === 0 || idx >= questions().length) return
    const [removed] = paper.questions.splice(idx, 1)
    if (!removed) return
    paper.questions.splice(idx - 1, 0, removed)
    markQuestionsChanged()
  }

  function moveDown (idx: number) {
    if (idx >= questions().length - 1) return
    const [removed] = paper.questions.splice(idx, 1)
    if (!removed) return
    paper.questions.splice(idx + 1, 0, removed)
    markQuestionsChanged()
  }

  function openTemporaryQuestionEdit (question: PaperQuestion) {
    temporaryEditingQuestion.value = question
  }

  function applyTemporaryQuestionEdit (question: PaperQuestion) {
    const idx = questions().findIndex(item => item.id === question.id)
    if (idx === -1) return
    paper.questions.splice(idx, 1, question)
    temporaryEditingQuestion.value = null
    markQuestionsChanged()
  }

  function resetTemporaryQuestionEdit (id: number) {
    const idx = questions().findIndex(item => item.id === id)
    if (idx === -1) return
    const current = paper.questions[idx]
    if (!current?.originalQuestion) return
    const restored = clonePaperQuestion(current.originalQuestion)
    restored.marks = current.marks
    restored.orderNo = current.orderNo
    paper.questions.splice(idx, 1, restored)
    if (temporaryEditingQuestion.value?.id === id) temporaryEditingQuestion.value = null
    markQuestionsChanged()
  }

  return {
    paperQuestionIds,
    temporaryEditingQuestion,
    toggleQuestion,
    removeQuestion,
    moveUp,
    moveDown,
    openTemporaryQuestionEdit,
    applyTemporaryQuestionEdit,
    resetTemporaryQuestionEdit
  }
}
