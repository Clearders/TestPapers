<template>
  <div class="home-wrapper">
    <section class="hero-section">
      <div class="hero-content">
        <div class="badge-pill bounce-in">Welcome to the new standard</div>
        <h1 class="hero-title slide-up">Craft Perfect <span class="text-gradient">TestPapers</span></h1>
        <p class="hero-sub slide-up-delay">Create, manage, and export professional exams and assignments seamlessly with live LaTeX rendering.</p>
        <div class="hero-actions slide-up-delay-2">
          <NuxtLink v-if="hasPermission('questions:write')" to="/add-problem" class="btn btn-primary btn-lg shine-effect">Create a Problem</NuxtLink>
          <NuxtLink v-if="hasPermission('questions:read')" to="/questions" class="btn btn-glass btn-lg">Open Workspace</NuxtLink>
          <NuxtLink v-if="!isAuthenticated" to="/login" class="btn btn-primary btn-lg shine-effect">Login</NuxtLink>
        </div>
      </div>
    </section>

    <section class="content-section">
      <div class="feature-grid">
        <NuxtLink to="/questions" class="feature-card card-glass" style="--i:0">
          <div class="feature-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" class="feature-icon-svg">
              <circle cx="11" cy="11" r="6"></circle>
              <line x1="16" y1="16" x2="21" y2="21"></line>
            </svg>
          </div>
          <h2>Question Workspace</h2>
          <p>Search the bank, inspect answers, and build a paper in the same workspace.</p>
          <span class="btn-text" style="margin-top:auto">Open Workspace →</span>
        </NuxtLink>

        <NuxtLink v-if="hasPermission('questions:write')" to="/add-problem" class="feature-card card-glass" style="--i:1">
          <div class="feature-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" class="feature-icon-svg">
              <rect x="4" y="4" width="16" height="16" rx="4"></rect>
              <line x1="12" y1="8" x2="12" y2="16"></line>
              <line x1="8" y1="12" x2="16" y2="12"></line>
            </svg>
          </div>
          <h2>Add Problem</h2>
          <p>Compose a new problem and instantly check formatting with a live LaTeX preview as you type.</p>
          <span class="btn-text highlight" style="margin-top:auto">Compose Now →</span>
        </NuxtLink>

        <NuxtLink to="/latex" class="feature-card card-glass" style="--i:2">
          <div class="feature-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" class="feature-icon-svg">
              <path d="M9 4h8"></path>
              <path d="M15 4l-6 8 6 8"></path>
              <path d="M18 8v8"></path>
              <path d="M21 10l-3 2 3 2"></path>
            </svg>
          </div>
          <h2>LaTeX Preview</h2>
          <p>A quick sandbox. Type any LaTeX expression and see it rendered to verify math syntax.</p>
          <span class="btn-text" style="margin-top:auto">Try Sandbox →</span>
        </NuxtLink>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
const { hasPermission, isAuthenticated } = useAuth()

