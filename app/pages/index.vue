<template>
  <div class="home-wrapper">
    <section class="hero-section">
      <div class="hero-copy">
        <div class="badge-pill">
          <AppIcon name="sparkles" />
          Creative exam production workspace
        </div>
        <h1 class="hero-title">Craft Perfect <span class="text-gradient">TestPapers</span></h1>
        <p class="hero-sub">
          Build questions with LaTeX, curate a living bank, generate balanced papers, and export polished assessments from one expressive workspace.
        </p>
        <div class="hero-actions">
          <NuxtLink v-if="hasPermission('questions:write')" to="/add-problem" class="btn btn-primary btn-lg">
            <AppIcon name="add" />
            Create a Problem
          </NuxtLink>
          <NuxtLink v-if="hasPermission('questions:read')" to="/questions" class="btn btn-outline btn-lg">
            <AppIcon name="book" />
            Open Workspace
          </NuxtLink>
          <NuxtLink v-if="!isAuthenticated" to="/login" class="btn btn-primary btn-lg">
            <AppIcon name="login" />
            Login
          </NuxtLink>
          <NuxtLink to="/latex" class="btn btn-outline btn-lg">
            <AppIcon name="latex" />
            Try LaTeX
          </NuxtLink>
        </div>
      </div>

      <div class="hero-board" aria-label="TestPapers workflow preview">
        <div class="board-topline">
          <span class="board-dot"></span>
          <span>Paper Studio</span>
          <strong>92%</strong>
        </div>
        <div class="formula-card">
          <span class="formula-kicker">Live LaTeX</span>
          <strong>∫ e<sup>-x²</sup> dx</strong>
          <span>renders while you compose</span>
        </div>
        <div class="mini-grid">
          <div class="mini-panel mini-panel--primary">
            <AppIcon name="book" />
            <strong :aria-busy="heroStatsLoading">{{ questionTotalDisplay }}</strong>
            <span>questions indexed</span>
          </div>
          <div class="mini-panel">
            <AppIcon name="paper" />
            <strong :aria-busy="heroStatsLoading">{{ scoreWeightTotalDisplay }}</strong>
            <span>{{ scoreWeightLabel }}</span>
          </div>
        </div>
        <div class="paper-stack">
          <span></span>
          <span></span>
          <span></span>
        </div>
      </div>
    </section>

    <section class="workflow-section">
      <NuxtLink to="/questions" class="workflow-card">
        <span class="workflow-icon"><AppIcon name="search" /></span>
        <h2>Question Workspace</h2>
        <p>Search, filter, inspect answers, and build papers from the same creative surface.</p>
        <span class="btn-text">Open Workspace <AppIcon name="arrow-right" /></span>
      </NuxtLink>

      <NuxtLink v-if="hasPermission('questions:write')" to="/add-problem" class="workflow-card workflow-card--accent">
        <span class="workflow-icon"><AppIcon name="edit" /></span>
        <h2>Add Problem</h2>
        <p>Compose rich prompts with images, tags, score weight, and instant math preview.</p>
        <span class="btn-text">Compose Now <AppIcon name="arrow-right" /></span>
      </NuxtLink>

      <NuxtLink to="/latex" class="workflow-card">
        <span class="workflow-icon"><AppIcon name="latex" /></span>
        <h2>LaTeX Preview</h2>
        <p>Use the sandbox to test notation before it goes into a question or export.</p>
        <span class="btn-text">Try Sandbox <AppIcon name="arrow-right" /></span>
      </NuxtLink>
    </section>
  </div>
</template>

<script setup lang="ts">
import type { PaginatedData } from '~/types/api'
import type { QuestionEntity } from '~/types/question'

const { hasPermission, isAuthenticated, isAuthReady } = useAuth()
const { apiFetch } = useApi()

const numberFormatter = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 })
const heroStatsLoading = ref(false)
const heroStatsError = ref('')
const questionTotal = ref<number | null>(null)
const scoreWeightTotal = ref<number | null>(null)
const canReadQuestionStats = computed(() => hasPermission('questions:read'))
let heroStatsRequest = 0

const questionTotalDisplay = computed(() => {
  if (heroStatsLoading.value) return '...'
  return questionTotal.value === null ? '-' : numberFormatter.format(questionTotal.value)
})

const scoreWeightTotalDisplay = computed(() => {
  if (heroStatsLoading.value) return '...'
  return scoreWeightTotal.value === null ? '-' : numberFormatter.format(scoreWeightTotal.value)
})

const scoreWeightLabel = computed(() => canReadQuestionStats.value ? 'score weight indexed' : 'sign in for bank stats')

function resetHeroStats () {
  questionTotal.value = null
  scoreWeightTotal.value = null
  heroStatsError.value = ''
  heroStatsLoading.value = false
}

