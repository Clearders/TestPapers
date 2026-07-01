<template>
  <div
    class="workspace-tabs"
    :class="`workspace-tabs--${activeSection}`"
    role="tablist"
    aria-label="Workspace sections"
  >
    <button
      type="button"
      role="tab"
      :aria-selected="activeSection === 'editor'"
      class="workspace-tab"
      :class="{ 'workspace-tab--active': activeSection === 'editor' }"
      @click="emit('update:activeSection', 'editor')"
    >
      <AppIcon name="paper" />
      Paper Editor
    </button>
    <button
      type="button"
      role="tab"
      :aria-selected="activeSection === 'bank'"
      class="workspace-tab"
      :class="{ 'workspace-tab--active': activeSection === 'bank' }"
      @click="emit('update:activeSection', 'bank')"
    >
      <AppIcon name="search" />
      Question Bank
    </button>
  </div>
</template>

<script setup lang="ts">
type WorkspaceSection = 'editor' | 'bank'

defineProps<{
  activeSection: WorkspaceSection
}>()

const emit = defineEmits<{
  'update:activeSection': [value: WorkspaceSection]
}>()
</script>

<style scoped>
.workspace-tabs {
  position: relative;
  display: inline-grid;
  grid-template-columns: repeat(2, minmax(128px, 1fr));
  gap: 6px;
  padding: 5px;
  margin-bottom: 20px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-pill);
  background: color-mix(in srgb, var(--color-surface-solid) 72%, transparent);
  box-shadow: var(--shadow-soft);
  isolation: isolate;
}

.workspace-tabs::before {
  content: "";
  position: absolute;
  z-index: 0;
  top: 5px;
  bottom: 5px;
  left: 5px;
  width: calc((100% - 16px) / 2);
  border-radius: var(--radius-pill);
  background: linear-gradient(135deg, var(--color-primary), var(--color-secondary));
  box-shadow: 0 10px 24px rgba(118, 87, 255, .22);
  transform: translateX(0);
  transition: transform .34s var(--ease-spring), box-shadow .24s ease, opacity .2s ease;
}

.workspace-tabs--bank::before {
  transform: translateX(calc(100% + 6px));
}

.workspace-tab {
  position: relative;
  z-index: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 36px;
  padding: 7px 16px;
  border: 1px solid transparent;
  border-radius: var(--radius-pill);
  background: transparent;
  color: var(--color-muted);
  font-size: .88rem;
  font-weight: 800;
  transition: color .2s ease, background .2s ease, transform .2s var(--ease-spring), box-shadow .2s ease;
}

.workspace-tab:hover {
  color: var(--color-text);
  transform: translateY(-1px);
}

.workspace-tab--active {
  color: var(--color-on-primary);
  background: transparent;
  box-shadow: none;
}

@media (max-width: 620px) {
  .workspace-tabs,
  .workspace-tab {
    width: 100%;
  }

  .workspace-tabs {
    border-radius: var(--radius);
    grid-template-columns: 1fr;
  }

  .workspace-tabs::before {
    right: 5px;
    bottom: auto;
    width: auto;
    height: calc((100% - 16px) / 2);
    border-radius: var(--radius);
  }

  .workspace-tabs--bank::before {
    transform: translateY(calc(100% + 6px));
  }
}

@media (prefers-reduced-motion: reduce) {
  .workspace-tabs::before {
    transition: none;
  }
}
</style>
