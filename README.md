# TestPapers Frontend

Nuxt 4 frontend for creating, managing, generating, and exporting test papers with live LaTeX rendering.

## Project Structure

```text
TestPapers/
  app/
    app.vue
    components/
      LatexRenderer.vue
      QuestionWorkspace.vue
      questions/                # Question-specific UI building blocks
    composables/                # API, auth, realtime, and question-bank state
    domain/
      questions/                # Question constants, guards, and normalization
    layouts/
    middleware/
    pages/
    plugins/
    types/                      # Shared TypeScript API/domain types
    utils/                      # Cross-domain utility helpers
  server/
    middleware/
  shared/                       # Shared runtime helpers
  docs/
  scripts/
  nuxt.config.ts
  package.json
```

## Local Commands

```bash
npm run dev
npm run build
npm run generate
npm run preview
```

The project wraps Nuxt through `scripts/run-nuxi.mjs`, so the same scripts work even when `node_modules/.bin` is not directly available on PATH.

## Runtime Configuration

```text
NUXT_PUBLIC_API_BASE=/api/v1
NUXT_API_BASE=http://127.0.0.1:8000/api/v1
NUXT_SERVER_API_BASE=http://127.0.0.1:8000/api/v1
NUXT_PUBLIC_WS_BASE=
```

When `NUXT_PUBLIC_API_BASE` is relative, Nuxt proxies matching API routes to the server API base configured in `nuxt.config.ts`.

## Main Areas

- Authentication: login, registration, session restore, logout, and role-aware permissions
- Question bank: search, filtering, pagination, image upload, LaTeX rendering, and CRUD
- Paper workspace: manual question selection, generated papers, ordering, preview, and export
- User management: admin-only user lifecycle and role changes
- Realtime updates: WebSocket events for question and paper changes

