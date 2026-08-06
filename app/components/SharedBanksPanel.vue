<template>
  <div class="shared-banks-panel">
    <div class="panel-head">
      <div>
        <h2><AppIcon name="book" /> 共享题库</h2>
        <p class="panel-sub">浏览、订阅或 fork 团队共享的题库。</p>
      </div>
      <button
        v-if="canCreateBanks"
        type="button"
        class="btn btn-primary"
        @click="createOpen = !createOpen"
      >
        <AppIcon name="add" />
        {{ createOpen ? '取消' : '新建题库' }}
      </button>
    </div>

    <PermissionDeniedBanner
      v-if="!canCreateBanks"
      title="无创建权限"
      message="你的账号没有创建共享题库的权限，但可以浏览、订阅或 fork 现有题库。"
    />

    <form v-if="createOpen && canCreateBanks" class="bank-create-form card" @submit.prevent="onCreateBank">
      <div class="form-group">
        <label class="form-label" for="bank-name">题库名称</label>
        <input
          id="bank-name"
          v-model="createForm.name"
          class="form-input"
          name="bankName"
          placeholder="例如：高数期末复习"
          :disabled="creating"
        >
      </div>
      <div class="form-group">
        <label class="form-label" for="bank-description">描述</label>
        <input
          id="bank-description"
          v-model="createForm.description"
          class="form-input"
          name="bankDescription"
          placeholder="选填"
          :disabled="creating"
        >
      </div>
      <div class="form-group">
        <label class="form-label" for="bank-visibility">可见性</label>
        <select id="bank-visibility" v-model="createForm.visibility" class="form-input" name="bankVisibility" :disabled="creating">
          <option v-for="option in visibilityOptions()" :key="option.value" :value="option.value">
            {{ option.label }}
          </option>
        </select>
      </div>
      <div class="bank-create-actions">
        <button type="submit" class="btn btn-primary" :disabled="creating || !createForm.name.trim()">
          <AppIcon name="add" />
          {{ creating ? '创建中…' : '创建题库' }}
        </button>
      </div>
    </form>

    <div v-if="displayError" class="status-banner status-banner--error" role="alert" aria-live="polite">
      {{ displayError }}
    </div>

    <div v-if="isLoading" class="bank-state">
      <p>加载题库中…</p>
    </div>
    <div v-else-if="!banks.length" class="bank-state">
      <AppIcon name="book" />
      <p class="bank-state-title">还没有题库</p>
      <span class="bank-state-hint">创建或订阅一个共享题库，与团队一起维护题目。</span>
    </div>
    <div v-else class="bank-grid">
      <QuestionBankCard
        v-for="bank in banks"
        :key="bank.publicId"
        :bank="bank"
        :subscribed="subscribedMap[bank.publicId] || false"
        @open="openBank"
        @publish="onPublish(bank)"
        @withdraw="onWithdraw(bank)"
        @subscribe="onSubscribe(bank)"
        @unsubscribe="onUnsubscribe(bank)"
        @update-visibility="(visibility) => onUpdateVisibility(bank, visibility)"
        @fork="onFork(bank)"
      />
    </div>

    <div v-if="selectedBank" class="bank-detail card">
      <div class="bank-detail-head">
        <div>
          <h3><AppIcon name="book" /> {{ selectedBank.name }}</h3>
          <p class="panel-sub">{{ visibilityLabel(selectedBank.visibility) }} · {{ selectedBank.itemCount }} 题</p>
        </div>
        <button type="button" class="icon-btn" aria-label="关闭题库详情" @click="closeBankDetail">
          <AppIcon name="x" />
        </button>
      </div>

      <div v-if="bankLoading" class="bank-state bank-state--compact">
        <p>加载详情中…</p>
      </div>
      <template v-else>
        <div class="bank-detail-block">
          <h4>题目（{{ bankQuestions.length }}）</h4>
          <ul v-if="bankQuestions.length" class="bank-question-list">
            <li v-for="question in bankQuestions" :key="question.publicId" class="bank-question-item">
              <div class="bank-question-meta">
                <span class="tag">{{ questionTypeLabel(question.type) }}</span>
                <span class="badge" :class="`badge-${question.difficulty}`">{{ question.difficulty }}</span>
              </div>
              <p>{{ question.text }}</p>
            </li>
          </ul>
          <p v-else class="bank-empty-hint">题库中还没有题目。</p>
        </div>

        <div class="bank-detail-block">
          <h4>版本（{{ versions.length }}）</h4>
          <ul v-if="versions.length" class="bank-version-list">
            <li v-for="(version, index) in versions" :key="version.publicId" class="bank-version-row">
              <div>
                <strong>v{{ version.version }}</strong>
                <span>{{ version.createdBy?.displayName || version.createdBy?.username || '—' }} · {{ formatTimestamp(version.createdAt) }}</span>
              </div>
              <button
                v-if="index === 0"
                type="button"
                class="btn btn-outline btn-sm"
                @click="onForkVersion(version)"
              >
                <AppIcon name="add" />
                Fork
              </button>
            </li>
          </ul>
          <p v-else class="bank-empty-hint">还没有发布版本。</p>
        </div>

        <div class="bank-detail-block">
          <h4>新增题目</h4>
          <div class="bank-add-form">
            <input
              v-model="newQuestionId"
              class="form-input"
              name="bankQuestionPublicId"
              placeholder="题目 publicId"
              :disabled="addingItem"
            >
            <button
              type="button"
              class="btn btn-outline"
              :disabled="addingItem || !newQuestionId.trim()"
              @click="onAddItem"
            >
              <AppIcon name="add" />
              {{ addingItem ? '添加中…' : '添加' }}
            </button>
          </div>
          <p class="form-hint">输入题目的 publicId 将题目加入当前题库。</p>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { isBankItemConflict, visibilityLabel, visibilityOptions } from '~/domain/banks'
