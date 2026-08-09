<template>
  <section v-if="bankView" class="bank-page">
    <NuxtLink to="/banks" class="back-link">← All question banks</NuxtLink>

    <header class="bank-hero card">
      <div>
        <div class="bank-kicker">
          <span class="tag">{{ visibilityLabel }}</span>
          <span v-if="canEdit && activeVersion">Working copy · published version {{ activeVersion }}</span>
          <span v-else-if="activeVersion">Published version {{ activeVersion }}</span>
          <span v-else>Unpublished draft</span>
        </div>
        <h1>{{ bankView.name }}</h1>
        <p>{{ bankView.description || 'No description provided.' }}</p>
        <p class="bank-owner">Maintained by {{ bankView.owner?.displayName || bankView.owner?.username || 'Unknown owner' }}</p>
      </div>
      <div class="bank-actions">
        <button v-if="!isAuthenticated && activeVersion" type="button" class="btn btn-primary" @click="requireLogin">
          Subscribe
        </button>
        <button
          v-else-if="authenticatedBank && !authenticatedBank.isSubscribed && activeVersion && canSubscribe"
          type="button"
          class="btn btn-primary"
          :disabled="actionPending"
          @click="subscribeToActive"
        >
          Subscribe to version {{ activeVersion }}
        </button>
        <button
          v-if="isAuthenticated && activeVersion && !isManageable"
          type="button"
          class="btn btn-outline"
          :disabled="actionPending"
          @click="forkActive"
        >
          Fork version {{ activeVersion }}
        </button>
        <button
          v-if="canPublish && !activeVersion && bankQuestions.length"
          type="button"
          class="btn btn-primary"
          :disabled="actionPending"
          @click="publishCurrent"
        >
          Publish version {{ nextVersion }}
        </button>
        <button
          v-if="canPublish && activeVersion"
          type="button"
          class="btn btn-outline"
          :disabled="actionPending"
          @click="withdrawOpen = true"
        >
          Withdraw publication
        </button>
      </div>
    </header>

    <div v-if="statusMessage" class="status-banner status-banner--success" role="status" aria-live="polite">
      {{ statusMessage }}
      <NuxtLink v-if="forkPath" :to="forkPath" class="status-link" aria-label="Open fork">Open fork</NuxtLink>
    </div>
    <div v-if="actionError" class="status-banner status-banner--error" role="alert">{{ actionError }}</div>

    <section v-if="authenticatedBank?.isSubscribed" class="subscription-card card" aria-label="Subscription status">
      <div>
        <h2>Subscribed to version {{ authenticatedBank.subscribedVersion ?? 'pending' }}</h2>
        <p v-if="authenticatedBank.hasUpdate">Update available: version {{ activeVersion }}</p>
        <p v-else>Your subscription stays pinned until you explicitly update it.</p>
      </div>
      <div class="subscription-actions">
        <button
          v-if="authenticatedBank.hasUpdate && activeVersion"
          type="button"
          class="btn btn-primary"
          @click="updateOpen = true"
        >
          Update to version {{ activeVersion }}
        </button>
        <button type="button" class="btn btn-outline" :disabled="actionPending" @click="unsubscribeCurrent">
          Unsubscribe
        </button>
      </div>
    </section>

    <section v-if="isManageable" class="manage-card card" aria-label="Manage bank">
      <div class="section-heading">
        <div>
          <h2>Manage bank</h2>
          <p>Changes affect the authoring bank. Published snapshots remain immutable.</p>
        </div>
        <NuxtLink v-if="activeVersion" :to="route.fullPath" aria-label="Public bank link">Public bank link</NuxtLink>
      </div>
      <div v-if="canEdit" class="question-picker">
        <label>
          <span class="form-label">Add question to bank</span>
          <input
            v-model="questionSearch"
            class="form-input"
            type="search"
            placeholder="Search your questions"
            @input="scheduleQuestionSearch"
          >
        </label>
        <ul v-if="questionResults.length" class="question-results" role="listbox" aria-label="Question search results">
          <li v-for="question in questionResults" :key="question.publicId">
            <button
              type="button"
              role="option"
              :aria-selected="selectedQuestionId === question.publicId"
              @click="selectedQuestionId = question.publicId"
            >
              {{ question.text }}
            </button>
          </li>
        </ul>
        <button
          type="button"
          class="btn btn-outline"
          :disabled="!selectedQuestionId || actionPending"
          @click="addSelectedQuestion"
        >
          Add question
        </button>
      </div>
    </section>

    <section class="questions-card card" aria-label="Bank questions">
      <div class="section-heading">
        <div>
          <h2>Bank questions</h2>
          <p>{{ renderedQuestions.length }} questions in {{ canEdit ? 'the working bank' : activeVersion ? `published version ${activeVersion}` : 'the working bank' }}.</p>
        </div>
      </div>
      <ol v-if="renderedQuestions.length" class="question-list">
        <li v-for="question in renderedQuestions" :key="question.publicId">
          <div class="question-meta">
            <span class="tag">{{ question.type }}</span>
            <span>{{ question.difficulty }}</span>
          </div>
          <p>{{ question.text }}</p>
        </li>
      </ol>
      <div v-else class="empty-questions">This bank does not contain any questions yet.</div>
    </section>

    <section v-if="versions.length" class="versions-card card" aria-label="Publication history">
      <h2>Publication history</h2>
      <ul>
        <li v-for="version in [...versions].reverse()" :key="version.publicId">
          <strong>Version {{ version.version }}</strong>
          <span>{{ version.isActive ? 'Active' : 'Withdrawn' }}</span>
          <time :datetime="version.createdAt">{{ formatTimestamp(version.createdAt) }}</time>
        </li>
      </ul>
    </section>

    <div v-if="withdrawOpen" class="dialog-backdrop" role="presentation" @click.self="withdrawOpen = false">
      <section class="confirm-dialog card" role="dialog" aria-modal="true" aria-labelledby="withdraw-title">
        <h2 id="withdraw-title">Withdraw this publication?</h2>
        <p>The public link will stop resolving, while the immutable version remains in history.</p>
        <div>
          <button type="button" class="btn btn-outline" @click="withdrawOpen = false">Cancel</button>
          <button type="button" class="btn btn-primary" @click="withdrawCurrent">Confirm withdrawal</button>
        </div>
      </section>
    </div>

    <div v-if="updateOpen" class="dialog-backdrop" role="presentation" @click.self="updateOpen = false">
      <section class="confirm-dialog card" role="dialog" aria-modal="true" aria-labelledby="update-title">
        <h2 id="update-title">Update this subscription?</h2>
        <p>Your subscription will advance to version {{ activeVersion }}. Existing forks and local edits will not change.</p>
        <div>
          <button type="button" class="btn btn-outline" @click="updateOpen = false">Cancel</button>
          <button type="button" class="btn btn-primary" @click="confirmSubscriptionUpdate">Confirm update</button>
        </div>
      </section>
    </div>
  </section>