useSeoMeta({
  title: 'TestPapers',
  titleTemplate: '%s',
  description: 'Create professional test papers and exams with live LaTeX rendering. Question bank manager, PDF/DOCX exports, and real-time collaboration.',
  ogTitle: 'TestPapers — Professional Test Paper Creator',
  ogDescription: 'Create, manage, and export professional exams and assignments seamlessly with live LaTeX rendering.',
  ogImage: `${useRequestURL().origin}/og-image.png`,
  twitterTitle: 'TestPapers — Professional Test Paper Creator',
  twitterDescription: 'Create, manage, and export professional exams and assignments seamlessly with live LaTeX rendering.',
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
  position: relative;
  display: flex;
  flex-direction: column;
  gap: clamp(28px, 6vh, 48px);
  padding: 12px 0 56px;
}
.hero-section {
  text-align: center;
  padding: 52px 20px 34px;
  position: relative;
  z-index: 2;
}
.hero-content {
  max-width: 800px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.badge-pill {
  display: inline-block;
  padding: 6px 16px;
  background: rgba(79, 110, 247, 0.1);
  color: var(--color-primary);
  border: 1px solid rgba(79, 110, 247, 0.2);
  border-radius: 999px;
  font-size: 0.85rem;
  font-weight: 600;
  margin-bottom: 24px;
}
.hero-title {
  font-size: 4rem;
  font-weight: 800;
  line-height: 1.1;
  color: var(--color-text);
  margin-bottom: 20px;
  letter-spacing: 0;
}
.text-gradient {
  background: linear-gradient(135deg, var(--color-primary), #bb86fc);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
.hero-sub {
  font-size: 1.2rem;
  color: var(--color-muted);
  max-width: 600px;
  margin-bottom: 32px;
  line-height: 1.6;
}
.hero-actions {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
  justify-content: center;
}
.btn-lg {
  padding: 12px 28px;
  font-size: 1rem;
  border-radius: var(--radius);
  font-weight: 600;
}
.btn-glass {
  background: rgba(255, 255, 255, 0.4);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.5);
  color: var(--color-text);
  transition: background 0.3s ease, transform 0.3s ease, box-shadow 0.3s ease;
}
.btn-glass:hover {
  background: rgba(255, 255, 255, 0.8);
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(0,0,0,0.06);
}
.shine-effect {
  position: relative;
  overflow: hidden;
}
.shine-effect::after {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 50%;
  height: 100%;
  background: linear-gradient(to right, rgba(255,255,255,0) 0%, rgba(255,255,255,0.3) 50%, rgba(255,255,255,0) 100%);
  transform: skewX(-20deg);
  animation: shine 3s infinite;
}
@keyframes shine {
  0% { left: -100%; }
  20% { left: 200%; }
  100% { left: 200%; }
}
.content-section {
  position: relative;
  z-index: 1;
  padding: 0 10px;
}
.feature-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 250px), 1fr));
  gap: 24px;
}
.card-glass {
  background: rgba(255, 255, 255, 0.4);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid rgba(255, 255, 255, 0.6);
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.04);
}
.feature-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 32px 24px;
  border-radius: var(--radius);
  transition: transform .3s cubic-bezier(0.16, 1, 0.3, 1), box-shadow .3s ease, border-color .3s ease;
  color: var(--color-text);
  text-decoration: none;
  animation: featureIn .6s ease-out backwards;
  animation-delay: calc(var(--i) * 0.1s + 0.3s);
}
.feature-card:hover {
  box-shadow: 0 16px 32px rgba(79, 110, 247, 0.08);
  transform: translateY(-6px);
  border-color: rgba(79, 110, 247, 0.3);
  background: rgba(255, 255, 255, 0.6);
}
.feature-icon {
  width: 52px;
  height: 52px;
  border-radius: 14px;
  display: grid;
  place-items: center;
  background: linear-gradient(145deg, rgba(86, 119, 252, 0.15), rgba(86, 119, 252, 0.04));
  transition: transform .3s ease, background .3s ease;
  margin-bottom: 8px;
}
.feature-icon-svg {
  width: 26px;
  height: 26px;
  fill: none;
  stroke: var(--color-primary);
  stroke-width: 1.8;
  stroke-linecap: round;
  stroke-linejoin: round;
  transition: transform .3s ease;
}
.feature-card:hover .feature-icon {
  transform: translateY(-2px) scale(1.05);
  background: linear-gradient(145deg, rgba(86, 119, 252, 0.22), rgba(86, 119, 252, 0.08));
}
.feature-card:hover .feature-icon-svg {
  transform: scale(1.1);
}
.feature-card h2 {
  font-size: 1.15rem;
  font-weight: 700;
  transition: color 0.3s ease;
}
.feature-card:hover h2 {
  color: var(--color-primary);
}
.feature-card p {
  font-size: .95rem;
  color: var(--color-muted);
  flex: 1;
  line-height: 1.5;
}
.btn-text {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--color-muted);
  display: inline-flex;
  align-items: center;
  transition: color 0.2s ease, transform 0.2s ease;
}
.btn-text.highlight {
  color: var(--color-primary);
}
.feature-card:hover .btn-text {
  color: var(--color-primary);
  transform: translateX(4px);
}
.bounce-in {
  animation: bounceIn 0.8s cubic-bezier(0.175, 0.885, 0.32, 1.275) backwards;
}
.slide-up {
  animation: slideUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) backwards;
}
.slide-up-delay {
  animation: slideUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) backwards;
  animation-delay: 0.1s;
}
.slide-up-delay-2 {
  animation: slideUp 2s cubic-bezier(0.16, 1, 0.3, 1) backwards;
  animation-delay: 0.2s;
}
@keyframes bounceIn {
  0% { opacity: 0; transform: scale(0.8) translateY(20px); }
  100% { opacity: 1; transform: scale(1) translateY(0); }
}
@keyframes slideUp {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes featureIn {
  from { opacity: 0; transform: translateY(16px); }
  to { opacity: 1; transform: translateY(0); }
}
@media (prefers-reduced-motion: reduce) {
  .feature-card,
  .slide-up,
  .bounce-in,
  .slide-up-delay,
  .slide-up-delay-2,
  .shine-effect::after {
    animation: none;
    transition: none;
  }
}

[data-theme="dark"] .text-gradient {
  background: linear-gradient(135deg, var(--color-primary), #c4b5fd);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

[data-theme="dark"] .badge-pill {
  background: rgba(129, 140, 248, 0.12);
  border-color: rgba(129, 140, 248, 0.25);
}

[data-theme="dark"] .card-glass {
  background: rgba(30, 41, 59, 0.6);
  border-color: rgba(51, 65, 85, 0.6);
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.2);
}

[data-theme="dark"] .feature-card:hover {
  background: rgba(30, 41, 59, 0.85);
  border-color: rgba(129, 140, 248, 0.4);
  box-shadow: 0 16px 32px rgba(129, 140, 248, 0.08);
}

[data-theme="dark"] .btn-glass {
  background: rgba(30, 41, 59, 0.6);
  border-color: rgba(51, 65, 85, 0.6);
}

[data-theme="dark"] .btn-glass:hover {
  background: rgba(30, 41, 59, 0.85);
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.3);
}

[data-theme="dark"] .shine-effect::after {
  background: linear-gradient(to right, rgba(255,255,255,0) 0%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0) 100%);
}

@media (max-width: 900px) {
  .hero-title {
    font-size: 3rem;
  }

  .hero-sub {
    font-size: 1.08rem;
  }
}
@media (max-width: 560px) {
  .home-wrapper {
    padding-bottom: 36px;
  }

  .hero-section {
    padding: 34px 4px 20px;
  }

  .hero-title {
    font-size: 2.25rem;
  }

  .hero-actions,
  .hero-actions .btn {
    width: 100%;
  }

  .feature-card {
    padding: 24px 18px;
  }
}
</style>
