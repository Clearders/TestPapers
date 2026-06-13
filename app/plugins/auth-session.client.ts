export default defineNuxtPlugin(async () => {
  const auth = useAuth()
  const { user } = auth
  const realtime = useRealtime()
  const questionBank = useQuestionBank()

  const reloadQuestionBank = () => {
    if (!auth.hasPermission('questions:read')) return
    void questionBank.loadQuestions().catch(() => {})
    void questionBank.loadMyQuestions().catch(() => {})
  }

  realtime.on('question.created', (payload: any) => {
    if (!payload?.question) return
    if (auth.hasPermission('questions:read') && payload.actorId !== user.value?.id) {
      questionBank.addQuestionLocally(payload.question)
    }
  })
  realtime.on('question.updated', (payload: any) => {
    if (!payload?.question) return
    if (auth.hasPermission('questions:read') && payload.actorId !== user.value?.id) {
      questionBank.replaceQuestionLocally(payload.question)
    }
  })
  realtime.on('question.deleted', (payload: any) => {
    if (!auth.hasPermission('questions:read')) return
    if (payload?.questionId !== undefined) questionBank.removeQuestionLocally(payload.questionId)
    else reloadQuestionBank()
  })

  realtime.on('paper.created', (payload: any) => {
    if (payload?.paper) {
      console.info('[Session] Paper created by another user:', payload.paper.publicId)
    }
  })
  realtime.on('paper.updated', (payload: any) => {
    if (payload?.paper) {
      console.info('[Session] Paper updated by another user:', payload.paper.publicId)
    }
  })
  realtime.on('paper.questions.added', (payload: any) => {
    if (payload?.paperId) {
      console.info('[Session] Questions added to paper:', payload.paperId)
    }
  })
  realtime.on('paper.question.removed', (payload: any) => {
    if (payload?.paperId) {
      console.info('[Session] Question removed from paper:', payload.paperId)
    }
  })
  realtime.on('paper.questions.reordered', (payload: any) => {
    if (payload?.paperId) {
      console.info('[Session] Paper questions reordered:', payload.paperId)
    }
  })

  await auth.loadSession({ force: true })
  auth.scheduleRefresh()

  if (auth.isAuthenticated.value) {
    realtime.connect()
  }

  watch(auth.isAuthenticated, (authenticated) => {
    if (authenticated) realtime.connect()
    else realtime.disconnect()
  })
})
