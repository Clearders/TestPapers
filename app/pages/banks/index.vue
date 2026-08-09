<template>
  <section class="banks-page">
    <header class="banks-hero">
      <div>
        <p class="eyebrow">Shared library</p>
        <h1>Question banks</h1>
        <p>Discover immutable published collections, subscribe to a version, or create a private fork.</p>
      </div>
      <button v-if="canCreateBanks" type="button" class="btn btn-primary" @click="createOpen = !createOpen">
        <AppIcon name="add" />
        Create bank
      </button>
    </header>

    <form v-if="createOpen" class="card create-card" aria-label="Create bank" @submit.prevent="submitCreate">
      <label class="form-group">
        <span class="form-label">Bank name</span>
        <input v-model="createForm.name" class="form-input" required maxlength="120">
      </label>
      <label class="form-group">
        <span class="form-label">Description</span>
        <textarea v-model="createForm.description" class="form-input" maxlength="1000" rows="3" />
      </label>
      <label class="form-group">
        <span class="form-label">Visibility</span>
        <select v-model="createForm.visibility" class="form-input">
          <option value="private">Private</option>
          <option value="team">Team</option>
          <option value="public">Public</option>
        </select>
      </label>
      <div class="form-actions">
        <button type="button" class="btn btn-outline" @click="createOpen = false">Cancel</button>
        <button type="submit" class="btn btn-primary" :disabled="creating || !createForm.name.trim()">
          {{ creating ? 'Creating…' : 'Create bank' }}
        </button>
      </div>
    </form>

    <form class="bank-filters card" role="search" @submit.prevent="applyFilters">
      <label class="filter-search">
        <span class="sr-only">Search banks</span>
        <input v-model="search" class="form-input" type="search" placeholder="Search banks" aria-label="Search banks">
      </label>
      <label v-if="isAuthenticated">
        <span class="sr-only">Bank scope</span>
        <select v-model="scope" class="form-input" aria-label="Bank scope" @change="applyFilters">
          <option value="visible">Visible to me</option>
          <option value="owned">Owned by me</option>
          <option value="subscribed">Subscribed</option>
          <option value="public">Public</option>
        </select>
      </label>
      <button type="submit" class="btn btn-outline">Search</button>
    </form>

    <div v-if="error" class="status-banner status-banner--error" role="alert">{{ error }}</div>
    <div v-if="isLoading" class="bank-state" aria-live="polite">Loading question banks…</div>
    <div v-else-if="!displayBanks.length" class="bank-state card">
      <AppIcon name="book" />
      <h2>No banks found</h2>
      <p>Try another search, or publish the first bank in this view.</p>
    </div>
    <div v-else class="bank-grid" aria-label="Question banks">
      <article v-for="bank in displayBanks" :key="bank.publicId" class="bank-card card" :aria-label="bank.name">
        <div class="bank-card__head">
          <div>
            <h2>{{ bank.name }}</h2>
            <p>{{ bank.description || 'No description provided.' }}</p>
          </div>
          <span class="tag">{{ bankVisibility(bank) }}</span>
        </div>
        <dl class="bank-stats">
          <div><dt>Questions</dt><dd>{{ bank.itemCount }}</dd></div>
          <div><dt>Subscribers</dt><dd>{{ bank.subscriberCount }}</dd></div>
          <div><dt>Version</dt><dd>{{ bank.version ? `v${bank.version}` : 'Draft' }}</dd></div>
        </dl>
        <p v-if="isAuthenticatedBank(bank) && bank.hasUpdate" class="update-note" role="status">
          Update available: version {{ bank.version }}
        </p>
        <div class="bank-card__actions">
          <NuxtLink :to="`/banks/${bank.publicId}`" class="btn btn-primary">
            {{ isManageable(bank) ? 'Manage bank' : 'Open bank' }}
          </NuxtLink>
        </div>
      </article>
    </div>
  </section>
</template>

<script setup lang="ts">
import type {
  BankListScope,
  BankVisibility,
  PublicBankSummary,
  QuestionBank,
  QuestionBankSummary
} from '~/types/bank'

const route = useRoute()
const router = useRouter()
const { isAuthenticated, loadSession, hasPermission } = useAuth()
const {
  banks,
  publicBanks,
  isLoading,
  error,
  loadBanks,
  loadPublicBanks,
  createBank
} = useQuestionBanks()

