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
          <NuxtLink to="/questions" class="btn btn-outline btn-lg">
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
          <span class="board-dot"/>
          <span>Paper Studio</span>
          <strong>92%</strong>
        </div>
        <div class="formula-card">
          <span class="formula-kicker">Live LaTeX</span>
          <strong>&int; e<sup>-x&sup2;</sup> dx</strong>
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
          <span/>
          <span/>
          <span/>
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
import { apiErrorMessage } from '~/utils/apiError'
import type { PaginatedData } from '~/types/api'
import type { QuestionEntity } from '~/types/question'

type HeroStats = {
  questionTotal: number
  scoreWeightTotal: number
}

const { hasPermission, isAuthenticated, isAuthReady } = useAuth()
const { apiFetch } = useApi()
const requestURL = useRequestURL()
const baseUrl = requestURL.origin

const numberFormatter = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 })
const heroStatsLoading = useState<boolean>('home-hero-stats-loading', () => false)
const heroStatsLoaded = useState<boolean>('home-hero-stats-loaded', () => false)
const heroStatsError = useState<string>('home-hero-stats-error', () => '')
const questionTotal = useState<number | null>('home-question-total', () => null)
const scoreWeightTotal = useState<number | null>('home-score-weight-total', () => null)
const canReadQuestionStats = computed(() => hasPermission('questions:read'))
let heroStatsRequest = 0
let heroStatsIdleQueued = false

const questionTotalDisplay = computed(() => {
  if (heroStatsLoading.value) return '...'
  return questionTotal.value === null ? '-' : numberFormatter.format(questionTotal.value)
})

const scoreWeightTotalDisplay = computed(() => {
  if (heroStatsLoading.value) return '...'
  return scoreWeightTotal.value === null ? '-' : numberFormatter.format(scoreWeightTotal.value)
})

const scoreWeightLabel = computed(() => canReadQuestionStats.value ? 'score weight indexed' : 'sign in for bank stats')

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

function resetHeroStats () {
  questionTotal.value = null
  scoreWeightTotal.value = null
  heroStatsError.value = ''
  heroStatsLoading.value = false
  heroStatsLoaded.value = false
}

function applyHeroStats (stats: HeroStats) {
  questionTotal.value = stats.questionTotal
  scoreWeightTotal.value = stats.scoreWeightTotal
  heroStatsLoaded.value = true
}

function sumQuestionScoreWeight (items: QuestionEntity[]) {
  return items.reduce((total, question) => {
    const weight = Number(question.scoreWeight)
    return total + (Number.isFinite(weight) ? weight : 0)
  }, 0)
}

async function loadHeroStats () {
  const requestId = ++heroStatsRequest
  heroStatsIdleQueued = false

  if (!canReadQuestionStats.value) {
    resetHeroStats()
    return
  }

  if (heroStatsLoaded.value) return

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

    applyHeroStats({
      questionTotal: pagination.total,
      scoreWeightTotal: scoreWeight
    })
  } catch (error) {
    if (requestId !== heroStatsRequest) return
    resetHeroStats()
    heroStatsError.value = apiErrorMessage(error, 'Failed to load question statistics.')
  } finally {
    if (requestId === heroStatsRequest) heroStatsLoading.value = false
  }
}

function queueHeroStatsLoad () {
  if (heroStatsLoaded.value || heroStatsLoading.value || heroStatsIdleQueued) return
  heroStatsIdleQueued = true
  runWhenIdle(() => {
    void loadHeroStats()
  })
}

if (import.meta.client) {
  watch([isAuthReady, canReadQuestionStats], ([ready, allowed]) => {
    if (!ready) return
    if (!allowed) {
      resetHeroStats()
      return
    }
    queueHeroStatsLoad()
  }, { immediate: true })
}

useSeoMeta({
  title: 'TestPapers',
  titleTemplate: '%s',
  description: 'Create professional test papers and exams with live LaTeX rendering. Question bank manager, PDF/DOCX exports, and real-time collaboration.',
  ogTitle: 'TestPapers - Professional Test Paper Creator',
  ogDescription: 'Create, manage, and export professional exams and assignments seamlessly with live LaTeX rendering.',
  ogImage: `${baseUrl}/og-image.png`,
  twitterTitle: 'TestPapers - Professional Test Paper Creator',
  twitterDescription: 'Create, manage, and export professional exams with live LaTeX rendering.',
  twitterImage: `${baseUrl}/og-image.png`
})