import { QUESTION_TYPE_LABELS } from '~/domain/questions'
import type { BankVisibility, BankVersionSummary, QuestionBank } from '~/types/bank'
import type { QuestionEntity } from '~/types/question'
import { apiErrorMessage } from '~/utils/apiError'
import { formatShortTimestamp } from '~/utils/format'

const {
  banks,
  isLoading,
  error,
  canCreateBanks,
  loadBanks,
  createBank,
  updateBank,
  listQuestions,
  addItems,
  publishBank,
  withdrawBank,
  listVersions,
  forkBank,
  subscribe,
  unsubscribe
} = useQuestionBanks()

const createOpen = ref(false)
const creating = ref(false)
const createForm = reactive({
  name: '',
  description: '',
  visibility: 'private' as BankVisibility
})
const selectedBank = ref<QuestionBank | null>(null)
const bankQuestions = ref<QuestionEntity[]>([])
const versions = ref<BankVersionSummary[]>([])
const bankLoading = ref(false)
const errorMessage = ref('')
const subscribedMap = reactive<Record<string, boolean>>({})
const newQuestionId = ref('')
const addingItem = ref(false)

const displayError = computed(() => errorMessage.value || error.value)

onMounted(() => {
  void loadBanks()
})

async function onCreateBank () {
  const name = createForm.name.trim()
  if (!name) return
  creating.value = true
  errorMessage.value = ''
  try {
    await createBank({
      name,
      description: createForm.description.trim() || undefined,
      visibility: createForm.visibility
    })
    createOpen.value = false
    createForm.name = ''
    createForm.description = ''
    createForm.visibility = 'private'
  } catch (err) {
    errorMessage.value = apiErrorMessage(err, '创建题库失败。')
  } finally {
    creating.value = false
  }
}

async function openBank (bank: QuestionBank) {
  selectedBank.value = bank
  bankQuestions.value = []
  versions.value = []
  bankLoading.value = true
  errorMessage.value = ''
  try {
    bankQuestions.value = await listQuestions(bank.publicId)
  } catch (err) {
    errorMessage.value = apiErrorMessage(err, '加载题库题目失败。')
  }
  try {
    versions.value = await listVersions(bank.publicId)
  } catch (err) {
    errorMessage.value = apiErrorMessage(err, '加载题库版本失败。')
  }
  bankLoading.value = false
}

function closeBankDetail () {
  selectedBank.value = null
  bankQuestions.value = []
  versions.value = []
  newQuestionId.value = ''
}

async function onPublish (bank: QuestionBank) {
  errorMessage.value = ''
  try {
    const updated = await publishBank(bank.publicId)
    syncSelectedBank(updated)
  } catch (err) {
    errorMessage.value = apiErrorMessage(err, '发布题库失败。')
  }
}

async function onWithdraw (bank: QuestionBank) {
  errorMessage.value = ''
  try {
    const updated = await withdrawBank(bank.publicId)
    syncSelectedBank(updated)
  } catch (err) {
    errorMessage.value = apiErrorMessage(err, '撤回题库失败。')
  }
}

async function onSubscribe (bank: QuestionBank) {
  errorMessage.value = ''
  try {
    await subscribe(bank.publicId)
    subscribedMap[bank.publicId] = true
  } catch (err) {
    errorMessage.value = apiErrorMessage(err, '订阅失败。')
  }
}

async function onUnsubscribe (bank: QuestionBank) {
  errorMessage.value = ''
  try {
    await unsubscribe(bank.publicId)
    subscribedMap[bank.publicId] = false
  } catch (err) {
    errorMessage.value = apiErrorMessage(err, '取消订阅失败。')
  }
}

