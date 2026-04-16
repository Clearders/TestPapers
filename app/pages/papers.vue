<template>
  <section>
    <h1 class="page-title">Assemble Test Paper 📄</h1>
    <p class="page-sub">Select questions from the bank and arrange them into a complete paper.</p>

    <div class="assembly-layout">
      <!-- Left: question bank -->
      <div class="bank-panel">
        <div class="panel-head">
          <h2>Question Bank</h2>
          <input v-model="search" class="form-input" placeholder="Search…" />
        </div>
        <TransitionGroup name="list" tag="div" class="bank-list">
          <div
            v-for="(q, idx) in bankFiltered"
            :key="q.id"
            class="bank-item card"
            :class="{ 'bank-item--added': isAdded(q.id) }"
            :style="{ animationDelay: `${idx * 0.05}s` }"
          >
            <div class="bank-item-meta">
              <span class="badge" :class="`badge-${q.difficulty}`">{{ q.difficulty }}</span>
              <span class="tag">{{ q.subject }}</span>
            </div>
            <p class="bank-item-text">{{ q.textPreview }}</p>
            <button
              class="btn btn-sm"
              :class="isAdded(q.id) ? 'btn-danger' : 'btn-primary'"
              @click="toggleQuestion(q)"
            >
              {{ isAdded(q.id) ? '✕ Remove' : '+ Add' }}
            </button>
          </div>
        </TransitionGroup>
      </div>

      <!-- Right: paper builder -->
      <div class="paper-panel">
        <div class="panel-head">
          <h2>Paper Builder</h2>
          <Transition name="fade" mode="out-in">
            <span :key="paper.questions.length" class="badge tag-count">
              {{ paper.questions.length }} question{{ paper.questions.length !== 1 ? 's' : '' }}
            </span>
          </Transition>
        </div>

        <!-- Paper metadata -->
        <div class="card" style="margin-bottom:16px">
          <div class="form-group">
            <label class="form-label">Paper Title</label>
            <input v-model="paper.title" class="form-input" placeholder="e.g. Mid-term Examination 2025" />
          </div>
          <div class="paper-meta-row">
            <div class="form-group" style="flex:1">
              <label class="form-label">Subject</label>
              <input v-model="paper.subject" class="form-input" placeholder="e.g. Mathematics" />
            </div>
            <div class="form-group" style="flex:1">
              <label class="form-label">Duration (min)</label>
              <input v-model.number="paper.duration" type="number" min="1" class="form-input" placeholder="60" />
            </div>
            <div class="form-group" style="flex:1">
              <label class="form-label">Total Marks</label>
              <input v-model.number="paper.totalMarks" type="number" min="1" class="form-input" placeholder="100" />
            </div>
          </div>
        </div>

        <!-- Selected questions -->
        <TransitionGroup name="list" tag="div" class="paper-question-list" v-if="paper.questions.length">
          <div
            v-for="(q, idx) in paper.questions"
            :key="q.id"
            class="paper-q-item card"
          >
            <div class="paper-q-controls">
              <button class="icon-btn" :disabled="idx === 0" @click="moveUp(idx)" title="Move up">▲</button>
              <button class="icon-btn" :disabled="idx === paper.questions.length - 1" @click="moveDown(idx)" title="Move down">▼</button>
            </div>
            <div class="paper-q-body">
              <div class="paper-q-num">Q{{ idx + 1 }}</div>
              <div class="paper-q-content">
                <div class="bank-item-meta">
                  <span class="badge" :class="`badge-${q.difficulty}`">{{ q.difficulty }}</span>
                  <span class="tag">{{ q.subject }}</span>
                  <span v-for="t in q.tags" :key="t" class="tag">{{ t }}</span>
                </div>
                <div class="q-text-wrap">
                  <template v-for="(part, i) in parseParts(q.text)" :key="i">
                    <LatexRenderer v-if="part.isLatex" :formula="part.content" :block="part.block" />
                    <span v-else>{{ part.content }}</span>
                  </template>
                </div>
              </div>
            </div>
            <button class="btn btn-danger btn-sm remove-btn" @click="removeQuestion(q.id)">✕</button>
          </div>
        </TransitionGroup>
        <Transition name="fade">
          <div v-if="!paper.questions.length" class="empty-paper card">
            <span style="font-size:2rem; animation: bounce 2s infinite;">📋</span>
            <p>No questions added yet. Select some from the bank on the left.</p>
          </div>
        </Transition>

        <!-- Actions -->
        <div class="paper-actions" style="margin-top:20px">
          <button
            class="btn btn-success"
            :disabled="!paper.questions.length || !paper.title"
            @click="exportPaper"
          >
            📥 Export Paper
          </button>
          <button class="btn btn-outline" :disabled="!paper.questions.length" @click="clearPaper">
            🗑 Clear All
          </button>
        </div>

        <!-- Export preview -->
        <Transition name="fade">
          <div v-if="exported" class="export-preview card" style="margin-top:24px">
            <h3 style="margin-bottom:12px">📄 {{ paper.title }}</h3>
            <p style="color:var(--color-muted);font-size:.875rem;margin-bottom:16px">
              Subject: {{ paper.subject }} &nbsp;|&nbsp;
              Duration: {{ paper.duration }} min &nbsp;|&nbsp;
              Total: {{ paper.totalMarks }} marks
            </p>
            <ol class="export-q-list">
              <li v-for="q in paper.questions" :key="q.id">
                <div class="export-q-text">
                  <template v-for="(part, i) in parseParts(q.text)" :key="i">
                    <LatexRenderer v-if="part.isLatex" :formula="part.content" :block="part.block" />
                    <span v-else>{{ part.content }}</span>
                  </template>
                </div>
              </li>
            </ol>
            <p class="form-hint" style="margin-top:12px">
              (In a full implementation this would be exported to PDF/DOCX.)
            </p>
          </div>
        </Transition>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
