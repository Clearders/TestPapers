<template>
  <svg
    class="app-icon"
    :class="`app-icon--${name}`"
    viewBox="0 0 24 24"
    fill="none"
    aria-hidden="true"
  >
    <path
      v-for="(path, index) in iconPaths"
      :key="index"
      :d="path"
      stroke="currentColor"
      stroke-width="1.8"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
  </svg>
</template>

<script setup lang="ts">
type IconName =
  | 'account'
  | 'add'
  | 'arrow-down'
  | 'arrow-left'
  | 'arrow-right'
  | 'arrow-up'
  | 'book'
  | 'check'
  | 'chevron-down'
  | 'download'
  | 'edit'
  | 'eye'
  | 'filter'
  | 'home'
  | 'image'
  | 'latex'
  | 'login'
  | 'logout'
  | 'moon'
  | 'paper'
  | 'palette'
  | 'search'
  | 'settings'
  | 'sparkles'
  | 'sun'
  | 'trash'
  | 'upload'
  | 'users'
  | 'x'

const props = defineProps<{
  name: IconName
}>()

const paths: Record<IconName, string[]> = {
  account: ['M20 21a8 8 0 0 0-16 0', 'M12 13a5 5 0 1 0 0-10 5 5 0 0 0 0 10Z'],
  add: ['M12 5v14', 'M5 12h14'],
  'arrow-down': ['M12 5v14', 'M19 12l-7 7-7-7'],
  'arrow-left': ['M19 12H5', 'M12 19l-7-7 7-7'],
  'arrow-right': ['M5 12h14', 'M12 5l7 7-7 7'],
  'arrow-up': ['M12 19V5', 'M5 12l7-7 7 7'],
  book: ['M4 19.5A2.5 2.5 0 0 1 6.5 17H20', 'M4 4.5A2.5 2.5 0 0 1 6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5Z'],
  check: ['M20 6 9 17l-5-5'],
  'chevron-down': ['M6 9l6 6 6-6'],
  download: ['M12 3v12', 'M7 10l5 5 5-5', 'M5 21h14'],
  edit: ['M12 20h9', 'M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5Z'],
  eye: ['M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z', 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z'],
  filter: ['M3 5h18', 'M6 12h12', 'M10 19h4'],
  home: ['M3 11.5 12 4l9 7.5', 'M5 10v10h14V10'],
  image: ['M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z', 'M8.5 9a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z', 'M21 16l-5-5L5 21'],
  latex: ['M6 4h8', 'M13 4 7 20', 'M17 8v8', 'M21 10l-4 2 4 2'],
  login: ['M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4', 'M10 17l5-5-5-5', 'M15 12H3'],
  logout: ['M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4', 'M16 17l5-5-5-5', 'M21 12H9'],
  moon: ['M21 13.5A8.5 8.5 0 0 1 10.5 3 7 7 0 1 0 21 13.5Z'],
  paper: ['M6 2h8l4 4v16H6V2Z', 'M14 2v5h5', 'M9 13h6', 'M9 17h6'],
  palette: ['M12 3a9 9 0 0 0 0 18h1.5a1.5 1.5 0 0 0 .7-2.8 1.8 1.8 0 0 1 1-3.2H17a4 4 0 0 0 4-4c0-4.4-4-8-9-8Z', 'M7.5 10h.01', 'M10 7h.01', 'M14 7.5h.01'],
  search: ['M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16Z', 'M21 21l-4.3-4.3'],
  settings: ['M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z', 'M19.4 15a1.8 1.8 0 0 0 .36 2l.04.04a2.1 2.1 0 0 1-3 3l-.04-.04a1.8 1.8 0 0 0-2-.36 1.8 1.8 0 0 0-1.1 1.66V21a2.1 2.1 0 0 1-4.2 0v-.06A1.8 1.8 0 0 0 8.4 19.3a1.8 1.8 0 0 0-2 .36l-.04.04a2.1 2.1 0 0 1-3-3l.04-.04a1.8 1.8 0 0 0 .36-2A1.8 1.8 0 0 0 2.1 13H2a2.1 2.1 0 0 1 0-4.2h.06A1.8 1.8 0 0 0 3.7 7.7a1.8 1.8 0 0 0-.36-2l-.04-.04a2.1 2.1 0 0 1 3-3l.04.04a1.8 1.8 0 0 0 2 .36A1.8 1.8 0 0 0 9.5 1.4V1a2.1 2.1 0 0 1 4.2 0v.06A1.8 1.8 0 0 0 14.8 2.7a1.8 1.8 0 0 0 2-.36l.04-.04a2.1 2.1 0 0 1 3 3l-.04.04a1.8 1.8 0 0 0-.36 2A1.8 1.8 0 0 0 21.1 8.5H21a2.1 2.1 0 0 1 0 4.2h-.06A1.8 1.8 0 0 0 19.4 15Z'],
  sparkles: ['M12 3l1.7 4.3L18 9l-4.3 1.7L12 15l-1.7-4.3L6 9l4.3-1.7L12 3Z', 'M5 15l.8 2.2L8 18l-2.2.8L5 21l-.8-2.2L2 18l2.2-.8L5 15Z', 'M19 14l.8 2.2L22 17l-2.2.8L19 20l-.8-2.2L16 17l2.2-.8L19 14Z'],
  sun: ['M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z', 'M12 2v2', 'M12 20v2', 'M4.93 4.93l1.41 1.41', 'M17.66 17.66l1.41 1.41', 'M2 12h2', 'M20 12h2', 'M4.93 19.07l1.41-1.41', 'M17.66 6.34l1.41-1.41'],
  trash: ['M3 6h18', 'M8 6V4h8v2', 'M6 6l1 16h10l1-16', 'M10 11v6', 'M14 11v6'],
  upload: ['M12 15V3', 'M7 8l5-5 5 5', 'M5 21h14'],
  users: ['M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2', 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z', 'M22 21v-2a4 4 0 0 0-3-3.9', 'M16 3.1a4 4 0 0 1 0 7.8'],
  x: ['M18 6 6 18', 'M6 6l12 12']
}

const iconPaths = computed(() => paths[props.name])
</script>

<style scoped>
.app-icon {
  width: 1em;
  height: 1em;
  flex: 0 0 auto;
}
</style>
