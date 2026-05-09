<template>
  <div class="form-group">
    <label class="form-label">{{ $t('images.title') }}</label>
    <div class="image-upload-area">
      <input
        ref="imageInput"
        type="file"
        accept="image/*"
        class="form-input image-input"
        @change="handleSelected"
      />
    </div>
    <div v-if="images.length" class="image-previews">
      <div v-for="(img, imgIdx) in images" :key="imgIdx" class="image-preview-item">
        <img :src="img.url" alt="Question image" class="preview-thumb" />
        <div class="img-info">
          <input
            :value="img.caption"
            class="form-input form-input--sm"
            :placeholder="$t('images.captionPlaceholder')"
            @input="updateCaption(imgIdx, ($event.target as HTMLInputElement).value)"
          />
          <button type="button" class="btn btn-outline btn-sm" @click="$emit('remove', imgIdx)">
            {{ $t('images.remove') }}
          </button>
        </div>
      </div>
    </div>
    <span v-if="uploading" class="form-hint">{{ $t('images.uploading') }}</span>
  </div>
</template>

<script setup lang="ts">
import type { QuestionImage } from '~/types/question'

const props = defineProps<{
  images: QuestionImage[]
  uploading: boolean
}>()

const emit = defineEmits<{
  select: [event: Event]
  remove: [index: number]
  'update:images': [images: QuestionImage[]]
}>()

const imageInput = ref<HTMLInputElement | null>(null)

function handleSelected (event: Event) {
  emit('select', event)
  if (imageInput.value) imageInput.value.value = ''
}

function updateCaption (index: number, caption: string) {
  const next = props.images.map((image, imageIndex) => imageIndex === index ? { ...image, caption } : image)
  emit('update:images', next)
}
</script>

<style scoped>
.image-upload-area {
  margin-bottom: 8px;
}
.image-input {
  padding: 4px;
}
.image-previews {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 8px;
}
.image-preview-item {
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  padding: 8px;
  background: var(--color-bg);
  max-width: 220px;
}
.preview-thumb {
  width: 100%;
  max-height: 140px;
  object-fit: contain;
  border-radius: 4px;
}
.img-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-top: 6px;
}
.form-input--sm {
  font-size: .8rem;
  padding: 4px 8px;
}
</style>