async function onUpdateVisibility (bank: QuestionBank, visibility: BankVisibility) {
  errorMessage.value = ''
  try {
    const updated = await updateBank(bank.publicId, { visibility })
    syncSelectedBank(updated)
  } catch (err) {
    errorMessage.value = apiErrorMessage(err, '更新可见性失败。')
  }
}

async function onFork (bank: QuestionBank) {
  errorMessage.value = ''
  try {
    await forkBank(bank.publicId)
  } catch (err) {
    errorMessage.value = apiErrorMessage(err, 'Fork 题库失败。')
  }
}

async function onForkVersion (version: BankVersionSummary) {
  if (!selectedBank.value) return
  errorMessage.value = ''
  try {
    await forkBank(selectedBank.value.publicId, { version: version.version })
  } catch (err) {
    errorMessage.value = apiErrorMessage(err, 'Fork 版本失败。')
  }
}

async function onAddItem () {
  const questionPublicId = newQuestionId.value.trim()
  if (!questionPublicId || !selectedBank.value) return
  addingItem.value = true
  errorMessage.value = ''
  try {
    const updated = await addItems(selectedBank.value.publicId, { questionIds: [questionPublicId] })
    syncSelectedBank(updated)
    newQuestionId.value = ''
    bankQuestions.value = await listQuestions(selectedBank.value.publicId)
  } catch (err) {
    errorMessage.value = isBankItemConflict(err)
      ? '该题目已在题库中。'
      : apiErrorMessage(err, '添加题目失败。')
  } finally {
    addingItem.value = false
  }
}

function syncSelectedBank (updated: QuestionBank) {
  if (selectedBank.value?.publicId === updated.publicId) selectedBank.value = updated
}

function questionTypeLabel (type: QuestionEntity['type']) {
  return QUESTION_TYPE_LABELS[type] || type
}

const formatTimestamp = formatShortTimestamp
</script>

<style scoped>
.shared-banks-panel {
  min-width: 0;
  animation: revealUp 0.56s var(--ease-out) 0.08s both;
}

.panel-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 14px;
  animation: revealUp 0.42s var(--ease-out) both;
}

.panel-head h2 {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 1.05rem;
  font-weight: 850;
}

.panel-sub {
  color: var(--color-muted);
  font-size: .82rem;
  margin-top: 4px;
}

.bank-create-form {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 12px;
  align-items: end;
  margin-bottom: 18px;
}

.bank-create-form .form-group {
  margin-bottom: 0;
}

.bank-create-actions {
  display: flex;
  justify-content: flex-end;
}

.bank-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 40px 20px;
  color: var(--color-muted);
  text-align: center;
}

.bank-state .app-icon {
  width: 34px;
  height: 34px;
  color: var(--color-primary);
  opacity: .7;
}

.bank-state--compact {
  padding: 24px 12px;
}

.bank-state-title {
  font-size: 1rem;
  font-weight: 800;
  color: var(--color-text);
}

.bank-state-hint {
  font-size: .84rem;
}

.bank-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
}

.bank-detail {
  margin-top: 18px;
}

.bank-detail-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
}

.bank-detail-head h3 {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 1.02rem;
  font-weight: 850;
}

.icon-btn {
  display: inline-grid;
  place-items: center;
  width: 34px;
  height: 34px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-surface-solid);
  color: var(--color-muted);
}

.icon-btn:hover {
  color: var(--color-danger-text);
  border-color: var(--color-danger);
}

.bank-detail-block + .bank-detail-block {
  margin-top: 18px;
  padding-top: 16px;
  border-top: 1px solid var(--color-border);
}

.bank-detail-block h4 {
  font-size: .9rem;
  font-weight: 850;
  margin-bottom: 10px;
}

.bank-question-list,
.bank-version-list {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.bank-question-item,
.bank-version-row {
  padding: 10px 12px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  background: color-mix(in srgb, var(--color-surface-solid) 70%, transparent);
}

.bank-question-meta {
  display: flex;
  gap: 6px;
  margin-bottom: 6px;
}

.bank-question-item p {
  font-size: .86rem;
  line-height: 1.5;
  color: var(--color-text);
  overflow-wrap: anywhere;
}

.bank-version-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.bank-version-row strong,
.bank-version-row span {
  display: block;
}

.bank-version-row span {
  color: var(--color-muted);
  font-size: .8rem;
  margin-top: 2px;
}

.bank-empty-hint {
  color: var(--color-muted);
  font-size: .85rem;
}

.bank-add-form {
  display: flex;
  align-items: center;
  gap: 10px;
}

.bank-add-form .form-input {
  flex: 1;
  min-width: 0;
}
</style>