interface Question {
  id: number
  subject: string
  difficulty: 'easy' | 'medium' | 'hard'
  tags: string[]
  text: string
  answer: string
  hasLatex: boolean
}

const allQuestions: Question[] = [
  { id: 1, subject: 'Mathematics', difficulty: 'easy', tags: ['algebra'], hasLatex: true, text: 'Solve for $x$: $2x + 5 = 13$', answer: '$x = 4$' },
  { id: 2, subject: 'Mathematics', difficulty: 'medium', tags: ['calculus'], hasLatex: true, text: 'Evaluate the integral: $$\\int_0^1 x^2 \\, dx$$', answer: '$\\dfrac{1}{3}$' },
  { id: 3, subject: 'Physics', difficulty: 'medium', tags: ['mechanics'], hasLatex: true, text: "A body of mass $5\\,\\text{kg}$ experiences a net force of $20\\,\\text{N}$. Find its acceleration.", answer: '$a = 4\\,\\text{m/s}^2$' },
  { id: 4, subject: 'Mathematics', difficulty: 'hard', tags: ['calculus', 'integration'], hasLatex: true, text: 'Compute $\\displaystyle\\int_0^\\infty e^{-x^2}\\,dx$.', answer: '$\\dfrac{\\sqrt{\\pi}}{2}$' },
  { id: 5, subject: 'Chemistry', difficulty: 'easy', tags: ['stoichiometry'], hasLatex: false, text: 'Balance the following equation: H₂ + O₂ → H₂O', answer: '2H₂ + O₂ → 2H₂O' },
  { id: 6, subject: 'Physics', difficulty: 'hard', tags: ['electromagnetism'], hasLatex: true, text: "What is the speed of light in vacuum? Express using $c = \\dfrac{1}{\\sqrt{\\mu_0 \\varepsilon_0}}$.", answer: '$c \\approx 3 \\times 10^8\\,\\text{m/s}$' }
]

const bank = allQuestions.map(q => ({
  ...q,
  textPreview: q.text.replace(/\$\$?([^$]+)\$\$?/g, '[math]').slice(0, 100)
}))

const search = ref('')
const bankFiltered = computed(() => {
  if (!search.value) return bank
  const s = search.value.toLowerCase()
  return bank.filter(q =>
    q.subject.toLowerCase().includes(s) ||
    q.textPreview.toLowerCase().includes(s) ||
    q.tags.some(t => t.includes(s))
  )
})

const paper = reactive({
  title: '',
  subject: '',
  duration: 60,
  totalMarks: 100,
  questions: [] as Question[]
})

const exported = ref(false)