function sumQuestionScoreWeight (items: QuestionEntity[]) {
  return items.reduce((total, question) => {
    const weight = Number(question.scoreWeight)
    return total + (Number.isFinite(weight) ? weight : 0)
  }, 0)
}

async function loadHeroStats () {
  const requestId = ++heroStatsRequest
  if (!canReadQuestionStats.value) {
    resetHeroStats()
    return
  }

  heroStatsLoading.value = true
  heroStatsError.value = ''

  try {
    const firstPage = await apiFetch<PaginatedData<QuestionEntity>>('/questions', {
      method: 'GET',
      query: {
        includeAnswer: false,
        page: 1,
        pageSize: 100,
        sortBy: 'createdAt',
        sortOrder: 'desc'
      }
    })
    if (requestId !== heroStatsRequest) return

    const pagination = firstPage.data.pagination
    let scoreWeight = sumQuestionScoreWeight(firstPage.data.items || [])

    for (let page = 2; page <= pagination.totalPages; page += 1) {
      const pageResult = await apiFetch<PaginatedData<QuestionEntity>>('/questions', {
        method: 'GET',
        query: {
          includeAnswer: false,
          page,
          pageSize: 100,
          sortBy: 'createdAt',
          sortOrder: 'desc'
        }
      })
      if (requestId !== heroStatsRequest) return
      scoreWeight += sumQuestionScoreWeight(pageResult.data.items || [])
    }

    questionTotal.value = pagination.total
    scoreWeightTotal.value = scoreWeight
  } catch (error) {
    if (requestId !== heroStatsRequest) return
    resetHeroStats()
    heroStatsError.value = error instanceof Error ? error.message : 'Failed to load question statistics.'
  } finally {
    if (requestId === heroStatsRequest) heroStatsLoading.value = false
  }
}

if (import.meta.client) {
  watch([isAuthReady, canReadQuestionStats], () => {
    void loadHeroStats()
  }, { immediate: true })
}

useSeoMeta({
  title: 'TestPapers',
  titleTemplate: '%s',
  description: 'Create professional test papers and exams with live LaTeX rendering. Question bank manager, PDF/DOCX exports, and real-time collaboration.',
  ogTitle: 'TestPapers - Professional Test Paper Creator',
  ogDescription: 'Create, manage, and export professional exams and assignments seamlessly with live LaTeX rendering.',
  ogImage: `${useRequestURL().origin}/og-image.png`,
  twitterTitle: 'TestPapers - Professional Test Paper Creator',
  twitterDescription: 'Create, manage, and export professional exams with live LaTeX rendering.',
  twitterImage: `${useRequestURL().origin}/og-image.png`
})

useHead({
  script: [
    {
      type: 'application/ld+json',
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'WebApplication',
        name: 'TestPapers',
        url: useRequestURL().origin,
        description: 'Create professional test papers and exams with live LaTeX rendering. Question bank manager, PDF/DOCX exports, and real-time collaboration.',
        applicationCategory: 'EducationalApplication',
        operatingSystem: 'All',
        offers: {
          '@type': 'Offer',
          price: '0',
          priceCurrency: 'USD'
        },
        browserRequirements: 'Requires JavaScript'
      })
    }
  ]
})
</script>

<style scoped>
.home-wrapper {
  display: flex;
  flex-direction: column;
  gap: clamp(26px, 5vw, 48px);
  padding-bottom: 52px;
}

.hero-section {
  min-height: min(680px, calc(100vh - 130px));
  display: grid;
  grid-template-columns: minmax(0, 1.02fr) minmax(340px, .88fr);
  gap: clamp(28px, 5vw, 64px);
  align-items: center;
  position: relative;
}

.hero-copy {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 22px;
}

.badge-pill {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 7px 14px;
  background: rgba(118, 87, 255, 0.1);
  color: var(--color-primary);
  border: 1px solid rgba(118, 87, 255, 0.2);
  border-radius: 999px;
  font-size: .84rem;
  font-weight: 800;
}

.hero-title {
  max-width: 760px;
  font-size: clamp(3rem, 5vw, 4rem);
  line-height: 1.1;
  font-weight: 800;
  letter-spacing: 0;
}

