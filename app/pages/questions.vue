<template>
  <section>
    <h1 class="page-title">Question Bank 🔍</h1>
    <p class="page-sub">Browse, search, and filter all available test questions.</p>

    <!-- Toolbar -->
    <div class="toolbar card" style="margin-bottom:20px">
      <input
        v-model="search"
        class="form-input"
        style="flex:1;min-width:180px"
        placeholder="Search questions…"
      />
      <select v-model="filterSubject" class="form-input">
        <option value="">All subjects</option>
        <option v-for="s in subjects" :key="s" :value="s">{{ s }}</option>
      </select>
      <select v-model="filterDifficulty" class="form-input">
        <option value="">All difficulties</option>
        <option value="easy">Easy</option>
        <option value="medium">Medium</option>
        <option value="hard">Hard</option>
      </select>
      <NuxtLink to="/add-problem" class="btn btn-primary">+ Add Problem</NuxtLink>
    </div>

    <!-- Question list -->
    <div v-if="filtered.length" class="q-list">
      <div v-for="q in filtered" :key="q.id" class="q-card card">
        <div class="q-card-header">
          <div class="q-meta">
            <span class="badge" :class="`badge-${q.difficulty}`">{{ q.difficulty }}</span>
            <span class="tag">{{ q.subject }}</span>
            <span v-for="t in q.tags" :key="t" class="tag">{{ t }}</span>
          </div>
          <span class="q-id">#{{ q.id }}</span>
        </div>

        <div class="q-body">
          <p class="q-text" v-if="!q.hasLatex">{{ q.text }}</p>
          <div v-else class="q-text latex-text">
            <template v-for="(part, i) in parseParts(q.text)" :key="i">
              <LatexRenderer v-if="part.isLatex" :formula="part.content" :block="part.block" />
              <span v-else>{{ part.content }}</span>
            </template>
          </div>
        </div>

        <div class="q-footer">
          <button class="btn btn-outline btn-sm" @click="toggleAnswer(q.id)">
            {{ shown.has(q.id) ? 'Hide' : 'Show' }} Answer
          </button>
          <NuxtLink to="/papers" class="btn btn-primary btn-sm">Add to Paper</NuxtLink>
        </div>

        <div v-if="shown.has(q.id)" class="q-answer">
          <strong>Answer:</strong>
          <template v-for="(part, i) in parseParts(q.answer)" :key="i">
            <LatexRenderer v-if="part.isLatex" :formula="part.content" />
            <span v-else>{{ part.content }}</span>
          </template>
        </div>
      </div>
    </div>

    <div v-else class="empty-state card">
      <span style="font-size:2.5rem">📭</span>
      <p>No questions match your filters.</p>
      <NuxtLink to="/add-problem" class="btn btn-primary" style="margin-top:12px">Add a Problem</NuxtLink>
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

const questions: Question[] = [
  {
    id: 1,
    subject: 'Mathematics',
    difficulty: 'easy',
    tags: ['algebra'],
    hasLatex: true,
    text: 'Solve for $x$: $2x + 5 = 13$',
    answer: '$x = 4$'
  },
  {
    id: 2,
    subject: 'Mathematics',
    difficulty: 'medium',
    tags: ['calculus'],
    hasLatex: true,
    text: 'Evaluate the integral: $$\\int_0^1 x^2 \\, dx$$',
    answer: '$\\dfrac{1}{3}$'
  },
  {
    id: 3,
    subject: 'Physics',
    difficulty: 'medium',
    tags: ['mechanics'],
    hasLatex: true,
    text: "Newton's second law states $F = ma$. A body of mass $5\\,\\text{kg}$ experiences a net force of $20\\,\\text{N}$. Find its acceleration.",
    answer: '$a = 4\\,\\text{m/s}^2$'
  },
  {
    id: 4,
    subject: 'Mathematics',
    difficulty: 'hard',
    tags: ['calculus', 'integration'],
    hasLatex: true,
    text: 'Compute $\\displaystyle\\int_0^\\infty e^{-x^2}\\,dx$.',
    answer: '$\\dfrac{\\sqrt{\\pi}}{2}$'
  },
  {
    id: 5,
    subject: 'Chemistry',
    difficulty: 'easy',
    tags: ['stoichiometry'],
    hasLatex: false,
    text: 'Balance the following equation: H₂ + O₂ → H₂O',
    answer: '2H₂ + O₂ → 2H₂O'
  },
  {
    id: 6,
    subject: 'Physics',
    difficulty: 'hard',
    tags: ['electromagnetism'],
    hasLatex: true,
    text: "Using Maxwell's equations, show that the speed of light in vacuum is $c = \\dfrac{1}{\\sqrt{\\mu_0 \\varepsilon_0}}$. What is its numerical value?",
    answer: '$c \\approx 3 \\times 10^8\\,\\text{m/s}$'
  }
]

const search = ref('')
const filterSubject = ref('')
const filterDifficulty = ref('')
const shown = ref<Set<number>>(new Set())

const subjects = [...new Set(questions.map(q => q.subject))]

const filtered = computed(() => questions.filter(q => {
  if (filterSubject.value && q.subject !== filterSubject.value) return false
  if (filterDifficulty.value && q.difficulty !== filterDifficulty.value) return false
  if (search.value) {
    const s = search.value.toLowerCase()
    return q.text.toLowerCase().includes(s) || q.tags.some(t => t.includes(s)) || q.subject.toLowerCase().includes(s)
  }
  return true
}))

function toggleAnswer (id: number) {
  const next = new Set(shown.value)
  next.has(id) ? next.delete(id) : next.add(id)
  shown.value = next
}

interface Part { isLatex: boolean; content: string; block: boolean }

function parseParts (text: string): Part[] {
  const parts: Part[] = []
  // Match $$...$$ (block) then $...$ (inline)
  const re = /\$\$([^$]+)\$\$|\$([^$]+)\$/g
  let last = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push({ isLatex: false, content: text.slice(last, m.index), block: false })
    if (m[1] !== undefined) parts.push({ isLatex: true, content: m[1], block: true })
    else parts.push({ isLatex: true, content: m[2], block: false })
    last = m.index + m[0].length
  }
  if (last < text.length) parts.push({ isLatex: false, content: text.slice(last), block: false })
  return parts
}
</script>

<style scoped>
.toolbar { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; }
.q-list { display: flex; flex-direction: column; gap: 16px; }
.q-card { display: flex; flex-direction: column; gap: 12px; }
.q-card-header { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; }
.q-meta { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
.q-id { font-size: .8rem; color: var(--color-muted); }
.q-text { font-size: .95rem; line-height: 1.7; }
.latex-text { display: inline; }
.q-footer { display: flex; gap: 10px; flex-wrap: wrap; }
.q-answer {
  background: #f0fdf4; border: 1px solid #bbf7d0;
  border-radius: var(--radius); padding: 12px 16px;
  font-size: .9rem;
}
.empty-state {
  text-align: center; padding: 48px;
  display: flex; flex-direction: column; align-items: center; gap: 12px;
  color: var(--color-muted);
}
</style>