useHead({
  script: [
    {
      type: 'application/ld+json',
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'WebApplication',
        name: 'TestPapers',
        url: baseUrl,
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
  animation: revealLeft 0.72s cubic-bezier(0.16, 1, 0.3, 1) both;
}

.badge-pill {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 7px 14px;
  background: rgba(118, 87, 255, 0.1);
  color: var(--color-primary);
  border: 1px solid rgba(118, 87, 255, 0.2);
  border-radius: var(--radius-pill);
  font-size: .84rem;
  font-weight: 800;
  position: relative;
  overflow: hidden;
  animation: revealUp 0.48s var(--ease-out) 0.08s both;
}

.hero-title {
  max-width: 760px;
  font-size: clamp(3rem, 5vw, 4rem);
  line-height: 1.1;
  font-weight: 800;
  letter-spacing: 0;
}

.text-gradient {
  background: linear-gradient(115deg, var(--color-primary), #8b5cf6, var(--color-secondary), #bb86fc, var(--color-primary));
  background-size: 240% 100%;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  animation: gradientText 7s ease-in-out infinite;
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
.hero-actions .btn {
  animation: revealUp 0.48s var(--ease-out) both;
}
.hero-actions .btn:nth-child(1) { animation-delay: 0.12s; }
.hero-actions .btn:nth-child(2) { animation-delay: 0.16s; }
.hero-actions .btn:nth-child(3) { animation-delay: 0.2s; }
.hero-actions .btn:nth-child(4) { animation-delay: 0.24s; }

.btn-lg {
  min-height: 48px;
  padding: 12px 22px;
  font-size: .98rem;
}

.hero-board {
  position: relative;
  min-height: 500px;
  border-radius: var(--radius-lg);
  padding: 22px;
  background:
    linear-gradient(150deg, rgba(255, 255, 255, 0.82), rgba(255, 255, 255, 0.42)),
    linear-gradient(135deg, rgba(118, 87, 255, 0.18), rgba(14, 165, 233, 0.08));
  border: 1px solid rgba(118, 87, 255, 0.22);
  box-shadow: var(--shadow);
  overflow: hidden;
  transform-style: preserve-3d;
  animation: boardEnter 0.78s var(--ease-out) 0.08s both;
}

.hero-board::before {
  content: "";
  position: absolute;
  inset: 22px;
  border: 1px solid rgba(118, 87, 255, 0.18);
  transform: rotate(-4deg);
  animation: heroFrame 9s ease-in-out infinite;
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
  border-radius: var(--radius-lg);
  font-weight: 800;
  animation: revealUp 0.46s var(--ease-out) 0.22s both;
}

.board-topline strong {
  margin-left: auto;
  color: var(--color-accent);
}

.board-dot {
  width: 10px;
  height: 10px;
  border-radius: var(--radius-pill);
  background: var(--color-warm);
  box-shadow: 0 0 0 6px rgba(255, 138, 76, 0.12);
  animation: dotPulse 1.9s ease-in-out infinite;
}

.formula-card {
  margin: 36px auto 18px;
  width: min(100%, 340px);
  padding: 24px;
  border-radius: var(--radius-lg);
  transform: rotate(-2deg);
  transition: transform .38s var(--ease-out), box-shadow .38s var(--ease-out), border-color .38s ease;
  animation: formulaFloat 6.2s ease-in-out infinite, revealUp 0.54s var(--ease-out) 0.32s both;
}
.formula-card:hover {
  transform: translateY(-8px) rotate(-1deg) scale(1.015);
  box-shadow: 0 18px 42px rgba(62, 40, 126, .16);
  border-color: rgba(118, 87, 255, .28);
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
  animation: connectorPulse 2.8s ease-in-out infinite;
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
  transition: border-radius .32s var(--ease-out), transform .32s var(--ease-spring), box-shadow .32s var(--ease-out), border-color .32s ease;
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
  animation: miniFloatOne 6.4s ease-in-out infinite, revealUp 0.48s var(--ease-out) 0.42s both;
}

.mini-panel:nth-child(2) {
  transform: translateY(18px);
  animation: miniFloatTwo 6.8s ease-in-out infinite, revealUp 0.48s var(--ease-out) 0.5s both;
}
.mini-panel:hover {
  border-radius: 38%;
  box-shadow: 0 18px 38px rgba(62, 40, 126, .16);
}

.mini-panel svg {
  color: rgba(255, 255, 255, 0.95);
  font-size: 1.35rem;
}

.mini-panel strong {
  font-size: clamp(1.8rem, 3vw, 2.25rem);
  line-height: 1;
  letter-spacing: 0;
  word-break: break-word;
}

.mini-panel span {
  color: rgba(255, 255, 255, 0.92);
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
  border-radius: var(--radius-pill);
  background: rgba(118, 87, 255, 0.2);
  transform-origin: left center;
  animation: stackLine 2.4s ease-in-out infinite;
}

.paper-stack span:nth-child(2) {
  width: 82%;
  background: rgba(14, 165, 233, 0.2);
  animation-delay: 0.18s;
}

.paper-stack span:nth-child(3) {
  width: 62%;
  background: rgba(255, 138, 76, 0.24);
  animation-delay: 0.36s;
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
  border-radius: var(--radius-lg);
  color: var(--color-text);
  background: var(--color-surface);
  box-shadow: var(--shadow-soft);
  overflow: hidden;
  position: relative;
  isolation: isolate;
  transition: transform .34s var(--ease-out), box-shadow .34s var(--ease-out), border-color .34s ease, background .34s ease;
  animation: revealUp 0.55s var(--ease-out) both;
}
.workflow-card:nth-child(1) { animation-delay: 0.08s; }
.workflow-card:nth-child(2) { animation-delay: 0.16s; }
.workflow-card:nth-child(3) { animation-delay: 0.24s; }

.workflow-card::after {
  content: "";
  position: absolute;
  inset: auto -20% -40% 25%;
  height: 150px;
  transform: rotate(-8deg);
  background: linear-gradient(90deg, rgba(118, 87, 255, 0.1), rgba(14, 165, 233, 0.1));
  transition: transform .36s ease, opacity .36s ease;
  z-index: 0;
}
.workflow-card::before {
  content: "";
  position: absolute;
  inset: 0;
  z-index: 0;
  opacity: 0;
  background: radial-gradient(circle at 22% 16%, rgba(118, 87, 255, .13), transparent 36%);
  transition: opacity .34s ease;
}

.workflow-card:hover {
  transform: translateY(-8px) scale(1.01);
  border-color: rgba(118, 87, 255, 0.34);
  box-shadow: var(--shadow);
}
.workflow-card:hover::before {
  opacity: 1;
}
.workflow-card:hover::after {
  transform: translateX(10%) rotate(-5deg);
  opacity: .9;
}
.workflow-card:hover .btn-text svg {
  transform: translateX(4px);
}

.workflow-card--accent {
  background: linear-gradient(145deg, rgba(118, 87, 255, 0.12), var(--color-surface));
}

.workflow-icon {
  display: inline-grid;
  place-items: center;
  width: 46px;
  height: 46px;
  border-radius: var(--radius-lg);
  color: #fff;
  background: linear-gradient(135deg, var(--color-primary), var(--color-secondary));
  box-shadow: 0 12px 26px rgba(118, 87, 255, 0.22);
  transition: transform .34s var(--ease-spring), box-shadow .34s var(--ease-out);
}
.workflow-card:hover .workflow-icon {
  transform: translateY(-4px) rotate(-5deg) scale(1.08);
  box-shadow: 0 18px 34px rgba(118, 87, 255, 0.28);
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
.btn-text svg {
  transition: transform .2s ease;
}

@keyframes heroFrame {
  0%, 100% { transform: rotate(-4deg) scale(1); }
  50% { transform: rotate(-2.4deg) scale(1.015); }
}
@keyframes boardEnter {
  from { opacity: 0; transform: translateX(24px) rotateX(3deg) scale(.985); }
  to { opacity: 1; transform: translateX(0) rotateX(0) scale(1); }
}
@keyframes gradientText {
  0%, 100% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
}
@keyframes dotPulse {
  0%, 100% { box-shadow: 0 0 0 6px rgba(255, 138, 76, 0.12); }
  50% { box-shadow: 0 0 0 11px rgba(255, 138, 76, 0); }
}
@keyframes formulaFloat {
  0%, 100% { transform: translateY(0) rotate(-2deg); }
  50% { transform: translateY(-8px) rotate(-.9deg); }
}
@keyframes connectorPulse {
  0%, 100% { opacity: .52; transform: translateY(-50%) scaleX(.88); }
  50% { opacity: .9; transform: translateY(-50%) scaleX(1); }
}
@keyframes miniFloatOne {
  0%, 100% { transform: translateY(-4px); }
  50% { transform: translateY(-14px); }
}
@keyframes miniFloatTwo {
  0%, 100% { transform: translateY(18px); }
  50% { transform: translateY(8px); }
}
@keyframes stackLine {
  0%, 100% { transform: scaleX(.72); opacity: .62; }
  50% { transform: scaleX(1); opacity: 1; }
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
