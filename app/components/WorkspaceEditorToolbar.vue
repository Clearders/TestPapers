<template>
  <div class="editor-toolbar card">
    <div>
      <h2>Paper Editor</h2>
      <p>Draft metadata, generate a balanced paper, order questions, preview output, and export DOCX.</p>
    </div>
    <div class="editor-actions">
      <button type="button" class="btn btn-outline" @click="emit('newPaper')">
        <AppIcon name="add" />
        New Paper
      </button>
      <button type="button" class="btn btn-outline" @click="emit('openBank')">
        <AppIcon name="search" />
        Open Bank
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
const emit = defineEmits<{
  newPaper: []
  openBank: []
}>()
</script>

<style scoped>
.editor-toolbar {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
  margin-bottom: 18px;
  background:
    linear-gradient(135deg, rgba(118, 87, 255, 0.08), rgba(14, 165, 233, 0.04)),
    var(--color-surface);
}

.editor-toolbar h2 {
  font-size: 1.05rem;
  font-weight: 850;
}

.editor-toolbar p {
  margin-top: 4px;
  color: var(--color-muted);
  font-size: .86rem;
  line-height: 1.5;
}

.editor-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

@media (max-width: 620px) {
  .editor-actions,
  .editor-actions .btn {
    width: 100%;
  }

  .editor-toolbar {
    flex-direction: column;
  }
}
</style>
