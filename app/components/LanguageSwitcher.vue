<template>
  <div class="lang-switcher">
    <button class="lang-btn" :class="{ active: currentLocale === 'en' }" @click="switchTo('en')" title="English">
      🇬🇧 EN
    </button>
    <button class="lang-btn" :class="{ active: currentLocale === 'zh' }" @click="switchTo('zh')" title="中文">
      🇨🇳 中文
    </button>
  </div>
</template>

<script setup lang="ts">
const { locale } = useI18n()
const nuxtLocale = useLocale()

const currentLocale = computed(() => locale.value)

function switchTo (code: 'en' | 'zh') {
  if (locale.value !== code) {
    // Persist to localStorage for reliable cross-session persistence
    if (import.meta.client) {
      localStorage.setItem('app-locale', code)
    }
    // Use @nuxtjs/i18n locale switching (handles cookie + URL navigation)
    nuxtLocale.value = code
  }
}
</script>

<style scoped>
.lang-switcher {
  display: flex;
  align-items: center;
  gap: 4px;
}
.lang-btn {
  padding: 4px 10px;
  border-radius: var(--radius);
  font-size: .78rem;
  font-weight: 500;
  border: 1px solid var(--color-border);
  background: transparent;
  color: var(--color-muted);
  cursor: pointer;
  transition: all 0.25s ease;
}
.lang-btn:hover {
  background: var(--color-bg);
  color: var(--color-text);
}
.lang-btn.active {
  background: var(--color-primary);
  color: #fff;
  border-color: var(--color-primary);
}
</style>
