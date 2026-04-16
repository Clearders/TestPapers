<template>
  <section>
    <h1 class="page-title">Welcome to TestPapers 📝</h1>
    <p class="page-sub">Create, manage, and export professional test papers with real-time LaTeX support.</p>

    <!-- Feature cards -->
    <div class="feature-grid">
      <a href="/questions" class="feature-card card" style="--i:0">
        <div class="feature-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" class="feature-icon-svg">
            <circle cx="11" cy="11" r="6"></circle>
            <line x1="16" y1="16" x2="21" y2="21"></line>
          </svg>
        </div>
        <h2>Browse Questions</h2>
        <p>Search and filter your question bank. Preview LaTeX formulae inline.</p>
        <span class="btn btn-outline btn-sm" style="margin-top:auto">Go →</span>
      </a>

      <a href="/papers" class="feature-card card" style="--i:1">
        <div class="feature-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" class="feature-icon-svg">
            <path d="M7 3h7l4 4v14H7z"></path>
            <polyline points="14 3 14 7 18 7"></polyline>
            <line x1="10" y1="12" x2="16" y2="12"></line>
            <line x1="10" y1="16" x2="16" y2="16"></line>
          </svg>
        </div>
        <h2>Assemble Paper</h2>
        <p>Pick questions from the bank and arrange them into a complete test paper.</p>
        <span class="btn btn-outline btn-sm" style="margin-top:auto">Go →</span>
      </a>

      <a href="/add-problem" class="feature-card card" style="--i:2">
        <div class="feature-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" class="feature-icon-svg">
            <rect x="4" y="4" width="16" height="16" rx="4"></rect>
            <line x1="12" y1="8" x2="12" y2="16"></line>
            <line x1="8" y1="12" x2="16" y2="12"></line>
          </svg>
        </div>
        <h2>Add Problem</h2>
        <p>Compose a new problem with a live LaTeX preview as you type.</p>
        <span class="btn btn-primary btn-sm" style="margin-top:auto">Go →</span>
      </a>

      <a href="/latex" class="feature-card card" style="--i:3">
        <div class="feature-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" class="feature-icon-svg">
            <path d="M9 4h8"></path>
            <path d="M15 4l-6 8 6 8"></path>
            <path d="M18 8v8"></path>
            <path d="M21 10l-3 2 3 2"></path>
          </svg>
        </div>
        <h2>LaTeX Preview</h2>
        <p>Type a LaTeX expression and see it rendered instantly in real-time.</p>
        <span class="btn btn-outline btn-sm" style="margin-top:auto">Go →</span>
      </a>
    </div>
  </section>
</template>

<style scoped>
.feature-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 20px;
}
.feature-card {
  display: flex; flex-direction: column; gap: 10px;
  padding: 28px 22px; border-radius: var(--radius);
  transition: transform .32s cubic-bezier(0.16, 1, 0.3, 1), box-shadow .32s ease;
  color: var(--color-text);
  text-decoration: none;
  animation: featureIn .55s ease-out backwards;
  animation-delay: calc(var(--i) * 0.08s);
  will-change: transform;
}

.feature-card:hover {
  box-shadow: 0 12px 28px rgba(0,0,0,.12);
  transform: translateY(-4px);
}
.feature-icon {
  width: 48px;
  height: 48px;
  border-radius: 14px;
  display: grid;
  place-items: center;
  background: linear-gradient(145deg, rgba(86, 119, 252, 0.12), rgba(86, 119, 252, 0.04));
  transition: transform .28s ease, background .28s ease;
}
.feature-icon-svg {
  width: 24px;
  height: 24px;
  fill: none;
  stroke: var(--color-primary);
  stroke-width: 1.8;
  stroke-linecap: round;
  stroke-linejoin: round;
  transition: transform .28s ease;
}
.feature-card:hover .feature-icon {
  transform: translateY(-1px) scale(1.04);
  background: linear-gradient(145deg, rgba(86, 119, 252, 0.18), rgba(86, 119, 252, 0.08));
}
.feature-card:hover .feature-icon-svg {
  transform: scale(1.06);
}
.feature-card h2 { font-size: 1.1rem; font-weight: 700; transition: color 0.3s ease; }
.feature-card:hover h2 { color: var(--color-primary); }
.feature-card p  { font-size: .9rem; color: var(--color-muted); flex: 1; }

@keyframes featureIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (prefers-reduced-motion: reduce) {
  .feature-card {
    animation: none;
    transition: none;
  }
  .feature-icon,
  .feature-icon-svg {
    transition: none;
  }
}
</style>