function isAdded (id: number) { return paper.questions.some(q => q.id === id) }
function toggleQuestion (q: Question) { isAdded(q.id) ? removeQuestion(q.id) : paper.questions.push(q) }
function removeQuestion (id: number) { paper.questions = paper.questions.filter(q => q.id !== id) }
function moveUp (idx: number) {
  if (idx === 0) return
  const qs = [...paper.questions]
  const prev = qs[idx - 1]
  const current = qs[idx]
  if (!prev || !current) return
  qs[idx - 1] = current
  qs[idx] = prev
  paper.questions = qs
}
function moveDown (idx: number) {
  if (idx >= paper.questions.length - 1) return
  const qs = [...paper.questions]
  const current = qs[idx]
  const next = qs[idx + 1]
  if (!current || !next) return
  qs[idx] = next
  qs[idx + 1] = current
  paper.questions = qs
}
function clearPaper () { paper.questions = []; exported.value = false }
function exportPaper () { exported.value = true }

interface Part { isLatex: boolean; content: string; block: boolean }
function parseParts (text: string): Part[] {
  const parts: Part[] = []
  const re = /\$\$([^$]+)\$\$|\$([^$]+)\$/g
  let last = 0; let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push({ isLatex: false, content: text.slice(last, m.index), block: false })
    const blockContent = m[1]
    const inlineContent = m[2]
    if (blockContent !== undefined) parts.push({ isLatex: true, content: blockContent, block: true })
    else if (inlineContent !== undefined) parts.push({ isLatex: true, content: inlineContent, block: false })
    last = m.index + m[0].length
  }
  if (last < text.length) parts.push({ isLatex: false, content: text.slice(last), block: false })
  return parts
}
</script>

<style scoped>
@keyframes bounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-10px); }
}

.assembly-layout {
  display: grid;
  grid-template-columns: 1fr 1.4fr;
  gap: 24px;
  align-items: start;
}
@media (max-width: 780px) { .assembly-layout { grid-template-columns: 1fr; } }

.panel-head {
  display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap;
  gap: 10px; margin-bottom: 14px;
}
.panel-head h2 { font-size: 1.05rem; font-weight: 700; }
.tag-count { background:#eff3fe; color:var(--color-primary); display: inline-block; }
.bank-list { display: flex; flex-direction: column; gap: 12px; max-height: 68vh; overflow-y: auto; overflow-x: hidden; padding-right: 4px; }
.bank-item {
  display: flex; flex-direction: column; gap: 8px; padding: 14px 16px;
  animation: slideUp 0.4s ease backwards; transition: all 0.3s ease;
}
.bank-item:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,.08); }
.bank-item--added { border-color: var(--color-primary); background: #f5f7ff; }
.bank-item-meta { display: flex; flex-wrap: wrap; gap: 6px; }
.bank-item-text { font-size: .85rem; color: var(--color-muted); }

.paper-question-list { display: flex; flex-direction: column; gap: 12px; position: relative; }
.paper-q-item {
  display: flex; align-items: flex-start; gap: 12px;
  transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
  background: var(--color-surface);
}
.paper-q-item:hover {
  transform: scale(1.01);
  box-shadow: 0 8px 24px rgba(0,0,0,.1);
}
.paper-q-controls { display: flex; flex-direction: column; gap: 4px; padding-top: 4px; }
.icon-btn {
  background: none; border: 1px solid var(--color-border);
  border-radius: 4px; padding: 2px 6px; font-size: .7rem; color: var(--color-muted);
  transition: background .15s;
}
.icon-btn:hover:not(:disabled) { background: var(--color-bg); color: var(--color-text); }
.icon-btn:disabled { opacity: .3; cursor: not-allowed; }
.paper-q-body { flex: 1; display: flex; gap: 10px; align-items: flex-start; }
.paper-q-num { font-weight: 700; color: var(--color-primary); min-width: 28px; }
.paper-q-content { flex: 1; }
.q-text-wrap { font-size: .9rem; line-height: 1.7; margin-top: 6px; }
.remove-btn { opacity: 0.5; transition: all 0.3s ease; }
.paper-q-item:hover .remove-btn { opacity: 1; }
.paper-meta-row { display: flex; gap: 12px; flex-wrap: wrap; }
.paper-actions { display: flex; gap: 12px; flex-wrap: wrap; }
.empty-paper { text-align: center; padding: 32px; display: flex; flex-direction: column; align-items: center; gap: 10px; color: var(--color-muted); }
.export-preview { background: #fff; }
.export-q-list { padding-left: 20px; display: flex; flex-direction: column; gap: 12px; }
.export-q-list li { font-size: .95rem; line-height: 1.7; }
.export-q-text { display: inline; }
</style>