const search = ref(typeof route.query.q === 'string' ? route.query.q : '')
const scope = ref<BankListScope>(isBankScope(route.query.scope) ? route.query.scope : 'visible')
const createOpen = ref(false)
const creating = ref(false)
const createForm = reactive({ name: '', description: '', visibility: 'private' as BankVisibility })
const canCreateBanks = computed(() => isAuthenticated.value && hasPermission('banks:write'))
const displayBanks = computed<Array<QuestionBank | QuestionBankSummary | PublicBankSummary>>(
  () => isAuthenticated.value ? banks.value : publicBanks.value
)

await loadSession()
await refreshBanks()

useSeoMeta({
  title: 'Shared Question Banks',
  description: 'Discover, publish, subscribe to, and fork versioned TestPapers question banks.',
  ogTitle: 'Shared Question Banks',
  ogDescription: 'Discover versioned question banks published with TestPapers.'
})

function isBankScope (value: unknown): value is BankListScope {
  return value === 'visible' || value === 'owned' || value === 'subscribed' || value === 'public'
}

function isAuthenticatedBank (bank: QuestionBank | QuestionBankSummary | PublicBankSummary): bank is QuestionBankSummary {
  return 'accessRole' in bank
}

function isManageable (bank: QuestionBank | QuestionBankSummary | PublicBankSummary) {
  return isAuthenticatedBank(bank) && (bank.accessRole === 'owner' || bank.accessRole === 'admin')
}

function bankVisibility (bank: QuestionBank | QuestionBankSummary | PublicBankSummary) {
  return 'visibility' in bank ? bank.visibility : 'public'
}

async function refreshBanks () {
  if (isAuthenticated.value) {
    await loadBanks({ q: search.value.trim() || undefined, scope: scope.value })
  } else {
    await loadPublicBanks({ q: search.value.trim() || undefined })
  }
}

async function applyFilters () {
  await router.replace({
    query: {
      ...(search.value.trim() ? { q: search.value.trim() } : {}),
      ...(isAuthenticated.value && scope.value !== 'visible' ? { scope: scope.value } : {})
    }
  })
  await refreshBanks()
}

async function submitCreate () {
  if (!createForm.name.trim()) return
  creating.value = true
  try {
    const bank = await createBank({
      name: createForm.name.trim(),
      description: createForm.description.trim() || undefined,
      visibility: createForm.visibility
    })
    createOpen.value = false
    await navigateTo(`/banks/${bank.publicId}`)
  } catch {
    // The shared composable exposes the API error in the page alert.
  } finally {
    creating.value = false
  }
}
</script>

<style scoped>
.banks-page { width: min(1180px, calc(100% - 32px)); margin: 0 auto; padding: 34px 0 64px; }
.banks-hero { display: flex; justify-content: space-between; gap: 24px; align-items: flex-end; margin-bottom: 22px; }
.banks-hero h1 { font-size: clamp(2rem, 5vw, 3.4rem); line-height: 1; margin: 4px 0 12px; }
.banks-hero p { color: var(--color-muted); max-width: 700px; }
.eyebrow { color: var(--color-primary) !important; font-weight: 850; text-transform: uppercase; letter-spacing: .12em; font-size: .72rem; }
.create-card { display: grid; grid-template-columns: 1fr 1.5fr .7fr; gap: 14px; margin-bottom: 18px; }
.form-actions { grid-column: 1 / -1; display: flex; justify-content: flex-end; gap: 10px; }
.bank-filters { display: grid; grid-template-columns: minmax(220px, 1fr) minmax(150px, auto) auto; gap: 10px; margin-bottom: 22px; }
.bank-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(285px, 1fr)); gap: 16px; }
.bank-card { display: flex; flex-direction: column; gap: 18px; }
.bank-card__head { display: flex; justify-content: space-between; gap: 14px; align-items: flex-start; }
.bank-card h2 { font-size: 1.08rem; margin-bottom: 6px; }
.bank-card p { color: var(--color-muted); font-size: .86rem; line-height: 1.5; }
.bank-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
.bank-stats div { padding: 9px; border-radius: var(--radius-sm); background: color-mix(in srgb, var(--color-primary) 6%, transparent); }
.bank-stats dt { color: var(--color-muted); font-size: .7rem; }
.bank-stats dd { font-weight: 850; margin-top: 2px; }
.bank-card__actions { display: flex; margin-top: auto; }
.update-note { color: var(--color-warning-text) !important; font-weight: 750; }
.bank-state { padding: 48px 20px; text-align: center; color: var(--color-muted); }
.bank-state h2 { color: var(--color-text); margin: 8px 0; }
.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }
@media (max-width: 760px) {
  .banks-hero { align-items: flex-start; flex-direction: column; }
  .create-card, .bank-filters { grid-template-columns: 1fr; }
}
</style>
