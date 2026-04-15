<template>
  <div class="site-wrapper">
    <header class="site-header">
      <div class="header-inner">
        <NuxtLink to="/" class="logo">📝 TestPapers</NuxtLink>
        <nav class="site-nav">
          <NuxtLink to="/" class="nav-link">Home</NuxtLink>
          <NuxtLink to="/questions" class="nav-link">Questions</NuxtLink>
          <NuxtLink to="/papers" class="nav-link">Assemble Paper</NuxtLink>
          <NuxtLink to="/add-problem" class="nav-link nav-link--highlight">+ Add Problem</NuxtLink>
        </nav>
      </div>
    </header>

    <main class="site-main">
      <slot />
    </main>

    <footer class="site-footer">
      <p>© {{ new Date().getFullYear() }} TestPapers — Create, manage and export test papers with ease.</p>
    </footer>
  </div>
</template>

<style>
/* ── Global reset & variables ── */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

:root {
  --color-bg:        #f5f7fb;
  --color-surface:   #ffffff;
  --color-primary:   #4f6ef7;
  --color-primary-d: #3a56d4;
  --color-accent:    #22c55e;
  --color-text:      #1e2a3a;
  --color-muted:     #6b7280;
  --color-border:    #e2e8f0;
  --color-danger:    #ef4444;
  --radius:          8px;
  --shadow:          0 2px 12px rgba(0,0,0,.08);
  --header-h:        60px;
  font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
  color: var(--color-text);
  background: var(--color-bg);
}

a { color: inherit; text-decoration: none; }
button { cursor: pointer; font: inherit; }
input, textarea, select { font: inherit; }

/* ── Layout ── */
.site-wrapper { display: flex; flex-direction: column; min-height: 100vh; }

/* ── Header ── */
.site-header {
  position: sticky; top: 0; z-index: 100;
  height: var(--header-h);
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
  box-shadow: 0 1px 4px rgba(0,0,0,.06);
}
.header-inner {
  max-width: 1100px; margin: 0 auto; padding: 0 24px;
  height: 100%; display: flex; align-items: center; justify-content: space-between;
}
.logo {
  font-size: 1.25rem; font-weight: 700; color: var(--color-primary);
  display: flex; align-items: center; gap: 6px;
}
.site-nav { display: flex; align-items: center; gap: 4px; }
.nav-link {
  padding: 6px 14px; border-radius: var(--radius);
  font-size: .9rem; font-weight: 500; color: var(--color-muted);
  transition: background .15s, color .15s;
}
.nav-link:hover { background: var(--color-bg); color: var(--color-text); }
.nav-link.router-link-active { background: #eff3fe; color: var(--color-primary); }
.nav-link--highlight {
  background: var(--color-primary); color: #fff !important;
  margin-left: 8px;
}
.nav-link--highlight:hover { background: var(--color-primary-d) !important; }
.nav-link--highlight.router-link-active { background: var(--color-primary-d) !important; }

/* ── Main ── */
.site-main { flex: 1; max-width: 1100px; width: 100%; margin: 0 auto; padding: 32px 24px; }

/* ── Footer ── */
.site-footer {
  text-align: center; padding: 20px;
  font-size: .8rem; color: var(--color-muted);
  border-top: 1px solid var(--color-border);
}

/* ── Shared utility classes ── */
.card {
  background: var(--color-surface); border: 1px solid var(--color-border);
  border-radius: var(--radius); box-shadow: var(--shadow);
  padding: 20px;
}
.btn {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 8px 18px; border-radius: var(--radius);
  font-size: .9rem; font-weight: 500; border: none;
  transition: background .15s, opacity .15s;
}
.btn:disabled { opacity: .5; cursor: not-allowed; }
.btn-primary { background: var(--color-primary); color: #fff; }
.btn-primary:hover:not(:disabled) { background: var(--color-primary-d); }
.btn-outline {
  background: transparent; color: var(--color-primary);
  border: 1px solid var(--color-primary);
}
.btn-outline:hover:not(:disabled) { background: #eff3fe; }
.btn-danger { background: var(--color-danger); color: #fff; }
.btn-danger:hover:not(:disabled) { background: #dc2626; }
.btn-success { background: var(--color-accent); color: #fff; }
.btn-success:hover:not(:disabled) { background: #16a34a; }
.btn-sm { padding: 5px 12px; font-size: .8rem; }
.badge {
  display: inline-block; padding: 2px 10px;
  border-radius: 999px; font-size: .75rem; font-weight: 600;
}
.badge-easy   { background: #dcfce7; color: #15803d; }
.badge-medium { background: #fef9c3; color: #a16207; }
.badge-hard   { background: #fee2e2; color: #b91c1c; }
.tag {
  display: inline-block; padding: 2px 8px;
  border-radius: 4px; font-size: .75rem; font-weight: 500;
  background: #eff3fe; color: var(--color-primary);
}
.page-title { font-size: 1.75rem; font-weight: 700; margin-bottom: 6px; }
.page-sub { color: var(--color-muted); margin-bottom: 24px; font-size: .95rem; }
.form-group { display: flex; flex-direction: column; gap: 6px; margin-bottom: 18px; }
.form-label { font-size: .875rem; font-weight: 600; }
.form-input {
  padding: 9px 12px; border: 1px solid var(--color-border);
  border-radius: var(--radius); background: var(--color-surface);
  transition: border-color .15s;
}
.form-input:focus { outline: none; border-color: var(--color-primary); }
.form-hint { font-size: .775rem; color: var(--color-muted); }
</style>
