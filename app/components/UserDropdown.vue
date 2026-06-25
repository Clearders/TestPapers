<template>
  <div ref="dropdownRef" class="user-dropdown">
    <button
      class="user-dropdown-trigger"
      type="button"
      :aria-expanded="isOpen"
      :aria-label="'User menu for ' + (user?.displayName || user?.username)"
      aria-haspopup="true"
      @click.stop="toggle"
    >
      <span v-if="user?.avatarUrl" class="user-avatar">
        <img :src="user.avatarUrl" alt="" width="32" height="32" decoding="async" >
      </span>
      <span v-else class="user-avatar user-avatar--placeholder">
        {{ initial }}
      </span>
      <span class="user-name">{{ user?.displayName || user?.username }}</span>
      <AppIcon name="chevron-down" class="dropdown-arrow" :class="{ 'is-open': isOpen }" />
    </button>

    <Transition name="dropdown">
      <div v-if="isOpen" class="user-dropdown-panel" @click.stop>
        <div class="dropdown-header">
          <span v-if="user?.avatarUrl" class="user-avatar user-avatar--lg">
            <img :src="user.avatarUrl" alt="" width="48" height="48" loading="lazy" decoding="async" >
          </span>
          <span v-else class="user-avatar user-avatar--lg user-avatar--placeholder">
            {{ initial }}
          </span>
          <div class="dropdown-user-info">
            <span class="dropdown-display-name">{{ user?.displayName }}</span>
            <span class="dropdown-username">@{{ user?.username }}</span>
          </div>
        </div>
        <div class="dropdown-divider"/>
        <NuxtLink to="/account" class="dropdown-item" @click="close">
          <AppIcon name="settings" class="dropdown-item-icon" />
          Account Settings
        </NuxtLink>
        <div class="dropdown-divider"/>
        <button class="dropdown-item dropdown-item--danger" type="button" @click="handleLogout">
          <AppIcon name="logout" class="dropdown-item-icon" />
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
  padding: 4px 11px 4px 4px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-pill);
  background: var(--color-surface-raised);
  color: var(--color-text);
  font-size: .9rem;
  font-weight: 750;
  cursor: pointer;
  box-shadow: 0 8px 18px rgba(62, 40, 126, 0.08);
  transition: border-color 0.22s ease, box-shadow 0.22s ease, transform 0.22s ease;
}

.user-dropdown-trigger:hover {
  border-color: var(--color-primary);
  box-shadow: 0 12px 24px rgba(118, 87, 255, 0.16);
  transform: translateY(-1px);
}

.user-dropdown-trigger:focus-visible {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: var(--ring);
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
  background: linear-gradient(135deg, var(--color-primary), var(--color-secondary));
  color: #fff;
  font-weight: 850;
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
  width: 16px;
  height: 16px;
  transition: transform 0.2s ease;
  color: var(--color-muted);
}

.dropdown-arrow.is-open {
  transform: rotate(180deg);
}

.user-dropdown-panel {
  position: absolute;
  top: calc(100% + 10px);
  right: 0;
  min-width: 250px;
  background: var(--color-surface-raised);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  padding: 8px;
  z-index: 150;
  overscroll-behavior: contain;
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
}

.dropdown-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px;
}

.dropdown-user-info {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.dropdown-display-name {
  font-weight: 850;
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
  border-radius: var(--radius);
  background: transparent;
  color: var(--color-text);
  font-size: .9rem;
  font-weight: 750;
  cursor: pointer;
  transition: background 0.2s ease, transform 0.2s ease;
  text-decoration: none;
}

.dropdown-item:hover {
  background: rgba(118, 87, 255, 0.1);
  transform: translateX(2px);
}

.dropdown-item:focus-visible {
  outline: none;
  box-shadow: var(--ring);
}

.dropdown-item--danger {
  color: var(--color-danger);
}

.dropdown-item--danger:hover {
  background: rgba(239, 68, 68, 0.1);
}

.dropdown-item-icon {
  width: 18px;
  height: 18px;
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
</style>