</template>

<script setup lang="ts">
import type {
  BankSnapshotItem,
  BankVersionSummary,
  PublicBankDetail,
  QuestionBank
} from '~/types/bank'
import type { QuestionEntity } from '~/types/question'
import { apiErrorMessage } from '~/utils/apiError'
import { formatShortTimestamp } from '~/utils/format'

const route = useRoute()
const publicId = String(route.params.publicId || '')
const { isAuthenticated, loadSession, hasPermission } = useAuth()
const {
  getBank,
  getPublicBank,
  listQuestions,
  listVersions,
  addItems,
  publishBank,
  withdrawBank,
  subscribe,
  unsubscribe,
  updateSubscription,
  forkBank
} = useQuestionBanks()
const { questions, loadQuestions } = useQuestionBank()

const publicBank = ref<PublicBankDetail | null>(null)
const authenticatedBank = ref<QuestionBank | null>(null)
const bankQuestions = ref<QuestionEntity[]>([])
const versions = ref<BankVersionSummary[]>([])
const questionSearch = ref('')
const selectedQuestionId = ref('')
const actionPending = ref(false)
const actionError = ref('')
const statusMessage = ref('')
const forkPath = ref('')
const withdrawOpen = ref(false)
const updateOpen = ref(false)
let searchTimer: ReturnType<typeof setTimeout> | null = null

await loadSession()
await loadDetails()

const isManageable = computed(() => authenticatedBank.value?.accessRole === 'owner' || authenticatedBank.value?.accessRole === 'admin')
const canEdit = computed(() => Boolean(authenticatedBank.value && ['owner', 'admin', 'editor'].includes(authenticatedBank.value.accessRole)))
const bankView = computed(() => canEdit.value ? authenticatedBank.value : publicBank.value || authenticatedBank.value)
const activeVersion = computed(() => canEdit.value
  ? authenticatedBank.value?.version || null
  : publicBank.value?.version || authenticatedBank.value?.version || null)
