<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="visible" class="cropper-overlay" @click.self="$emit('close')">
        <div class="cropper-panel" role="dialog" aria-modal="true" aria-label="Edit avatar">
          <div class="cropper-head">
            <h2>Edit Avatar</h2>
            <button class="modal-close" type="button" aria-label="Close" @click="$emit('close')">&times;</button>
          </div>

          <div class="cropper-body">
            <div ref="containerRef" class="cropper-area"></div>

            <div class="cropper-toolbar">
              <button
                type="button"
                class="btn btn-outline btn-sm"
                aria-label="Rotate left"
                @click="rotateLeft"
              >↺</button>
              <button
                type="button"
                class="btn btn-outline btn-sm"
                aria-label="Rotate right"
                @click="rotateRight"
              >↻</button>
              <button
                type="button"
                class="btn btn-outline btn-sm"
                aria-label="Zoom out"
                @click="zoomOut"
              >−</button>
              <button
                type="button"
                class="btn btn-outline btn-sm"
                aria-label="Zoom in"
                @click="zoomIn"
              >+</button>
              <button
                type="button"
                class="btn btn-outline btn-sm"
                aria-label="Flip horizontal"
                @click="flipHorizontal"
              >⇔</button>
              <button
                type="button"
                class="btn btn-outline btn-sm"
                aria-label="Flip vertical"
                @click="flipVertical"
              >⇕</button>
            </div>
          </div>

          <div class="cropper-footer">
            <button type="button" class="btn btn-outline" @click="handleReset">Reset</button>
            <button type="button" class="btn btn-primary" @click="handleConfirm">Confirm</button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import Cropper from 'cropperjs'

const props = defineProps<{
  file: File | null
  visible: boolean
}>()

const emit = defineEmits<{
  close: []
  cropped: [file: File]
}>()

const containerRef = ref<HTMLElement | null>(null)
const imgRef = ref<HTMLImageElement | null>(null)
const objectUrl = ref('')
let cropper: Cropper | null = null

const cropperOptions = {
  template: `
    <cropper-canvas background>
      <cropper-image
        rotatable
        scalable
        skewable
        translatable
        initial-center-size="contain"
        alt="Avatar preview"
      ></cropper-image>
      <cropper-shade hidden></cropper-shade>
      <cropper-handle action="select" plain></cropper-handle>
      <cropper-selection
        initial-coverage="0.8"
        movable
        resizable
        aspect-ratio="1"
      >
        <cropper-handle action="move" theme-color="rgba(255,255,255,0.35)"></cropper-handle>
        <cropper-handle action="n-resize"></cropper-handle>
        <cropper-handle action="e-resize"></cropper-handle>
        <cropper-handle action="s-resize"></cropper-handle>
        <cropper-handle action="w-resize"></cropper-handle>
        <cropper-handle action="ne-resize"></cropper-handle>
        <cropper-handle action="nw-resize"></cropper-handle>
        <cropper-handle action="se-resize"></cropper-handle>
        <cropper-handle action="sw-resize"></cropper-handle>
      </cropper-selection>
    </cropper-canvas>`
}

function initCropper() {
  if (!containerRef.value || !imgRef.value) return
  if (cropper) {
    cropper.destroy()
    cropper = null
  }
  containerRef.value.innerHTML = ''
  containerRef.value.appendChild(imgRef.value)

  cropper = new Cropper(imgRef.value, cropperOptions)
}

watch(() => props.visible, (val) => {
  if (val && props.file) {
    if (objectUrl.value) {
      URL.revokeObjectURL(objectUrl.value)
    }
    objectUrl.value = URL.createObjectURL(props.file)

    const img = document.createElement('img')
    img.src = objectUrl.value
    img.alt = 'Avatar preview'
    img.style.display = 'none'
    imgRef.value = img

    document.body.appendChild(img)
    img.onload = () => {
      document.body.removeChild(img)
      nextTick(() => {
        initCropper()
      })
    }
  } else {
    if (cropper) {
      cropper.destroy()
      cropper = null
    }
    if (containerRef.value) {
      containerRef.value.innerHTML = ''
    }
    if (objectUrl.value) {
      URL.revokeObjectURL(objectUrl.value)
      objectUrl.value = ''
    }
  }
})

