<template>
  <div class="user-dropdown" ref="dropdownRef">
    <button
      class="user-dropdown-trigger"
      type="button"
      :aria-expanded="isOpen"
      :aria-label="'User menu for ' + (user?.displayName || user?.username)"
      aria-haspopup="true"
      @click.stop="toggle"
    >
      <span class="user-avatar" v-if="user?.avatarUrl">
        <img :src="user.avatarUrl" alt="" width="32" height="32" />
      </span>
      <span class="user-avatar user-avatar--placeholder" v-else>
        {{ initial }}
      </span>
      <span class="user-name">{{ user?.displayName || user?.username }}</span>
      <span class="dropdown-arrow" :class="{ 'is-open': isOpen }">▾</span>
    </button>

    <Transition name="dropdown">
      <div class="user-dropdown-panel" v-if="isOpen" @click.stop>
        <div class="dropdown-header">
          <span class="user-avatar user-avatar--lg" v-if="user?.avatarUrl">
            <img :src="user.avatarUrl" alt="" width="48" height="48" />
          </span>
          <span class="user-avatar user-avatar--lg user-avatar--placeholder" v-else>
            {{ initial }}
          </span>
          <div class="dropdown-user-info">
            <span class="dropdown-display-name">{{ user?.displayName }}</span>
            <span class="dropdown-username">@{{ user?.username }}</span>
          </div>
        </div>
        <div class="dropdown-divider"></div>
        <NuxtLink to="/account" class="dropdown-item" @click="close">
          <span class="dropdown-item-icon" aria-hidden="true">⚙</span>
          Account Settings
        </NuxtLink>
        <div class="dropdown-divider"></div>
        <button class="dropdown-item dropdown-item--danger" type="button" @click="handleLogout">
          <span class="dropdown-item-icon" aria-hidden="true">↩</span>
          Logout
        </button>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
const { user, logout } = useAuth()
const isOpen = ref(false)
const dropdownRef = ref<HTMLElement | null>(null)

const initial = computed(() => {
  const name = user.value?.displayName || user.value?.username || '?'
  return name.charAt(0).toUpperCase()
})

function toggle () {
  isOpen.value = !isOpen.value
}

function close () {
  isOpen.value = false
}

async function handleLogout () {
  close()
  await logout()
}

function handleClickOutside (event: MouseEvent) {
  if (dropdownRef.value && !dropdownRef.value.contains(event.target as Node)) {
    close()
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<style scoped>
.user-dropdown {
  position: relative;
}

.user-dropdown-trigger {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 4px 12px 4px 4px;
  border: 1px solid var(--color-border);
  border-radius: 999px;
  background: var(--color-surface);
  color: var(--color-text);
  font-size: .9rem;
  font-weight: 500;
  cursor: pointer;
  transition: border-color 0.25s ease, box-shadow 0.25s ease;
}

.user-dropdown-trigger:hover {
  border-color: var(--color-primary);
  box-shadow: 0 2px 8px rgba(79, 110, 247, 0.15);
}

.user-dropdown-trigger:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

.user-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  overflow: hidden;
  flex-shrink: 0;
}

.user-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.user-avatar--placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-primary);
  color: #fff;
  font-weight: 700;
  font-size: .9rem;
}

.user-avatar--lg {
  width: 48px;
  height: 48px;
  font-size: 1.25rem;
}

.user-name {
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dropdown-arrow {
  font-size: .7rem;
  transition: transform 0.2s ease;
  color: var(--color-muted);
}

.dropdown-arrow.is-open {
  transform: rotate(180deg);
}

.user-dropdown-panel {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  min-width: 240px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.12);
  padding: 8px;
  z-index: 150;
  overscroll-behavior: contain;
}

.dropdown-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px;
}

.dropdown-user-info {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.dropdown-display-name {
  font-weight: 600;
  font-size: .95rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dropdown-username {
  font-size: .8rem;
  color: var(--color-muted);
}

.dropdown-divider {
  height: 1px;
  background: var(--color-border);
  margin: 4px 0;
}

.dropdown-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 10px 12px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--color-text);
  font-size: .9rem;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s ease;
  text-decoration: none;
}

.dropdown-item:hover {
  background: var(--color-bg);
}

.dropdown-item:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: -2px;
}

.dropdown-item--danger {
  color: var(--color-danger);
}

.dropdown-item--danger:hover {
  background: rgba(239, 68, 68, 0.08);
}

.dropdown-item-icon {
  font-size: 1rem;
  width: 20px;
  text-align: center;
}

.dropdown-enter-active,
.dropdown-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.dropdown-enter-from,
.dropdown-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

[data-theme="dark"] .user-dropdown-panel {
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.4);
}
</style>
