<template>
  <Transition name="drawer">
    <aside v-if="open" class="comments-drawer" aria-label="Draft comments">
      <div class="comments-head">
        <div>
          <h2><AppIcon name="edit" /> Comments</h2>
          <p>{{ activeDraftName || 'Cloud draft' }}</p>
        </div>
        <button type="button" class="icon-btn" aria-label="Close comments" @click="emit('update:open', false)">
          <AppIcon name="x" />
        </button>
      </div>

      <div class="comments-filters" aria-label="Comment filter">
        <button
          v-for="option in filterOptions"
          :key="option.value"
          type="button"
          class="btn btn-sm"
          :class="filter === option.value ? 'btn-primary' : 'btn-outline'"
          @click="emit('update:filter', option.value)"
        >
          {{ option.label }}
        </button>
      </div>

      <form v-if="canComment" class="comment-form" @submit.prevent="emit('add-comment')">
        <label class="form-label" for="draft-comment-target">Target</label>
        <select id="draft-comment-target" v-model="selectedQuestionModel" class="form-input" name="draftCommentTarget">
          <option value="">Draft-level comment</option>
          <option v-for="(question, index) in questions" :key="question.publicId" :value="question.publicId">
            Q{{ index + 1 }} - {{ question.text.slice(0, 64) }}
          </option>
        </select>
        <label class="form-label" for="draft-comment-message">Comment</label>
        <textarea
          id="draft-comment-message"
          v-model="messageModel"
          class="form-input"
          name="draftCommentMessage"
          rows="3"
          placeholder="Add a review note..."
        />
        <button type="submit" class="btn btn-primary" :disabled="!message.trim()">
          <AppIcon name="add" />
          Add Comment
        </button>
      </form>

      <div class="comment-list">
        <article v-for="comment in filteredComments" :key="comment.publicId" class="comment-item">
          <div class="comment-meta">
            <span class="tag" :class="comment.status === 'open' ? 'comment-open' : 'comment-resolved'">
              {{ comment.status }}
            </span>
            <span>{{ targetLabel(comment.questionPublicId) }}</span>
            <span>{{ formatTimestamp(comment.updatedAt) }}</span>
          </div>
          <p>{{ comment.message }}</p>
          <div class="comment-foot">
            <span>{{ comment.author?.displayName || 'Unknown user' }}</span>
            <button
              type="button"
              class="btn btn-outline btn-sm"
              @click="emit('update-comment-status', comment.publicId, comment.status === 'open' ? 'resolved' : 'open')"
            >
              {{ comment.status === 'open' ? 'Resolve' : 'Reopen' }}
            </button>
          </div>
        </article>
        <div v-if="!filteredComments.length" class="empty-comments">
          No {{ filter === 'all' ? '' : filter }} comments.
        </div>
      </div>
    </aside>
  </Transition>
</template>

<script setup lang="ts">
import type { DraftComment, DraftCommentStatus } from '~/types/draft'
import type { PaperQuestion } from '~/domain/papers'

type CommentFilter = 'open' | 'resolved' | 'all'

const props = defineProps<{
  open: boolean
  comments: DraftComment[]
  questions: PaperQuestion[]
  activeDraftName: string
  canComment: boolean
  filter: CommentFilter
  message: string
  selectedQuestionPublicId: string
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  'update:filter': [value: CommentFilter]
  'update:message': [value: string]
  'update:selectedQuestionPublicId': [value: string]
  'add-comment': []
  'update-comment-status': [commentPublicId: string, status: DraftCommentStatus]
}>()

const filterOptions: { value: CommentFilter, label: string }[] = [
  { value: 'open', label: 'Open' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'all', label: 'All' }
]

const messageModel = computed({
  get: () => props.message,
  set: (value: string) => emit('update:message', value)
})

const selectedQuestionModel = computed({
  get: () => props.selectedQuestionPublicId,
  set: (value: string) => emit('update:selectedQuestionPublicId', value)
})

const filteredComments = computed(() => {
  if (props.filter === 'all') return props.comments
  return props.comments.filter(comment => comment.status === props.filter)
})

function targetLabel (questionPublicId?: string | null) {
  if (!questionPublicId) return 'Draft'
  const index = props.questions.findIndex(question => question.publicId === questionPublicId)
  return index === -1 ? 'Question' : `Q${index + 1}`
}

function formatTimestamp (value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'just now'
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}
</script>

<style scoped>
.comments-drawer {
  position: fixed;
  z-index: 145;
  top: calc(var(--header-h) + 14px);
  right: 18px;
  bottom: 18px;
  width: min(420px, calc(100vw - 32px));
  display: flex;
  flex-direction: column;
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  background: var(--color-surface-raised);
  box-shadow: var(--shadow);
  overflow: hidden;
}

.comments-head,
.comment-foot,
.comment-meta,
.comments-filters {
  display: flex;
  align-items: center;
  gap: 10px;
}

.comments-head {
  justify-content: space-between;
  padding: 16px 18px;
  border-bottom: 1px solid var(--color-border);
  background:
    linear-gradient(135deg, rgba(118, 87, 255, 0.08), rgba(14, 165, 233, 0.04)),
    var(--color-surface);
}

.comments-head h2 {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 1.02rem;
  font-weight: 850;
}

.comments-head p,
.comment-meta,
.comment-foot,
.empty-comments {
  color: var(--color-muted);
  font-size: .82rem;
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

.comments-filters {
  flex-wrap: wrap;
  padding: 12px 18px;
  border-bottom: 1px solid var(--color-border);
}

.comment-form {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 14px 18px;
  border-bottom: 1px solid var(--color-border);
}

.comment-form .btn {
  align-self: flex-start;
}

.comment-list {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 16px 18px;
}

.comment-item {
  padding: 12px 0;
  border-bottom: 1px solid var(--color-border);
}

.comment-item p {
  margin: 8px 0;
  line-height: 1.55;
  overflow-wrap: anywhere;
}

.comment-meta,
.comment-foot {
  justify-content: space-between;
  flex-wrap: wrap;
}

.comment-open {
  border-color: rgba(234, 179, 8, 0.26);
  background: rgba(234, 179, 8, 0.1);
  color: var(--color-warning);
}

.comment-resolved {
  border-color: rgba(34, 197, 94, 0.28);
  background: rgba(34, 197, 94, 0.08);
  color: var(--color-success-text);
}

.empty-comments {
  padding: 24px 0;
  text-align: center;
}

.drawer-enter-active,
.drawer-leave-active {
  transition: opacity .22s ease, transform .22s var(--ease-out);
}

.drawer-enter-from,
.drawer-leave-to {
  opacity: 0;
  transform: translateX(24px);
}

@media (max-width: 560px) {
  .comments-drawer {
    inset: auto 10px 10px;
    top: calc(var(--header-h) + 10px);
    width: auto;
  }

  .comment-form .btn {
    width: 100%;
  }
}

@media print {
  .comments-drawer {
    display: none !important;
  }
}
</style>