.text-gradient {
  background: linear-gradient(135deg, var(--color-primary), #bb86fc);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.hero-sub {
  max-width: 660px;
  font-size: clamp(1.05rem, 2vw, 1.25rem);
  color: var(--color-muted);
  line-height: 1.7;
}

.hero-actions {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.btn-lg {
  min-height: 48px;
  padding: 12px 22px;
  font-size: .98rem;
}

.hero-board {
  position: relative;
  min-height: 500px;
  border-radius: 8px;
  padding: 22px;
  background:
    linear-gradient(150deg, rgba(255, 255, 255, 0.82), rgba(255, 255, 255, 0.42)),
    linear-gradient(135deg, rgba(118, 87, 255, 0.18), rgba(14, 165, 233, 0.08));
  border: 1px solid rgba(118, 87, 255, 0.22);
  box-shadow: var(--shadow);
  overflow: hidden;
}

.hero-board::before {
  content: "";
  position: absolute;
  inset: 22px;
  border: 1px solid rgba(118, 87, 255, 0.18);
  transform: rotate(-4deg);
}

.board-topline,
.formula-card,
.mini-panel {
  position: relative;
  background: var(--color-surface-raised);
  border: 1px solid var(--color-border);
  box-shadow: var(--shadow-soft);
  backdrop-filter: blur(18px);
}

.board-topline {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  border-radius: 8px;
  font-weight: 800;
}

.board-topline strong {
  margin-left: auto;
  color: var(--color-accent);
}

.board-dot {
  width: 10px;
  height: 10px;
  border-radius: 999px;
  background: var(--color-warm);
  box-shadow: 0 0 0 6px rgba(255, 138, 76, 0.12);
}

.formula-card {
  margin: 58px auto 18px;
  width: min(100%, 340px);
  padding: 24px;
  border-radius: 8px;
  transform: rotate(-2deg);
}

.formula-card strong {
  display: block;
  margin: 8px 0 6px;
  font-size: 2.6rem;
  line-height: 1;
}

.formula-card span {
  color: var(--color-muted);
  font-size: .9rem;
}

.formula-kicker {
  color: var(--color-primary) !important;
  font-weight: 850;
  text-transform: uppercase;
  letter-spacing: .08em;
  font-size: .72rem !important;
}

.mini-grid {
  position: relative;
  display: grid;
  grid-template-columns: 1fr 1fr;
  align-items: center;
  justify-items: center;
  gap: 14px;
  margin-top: 8px;
}

.mini-grid::before {
  content: "";
  position: absolute;
  left: 6%;
  right: 6%;
  top: 48%;
  height: 24px;
  border-radius: 999px 60% 999px 55%;
  background: linear-gradient(90deg, transparent, rgba(118, 87, 255, 0.22), rgba(14, 165, 233, 0.2), transparent);
  transform: translateY(-50%);
  transform-origin: center;
  filter: blur(.2px);
  opacity: .86;
}

.mini-panel {
  --panel-glow: rgba(118, 87, 255, 0.22);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 7px;
  width: min(172px, 100%);
  aspect-ratio: 1;
  min-width: 0;
  padding: 22px;
  border-radius: 50%;
  overflow: hidden;
  isolation: isolate;
  text-align: center;
  transform: translateY(8px);
  transition: border-radius .24s ease, transform .24s ease, box-shadow .24s ease;
}

.mini-panel::before,
.mini-panel::after {
  content: "";
  position: absolute;
  pointer-events: none;
}

.mini-panel::before {
  inset: 10px;
  border: 1px solid rgba(118, 87, 255, 0.18);
  border-radius: 50%;
  z-index: -1;
}

.mini-panel::after {
  left: -18%;
  right: -18%;
  bottom: -4px;
  height: 62px;
  border-radius: 50%;
  background:
    linear-gradient(90deg, transparent, var(--panel-glow), transparent),
    repeating-linear-gradient(90deg, rgba(255, 255, 255, 0.18) 0 2px, transparent 2px 18px);
  opacity: .36;
  transform: translateY(4px);
  z-index: -1;
}

.mini-panel:nth-child(1) {
  transform: translateY(-4px);
}

.mini-panel:nth-child(2) {
  transform: translateY(18px);
}

.mini-panel svg {
  color: rgba(255, 255, 255, 0.82);
  font-size: 1.35rem;
}

.mini-panel strong {
  font-size: clamp(1.8rem, 3vw, 2.25rem);
  line-height: 1;
  letter-spacing: 0;
  word-break: break-word;
}

.mini-panel span {
  color: rgba(255, 255, 255, 0.78);
  font-size: .78rem;
  line-height: 1.35;
}

.mini-panel--primary {
  --panel-glow: rgba(255, 255, 255, 0.34);
  background: linear-gradient(135deg, var(--color-primary), var(--color-secondary));
  color: #fff;
  border-color: rgba(255, 255, 255, 0.24);
}

.mini-panel:not(.mini-panel--primary) {
  background:
    linear-gradient(135deg, rgba(255, 255, 255, 0.72), rgba(255, 255, 255, 0.36)),
    linear-gradient(135deg, rgba(118, 87, 255, 0.1), rgba(14, 165, 233, 0.06));
}

.mini-panel:not(.mini-panel--primary) svg {
  color: var(--color-primary);
}

.mini-panel:not(.mini-panel--primary) span {
  color: var(--color-muted);
}

.paper-stack {
  position: absolute;
  right: 22px;
  bottom: 22px;
  display: grid;
  gap: 7px;
  width: 45%;
}

.paper-stack span {
  height: 11px;
  border-radius: 999px;
  background: rgba(118, 87, 255, 0.2);
}

.paper-stack span:nth-child(2) {
  width: 82%;
  background: rgba(14, 165, 233, 0.2);
}

.paper-stack span:nth-child(3) {
  width: 62%;
  background: rgba(255, 138, 76, 0.24);
}

.workflow-section {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 18px;
}

.workflow-card {
  display: flex;
  min-height: 260px;
  flex-direction: column;
  align-items: flex-start;
  gap: 14px;
  padding: 24px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  color: var(--color-text);
  background: var(--color-surface);
  box-shadow: var(--shadow-soft);
  overflow: hidden;
  position: relative;
  transition: transform .24s ease, box-shadow .24s ease, border-color .24s ease;
}

.workflow-card::after {
  content: "";
  position: absolute;
  inset: auto -20% -40% 25%;
  height: 150px;
  transform: rotate(-8deg);
  background: linear-gradient(90deg, rgba(118, 87, 255, 0.1), rgba(14, 165, 233, 0.1));
}

.workflow-card:hover {
  transform: translateY(-6px);
  border-color: rgba(118, 87, 255, 0.34);
  box-shadow: var(--shadow);
}

.workflow-card--accent {
  background: linear-gradient(145deg, rgba(118, 87, 255, 0.12), var(--color-surface));
}

.workflow-icon {
  display: inline-grid;
  place-items: center;
  width: 46px;
  height: 46px;
  border-radius: 8px;
  color: #fff;
  background: linear-gradient(135deg, var(--color-primary), var(--color-secondary));
  box-shadow: 0 12px 26px rgba(118, 87, 255, 0.22);
}

.workflow-card h2 {
  position: relative;
  z-index: 1;
  font-size: 1.22rem;
  font-weight: 900;
}

.workflow-card p {
  position: relative;
  z-index: 1;
  color: var(--color-muted);
  line-height: 1.6;
}

.btn-text {
  position: relative;
  z-index: 1;
  margin-top: auto;
  display: inline-flex;
  align-items: center;
  gap: 7px;
  font-size: .9rem;
  font-weight: 850;
  color: var(--color-primary);
}

[data-theme="dark"] .hero-board {
  background:
    linear-gradient(150deg, rgba(36, 31, 58, 0.9), rgba(17, 16, 26, 0.72)),
    linear-gradient(135deg, rgba(167, 139, 250, 0.2), rgba(56, 189, 248, 0.08));
}

[data-theme="dark"] .mini-panel:not(.mini-panel--primary) {
  background:
    linear-gradient(135deg, rgba(48, 41, 79, 0.88), rgba(32, 27, 53, 0.66)),
    linear-gradient(135deg, rgba(167, 139, 250, 0.18), rgba(56, 189, 248, 0.08));
}

[data-theme="dark"] .mini-panel:not(.mini-panel--primary) svg {
  color: var(--color-primary);
}

[data-theme="dark"] .mini-panel:not(.mini-panel--primary) span {
  color: var(--color-muted);
}

[data-theme="dark"] .text-gradient {
  background: linear-gradient(135deg, var(--color-primary), #c4b5fd);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

@media (max-width: 980px) {
  .hero-section {
    grid-template-columns: 1fr;
    min-height: auto;
  }

  .hero-board {
    min-height: 420px;
  }

  .workflow-section {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 600px) {
  .hero-section {
    gap: 24px;
  }

  .hero-title {
    font-size: 2.25rem;
  }

  .hero-actions,
  .hero-actions .btn {
    width: 100%;
  }

  .hero-board {
    min-height: 370px;
    padding: 14px;
  }

  .formula-card {
    margin-top: 38px;
    padding: 18px;
  }

  .formula-card strong {
    font-size: 2rem;
  }

  .mini-grid {
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }

  .mini-grid::before {
    left: 18%;
    right: 18%;
    top: 50%;
    height: 20px;
    transform: translateY(-50%) rotate(86deg);
  }

  .mini-panel {
    width: min(150px, 42vw);
    min-height: 0;
    padding: 18px;
  }

  .mini-panel:nth-child(1) {
    justify-self: start;
    transform: translateY(-2px);
  }

  .mini-panel:nth-child(2) {
    justify-self: end;
    transform: translateY(16px);
  }

  .paper-stack {
    display: none;
  }
}
</style>
