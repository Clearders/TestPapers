<template>
  <article class="bank-card card">
    <div class="bank-card-head">
      <div class="bank-card-title">
        <h3>{{ bank.name }}</h3>
        <span class="tag">{{ visibilityLabel(bank.visibility) }}</span>
      </div>
      <div class="bank-card-owner">
        <AppIcon name="account" />
        <span>{{ ownerName }}</span>
        <span class="badge bank-role-badge">{{ accessRoleLabel(bank.accessRole) }}</span>
      </div>
    </div>

    <p v-if="bank.description" class="bank-card-desc">{{ bank.description }}</p>

    <div class="bank-card-stats">
      <span>{{ bank.itemCount }} 题</span>
      <span>{{ bank.memberCount }} 成员</span>
      <span>{{ bank.subscriberCount }} 订阅</span>
      <span>{{ versionLabel }}</span>
    </div>

    <div class="bank-card-actions">
      <template v-if="showSubscribe">
        <button
          v-if="!subscribed"
          type="button"
          class="btn btn-outline btn-sm"
          @click="emit('subscribe')"
        >
          <AppIcon name="users" />
          订阅
        </button>
        <button
          v-else
          type="button"
          class="btn btn-outline btn-sm"
          @click="emit('unsubscribe')"
        >
          <AppIcon name="x" />
          取消订阅
        </button>
      </template>

      <template v-if="isManageable && canPublish">
        <button
          type="button"
          class="btn btn-sm"
          :class="published ? 'btn-success' : 'btn-primary'"
          :disabled="published || bank.itemCount === 0"
          :title="publishDisabledTitle"
          @click="emit('publish')"
        >
          <AppIcon name="upload" />
          {{ published ? '已发布' : '发布' }}
        </button>
        <button
          v-if="published"
          type="button"
          class="btn btn-outline btn-sm"
          @click="emit('withdraw')"
        >
          <AppIcon name="arrow-down" />
          撤回
        </button>
      </template>

      <select
        v-if="canChangeVisibilityHere"
        class="form-input bank-visibility-select"
        :value="bank.visibility"
        aria-label="题库可见性"
        @change="onVisibilityChange"
      >
        <option v-for="option in visibilityOptions()" :key="option.value" :value="option.value">
          {{ option.label }}
        </option>
      </select>

      <button type="button" class="btn btn-primary btn-sm" @click="emit('open', bank)">
        <AppIcon name="eye" />
        打开
      </button>

      <button v-if="!isManageable" type="button" class="btn btn-outline btn-sm" @click="emit('fork')">
        <AppIcon name="add" />
        Fork
      </button>
    </div>
  </article>
</template>

<script setup lang="ts">
import { canChangeVisibility, canManageBank, visibilityLabel, visibilityOptions } from '~/domain/banks'
import type { BankVisibility, QuestionBank } from '~/types/bank'

const props = withDefaults(defineProps<{
  bank: QuestionBank
  subscribed?: boolean
}>(), {
  subscribed: false
})

const emit = defineEmits<{
  publish: []
  withdraw: []
  fork: []
  subscribe: []
  unsubscribe: []
  'update-visibility': [value: BankVisibility]
  open: [bank: QuestionBank]
}>()

const { hasPermission } = useAuth()

const isManageable = computed(() => canManageBank(props.bank))
const canPublish = computed(() => isManageable.value && hasPermission('banks:publish'))
const canSubscribe = computed(() => hasPermission('banks:subscribe'))
const published = computed(() => Boolean(props.bank.version))
const showSubscribe = computed(() => props.bank.visibility !== 'private' && !isManageable.value && canSubscribe.value)
const canChangeVisibilityHere = computed(() => isManageable.value && canChangeVisibility(props.bank))

const ownerName = computed(() => props.bank.owner?.displayName || props.bank.owner?.username || '—')
const versionLabel = computed(() => props.bank.version ? `v${props.bank.version}` : '未发布')
const publishDisabledTitle = computed(() => {
  if (published.value) return '题库已发布'
  if (props.bank.itemCount === 0) return '题库为空，无法发布'
  return ''
})

const accessRoleLabels: Record<QuestionBank['accessRole'], string> = {
  owner: 'Owner',
  admin: 'Admin',
  editor: 'Editor',
  viewer: 'Viewer'
}

function accessRoleLabel (role: QuestionBank['accessRole']) {
  return accessRoleLabels[role]
}

function onVisibilityChange (event: Event) {
  const value = (event.target as HTMLSelectElement).value as BankVisibility
  emit('update-visibility', value)
}
</script>

<style scoped>
.bank-card {
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-width: 0;
}

.bank-card-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
}

.bank-card-title {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  flex-wrap: wrap;
}

.bank-card-title h3 {
  font-size: 1rem;
  font-weight: 850;
  overflow-wrap: anywhere;
}

.bank-card-owner {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--color-muted);
  font-size: .82rem;
  white-space: nowrap;
}

.bank-role-badge {
  background: color-mix(in srgb, var(--color-secondary) 12%, var(--color-surface-solid));
  color: var(--color-secondary);
}

.bank-card-desc {
  color: var(--color-muted);
  font-size: .85rem;
  line-height: 1.5;
  overflow-wrap: anywhere;
}

.bank-card-stats {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 16px;
  font-size: .82rem;
  color: var(--color-muted);
}

.bank-card-stats span + span::before {
  content: "·";
  margin-right: 16px;
  color: color-mix(in srgb, var(--color-muted) 50%, transparent);
}

.bank-card-actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: auto;
  padding-top: 12px;
  border-top: 1px solid var(--color-border);
}

.bank-visibility-select {
  width: auto;
  min-width: 110px;
  min-height: 32px;
  padding: 4px 8px;
  font-size: .8rem;
}
</style>