onUnmounted(() => {
  if (cropper) {
    cropper.destroy()
    cropper = null
  }
  if (objectUrl.value) {
    URL.revokeObjectURL(objectUrl.value)
    objectUrl.value = ''
  }
})

function rotateLeft() {
  cropper?.getCropperImage()?.$rotate(-Math.PI / 2)
}

function rotateRight() {
  cropper?.getCropperImage()?.$rotate(Math.PI / 2)
}

function zoomIn() {
  cropper?.getCropperImage()?.$zoom(0.1)
}

function zoomOut() {
  cropper?.getCropperImage()?.$zoom(-0.1)
}

function flipHorizontal() {
  const image = cropper?.getCropperImage()
  if (!image) return
  image.$scale(-1, 1)
}

function flipVertical() {
  const image = cropper?.getCropperImage()
  if (!image) return
  image.$scale(1, -1)
}

function handleReset() {
  cropper?.getCropperImage()?.$resetTransform()
  cropper?.getCropperSelection()?.$reset()
}

async function handleConfirm() {
  if (!cropper) return
  const canvas = await cropper.getCropperSelection()?.$toCanvas({ width: 256, height: 256 })
  if (!canvas) return
  canvas.toBlob((blob) => {
    if (!blob) return
    const file = new File([blob], 'avatar.png', { type: 'image/png' })
    emit('cropped', file)
  }, 'image/png')
}
</script>

<style scoped>
.cropper-overlay {
  position: fixed;
  inset: 0;
  z-index: 400;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(15, 23, 42, 0.5);
  backdrop-filter: blur(4px);
  padding: 20px;
}

.cropper-panel {
  width: 100%;
  max-width: 520px;
  max-height: 90vh;
  overflow-y: auto;
  overscroll-behavior: contain;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  box-shadow: 0 24px 48px rgba(0, 0, 0, 0.18);
  display: flex;
  flex-direction: column;
}

.cropper-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--color-border);
}

.cropper-head h2 {
  font-size: 1.05rem;
  font-weight: 700;
}

.modal-close {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  font-size: 1.3rem;
  color: var(--color-muted);
  border-radius: 6px;
  cursor: pointer;
}

.modal-close:hover {
  background: var(--color-bg);
  color: var(--color-text);
}

.cropper-body {
  display: flex;
  flex-direction: column;
}

.cropper-area {
  min-height: 360px;
  max-height: 440px;
}

.cropper-area :deep(img) {
  display: block;
  max-width: 100%;
  max-height: 440px;
}

.cropper-toolbar {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px 20px;
  border-top: 1px solid var(--color-border);
  border-bottom: 1px solid var(--color-border);
}

.cropper-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  padding: 16px 20px;
}

.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.25s ease;
}

.modal-enter-active .cropper-panel,
.modal-leave-active .cropper-panel {
  transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-from .cropper-panel {
  transform: scale(0.95) translateY(8px);
}

.modal-leave-to .cropper-panel {
  transform: scale(0.95) translateY(8px);
}

@media (max-width: 560px) {
  .cropper-panel {
    max-width: 100%;
    border-radius: 12px 12px 0 0;
    max-height: 85vh;
  }

  .cropper-overlay {
    align-items: flex-end;
    padding: 0;
  }

  .cropper-area {
    min-height: 280px;
    max-height: 340px;
  }

  .cropper-area :deep(img) {
    max-height: 340px;
  }

  .cropper-footer {
    flex-direction: column;
  }

  .cropper-footer .btn {
    width: 100%;
  }
}
</style>
