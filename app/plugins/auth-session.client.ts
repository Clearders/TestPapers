import type { QuestionEntity } from '~/types/question'

interface RealtimePayload {
  question?: QuestionEntity
  questionId?: string
  actorId?: number
  paper?: { publicId?: string }
}

function isRealtimePayload (value: unknown): value is RealtimePayload {
  return typeof value === 'object' && value !== null
}

export default defineNuxtPlugin(() => {
  const auth = useAuth()
  const { user } = auth
  const realtime = useRealtime()
  const questionBank = useQuestionBank()

  function runWhenIdle (callback: () => void) {
    const idleWindow = window as Window & {
      requestIdleCallback?: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number
    }

    if (typeof idleWindow.requestIdleCallback === 'function') {
      idleWindow.requestIdleCallback(() => callback(), { timeout: 2_000 })
      return
    }

    window.setTimeout(callback, 0)
  }

  const reloadQuestionBank = () => {
    if (!auth.hasPermission('questions:read')) return
    void questionBank.loadQuestions().catch(() => {})
    void questionBank.loadMyQuestions().catch(() => {})
  }

  realtime.on('question.created', (payload: unknown) => {
    if (!isRealtimePayload(payload) || !payload.question) return
    if (auth.hasPermission('questions:read') && payload.actorId !== user.value?.id) {
      questionBank.addQuestionLocally(payload.question, user.value?.id)
    }
  })
  realtime.on('question.updated', (payload: unknown) => {
    if (!isRealtimePayload(payload) || !payload.question) return
    if (auth.hasPermission('questions:read') && payload.actorId !== user.value?.id) {
      questionBank.replaceQuestionLocally(payload.question, user.value?.id)
    }
  })
  realtime.on('question.deleted', (payload: unknown) => {
    if (!auth.hasPermission('questions:read')) return
    if (isRealtimePayload(payload) && payload.questionId !== undefined) questionBank.removeQuestionLocally(payload.questionId)
    else reloadQuestionBank()
  })

  const connectRealtime = () => {
    if (auth.isAuthenticated.value) realtime.connect()
  }

  const initialiseSession = async () => {
    if (!auth.isAuthReady.value) await auth.loadSession()
    auth.scheduleRefresh()
    runWhenIdle(connectRealtime)
  }

  void initialiseSession()

  watch(auth.isAuthenticated, (authenticated) => {
    if (authenticated) runWhenIdle(connectRealtime)
    else realtime.disconnect()
  })
})