const nextVersion = computed(() => Math.max(0, ...versions.value.map(item => item.version)) + 1)
const canPublish = computed(() => isManageable.value && hasPermission('banks:publish'))
const canSubscribe = computed(() => hasPermission('banks:subscribe'))
const visibilityLabel = computed(() => authenticatedBank.value?.visibility || 'public')
const questionResults = computed(() => questions.value.filter(item => !bankQuestions.value.some(existing => existing.publicId === item.publicId)))
const renderedQuestions = computed(() => {
  if (canEdit.value) return bankQuestions.value
  if (publicBank.value?.state.items) return publicBank.value.state.items.map(snapshotQuestion)
  return bankQuestions.value
})

useSeoMeta({
  title: () => bankView.value?.name || 'Question Bank',
  description: () => bankView.value?.description || 'A versioned TestPapers question bank.',
  ogTitle: () => bankView.value?.name || 'Question Bank',
  ogDescription: () => bankView.value?.description || 'A versioned TestPapers question bank.',
  ogType: 'article'
})

async function loadDetails () {
  publicBank.value = null
  authenticatedBank.value = null
  bankQuestions.value = []
  versions.value = []

  try {
    publicBank.value = await getPublicBank(publicId)
  } catch {
    // Private, withdrawn, and unpublished banks intentionally share a public 404.
  }

  if (isAuthenticated.value) {
    try {
      authenticatedBank.value = await getBank(publicId)
      const [loadedQuestions, loadedVersions] = await Promise.all([
        listQuestions(publicId),
        listVersions(publicId)
      ])
      bankQuestions.value = loadedQuestions
      versions.value = loadedVersions
    } catch (cause) {
      if (!publicBank.value) throw createError({ statusCode: 404, statusMessage: 'Question bank not found', cause })
    }
  }

  if (!publicBank.value && !authenticatedBank.value) {
    throw createError({ statusCode: 404, statusMessage: 'Question bank not found' })
  }
}

function snapshotQuestion (item: BankSnapshotItem): QuestionEntity {
  return {
    id: 0,
    publicId: item.publicId,
    type: item.data.type,
    subjects: item.data.subjects || [],
    difficulty: item.data.difficulty as QuestionEntity['difficulty'],
    tags: item.data.tags || [],
    text: item.data.text,
    options: item.data.options,
    answer: item.data.answer ?? '[redacted]',
    hasLatex: Boolean(item.data.hasLatex),
    source: item.data.source,
    essayBlankSpace: item.data.essayBlankSpace,
    images: item.data.images || [],
    scoreWeight: item.data.scoreWeight || 1,
    ownerId: null,
    createdAt: publicBank.value?.publishedAt || '',
    updatedAt: publicBank.value?.publishedAt || ''
  }
}

function requireLogin () {
  void navigateTo({ path: '/login', query: { redirect: route.fullPath } })
}

async function runAction (operation: () => Promise<void>) {
  actionPending.value = true
  actionError.value = ''
  statusMessage.value = ''
  try {
    await operation()
  } catch (cause) {
    actionError.value = apiErrorMessage(cause, 'The bank operation failed.')
  } finally {
    actionPending.value = false
  }
}

async function subscribeToActive () {
  if (!activeVersion.value) return
  await runAction(async () => {
    await subscribe(publicId)
    statusMessage.value = `Subscribed to version ${activeVersion.value}`
    await loadDetails()
  })
}

async function unsubscribeCurrent () {
  await runAction(async () => {
    await unsubscribe(publicId)
    statusMessage.value = 'Subscription removed'
    await loadDetails()
  })
}

async function confirmSubscriptionUpdate () {
  if (!activeVersion.value) return
  await runAction(async () => {
    await updateSubscription(publicId, activeVersion.value!)
    updateOpen.value = false
    statusMessage.value = `Subscribed to version ${activeVersion.value}`
    await loadDetails()
  })
}

async function forkActive () {
  if (!activeVersion.value) return
  await runAction(async () => {
    const fork = await forkBank(publicId, { version: activeVersion.value! })
    forkPath.value = `/banks/${fork.publicId}`
    statusMessage.value = 'Fork created as a private bank'
  })
}

