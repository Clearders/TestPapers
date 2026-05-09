import type { Permission } from './auth'

declare module '#app' {
  interface PageMeta {
    guestOnly?: boolean
    permissions?: Permission[]
    requiresAuth?: boolean
  }
}

declare module 'vue-router' {
  interface RouteMeta {
    guestOnly?: boolean
    permissions?: Permission[]
    requiresAuth?: boolean
  }
}

export {}