async function publishCurrent () {
  await runAction(async () => {
    await publishBank(publicId)
    statusMessage.value = `Published version ${nextVersion.value}`
    await loadDetails()
  })
}

async function withdrawCurrent () {
  await runAction(async () => {
    await withdrawBank(publicId)
    withdrawOpen.value = false
    statusMessage.value = 'Publication withdrawn'
    await loadDetails()
  })
}

function scheduleQuestionSearch () {
  selectedQuestionId.value = ''
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    searchTimer = null
    if (questionSearch.value.trim()) void loadQuestions({ q: questionSearch.value.trim(), pageSize: 8 })
  }, 200)
}

async function addSelectedQuestion () {
  if (!selectedQuestionId.value) return
  await runAction(async () => {
    await addItems(publicId, { questionIds: [selectedQuestionId.value] })
    selectedQuestionId.value = ''
    questionSearch.value = ''
    statusMessage.value = 'Question added to the bank'
    await loadDetails()
  })
}

onBeforeUnmount(() => {
  if (searchTimer) clearTimeout(searchTimer)
})

const formatTimestamp = formatShortTimestamp
</script>

<style scoped>
.bank-page { width: min(1040px, calc(100% - 32px)); margin: 0 auto; padding: 24px 0 64px; display: grid; gap: 18px; }
.back-link { width: fit-content; color: var(--color-muted); font-weight: 750; }
.bank-hero { display: flex; justify-content: space-between; gap: 28px; align-items: flex-start; }
.bank-hero h1 { font-size: clamp(2rem, 5vw, 3.2rem); margin: 10px 0; }
.bank-hero p { color: var(--color-muted); max-width: 680px; line-height: 1.55; }
.bank-kicker, .bank-actions, .subscription-actions { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
.bank-kicker { color: var(--color-muted); font-size: .82rem; }
.bank-owner { margin-top: 12px; font-size: .82rem; }
.bank-actions { justify-content: flex-end; }
.subscription-card, .section-heading { display: flex; justify-content: space-between; gap: 20px; align-items: center; }
.subscription-card h2, .manage-card h2, .questions-card h2, .versions-card h2 { font-size: 1.05rem; margin-bottom: 5px; }
.subscription-card p, .section-heading p { color: var(--color-muted); font-size: .84rem; }
.question-picker { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 10px; margin-top: 18px; align-items: end; position: relative; }
.question-results { grid-column: 1; list-style: none; border: 1px solid var(--color-border); border-radius: var(--radius-sm); overflow: hidden; }
.question-results button { width: 100%; padding: 10px 12px; border: 0; border-bottom: 1px solid var(--color-border); background: var(--color-surface-solid); color: var(--color-text); text-align: left; }
.question-results button[aria-selected="true"] { background: color-mix(in srgb, var(--color-primary) 14%, var(--color-surface-solid)); }
.question-list { list-style: none; display: grid; gap: 10px; margin-top: 16px; }
.question-list li { padding: 14px; border: 1px solid var(--color-border); border-radius: var(--radius-sm); }
.question-list p { margin-top: 8px; line-height: 1.55; }
.question-meta { display: flex; gap: 10px; align-items: center; color: var(--color-muted); font-size: .78rem; }
.empty-questions { padding: 30px; text-align: center; color: var(--color-muted); }
.versions-card ul { list-style: none; display: grid; gap: 8px; margin-top: 14px; }
.versions-card li { display: grid; grid-template-columns: 1fr auto auto; gap: 14px; padding: 10px; border-bottom: 1px solid var(--color-border); }
.status-link { margin-left: 12px; text-decoration: underline; }
.dialog-backdrop { position: fixed; inset: 0; z-index: 50; display: grid; place-items: center; padding: 20px; background: rgba(15, 23, 42, .62); }
.confirm-dialog { width: min(480px, 100%); }
.confirm-dialog p { color: var(--color-muted); margin: 10px 0 18px; line-height: 1.5; }
.confirm-dialog > div { display: flex; justify-content: flex-end; gap: 10px; }
@media (max-width: 720px) {
  .bank-hero, .subscription-card, .section-heading { flex-direction: column; align-items: flex-start; }
  .bank-actions { justify-content: flex-start; }
  .question-picker { grid-template-columns: 1fr; }
  .question-results { grid-column: 1; }
}
</style>
