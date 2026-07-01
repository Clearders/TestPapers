# TestPapers Frontend

> Version: 0.1.0 (Nuxt 4.4 / Vue 3.5)  
> Dependency source: `package.json`  
> Last updated: 2026-06-28

Nuxt 4 frontend for creating, managing, generating, previewing, and exporting test papers. It integrates with the FastAPI backend through cookie-based authentication, CSRF-protected mutations, realtime WebSocket updates, LaTeX rendering, and DOCX export controls.

## Tech Stack

| Technology | Version | Purpose |
| --- | --- | --- |
| Nuxt | `^4.4.8` | Vue framework with SSR/SSG support |
| Vue | `^3.5.32` | UI framework |
| Vue Router | `^4.5.1` | Routing |
| Nuxt Security | `2.5.1` | Security headers and CSP support |
| KaTeX | `^0.16.21` | Realtime LaTeX math rendering |
| Cropper.js | `^2.1.1` | Avatar image cropping |
| TypeScript | `^5.7.0` | Type safety |
| ESLint | `^10.5.0` | Linting |
| PM2 | external | Production process manager |

## Project Structure

```text
TestPapers/
  app/
    app.vue
    assets/css/main.css
    components/
      AppIcon.vue
      AvatarCropper.vue
      LatexRenderer.vue
      PaperBuilderPanel.vue
      PaperExportPanel.vue
      PaperGenerationForm.vue
      PaperLivePreview.vue
      QuestionBankPanel.vue
      QuestionCardList.vue
      QuestionWorkspace.vue
      UserDropdown.vue
      questions/
        AddProblemPreview.vue
        EditQuestionModal.vue
        PaginationControls.vue
        QuestionBankCard.vue
        QuestionBankToolbar.vue
        QuestionCorrectionModal.vue
        QuestionDetailModal.vue
        QuestionImageUploader.vue
        QuestionImportModal.vue
        QuestionRevisionHistory.vue
    composables/
      useApi.ts
      useAuth.ts
      useAuthForm.ts
      useLatexParts.ts
      usePaperExport.ts
      useQuestionBank.ts
      useRealtime.ts
      useTheme.ts
      useWorkspaceDraft.ts
    domain/
      papers/
      questions/
    layouts/default.vue
    middleware/
      00.locale-compat.global.ts
      auth.global.ts
    pages/
      account.vue
      add-problem.vue
      index.vue
      latex.vue
      login.vue
      questions.vue
      register.vue
      users.vue
    plugins/
      auth-session.client.ts
      locale-compat.client.ts
    types/
      api.ts
      auth.ts
      generation.ts
      index.ts
      question.ts
      route-meta.d.ts
    utils/
      apiEndpoint.ts
      apiError.ts
      authStateKeys.ts
      fileData.ts
      format.ts
      realtimeBackoff.ts
  docs/
    api-spec.md
    nginx-deployment.md
  public/
  scripts/
  server/middleware/
  shared/
```

## Local Commands

```bash
npm install
npm run dev
npm run build
npm run preview
npm run lint
npm run typecheck
npm run check
npm run verify
```

The Nuxt commands run through `scripts/run-nuxi.mjs`, so they work even when `node_modules/.bin` is not directly on `PATH`.

Additional checks:

```bash
npm run check:auth-ssr-state
npm run check:csp-hardening
npm run check:paper-domain
npm run check:realtime-backoff
npm run smoke:workspace
```

## Runtime Configuration

```text
NUXT_PUBLIC_API_BASE=/api/v1
NUXT_PUBLIC_DIRECT_API_BASE=
NUXT_API_BASE=http://127.0.0.1:8000/api/v1
NUXT_SERVER_API_BASE=http://127.0.0.1:8000/api/v1
NUXT_PUBLIC_WS_BASE=
```

For production, prefer the same-origin Nginx layout:

- Keep `NUXT_PUBLIC_API_BASE=/api/v1`.
- Set `NUXT_API_BASE` and `NUXT_SERVER_API_BASE` to the private backend URL.
- Proxy `/api/v1/*` and `/api/v1/ws` from Nginx to FastAPI.
- Set `NUXT_PUBLIC_DIRECT_API_BASE` only when browsers should call a public backend origin directly and CORS/Cookies are configured for that origin.

## Feature Areas

### Authentication

- Login, registration, session restore, refresh, and logout.
- HttpOnly `testpapers_session` Cookie; no JavaScript token storage.
- CSRF protection with `testpapers_csrf` Cookie and `X-CSRF-Token` header for mutation requests.
- Automatic refresh on `401` through `POST /api/v1/auth/refresh`.
- Role-aware UI for `admin`, `teacher`, and `viewer`.

### User Profile

- Edit username and display name.
- Username changes are limited by the backend to once every 30 days.
- Change password after current password verification.
- Upload cropped PNG avatar.
- Delete account through backend soft deletion.

### Question Bank

- Full-text search across question fields.
- Filters for subjects, difficulty, type, tags, LaTeX usage, owner, and personal question bank.
- Supported types: single choice, multiple choice, true/false, blank, short answer, and essay.
- Realtime LaTeX formula rendering with KaTeX.
- PNG question image upload and preview.
- Revision history and correction workflow.

### Paper Workspace

- Manual paper assembly with selected questions, ordering, and marks.
- Genetic algorithm paper generation with multi-type targets, multi-subject filtering, difficulty coefficient, required/preferred tags, and own-questions-only mode.
- Live paper preview and export preview.
- DOCX download with question images, Word-compatible math, answer visibility controls, question ordering mode, and layout density controls.

### Realtime Updates

- WebSocket connection managed by `useRealtime.ts`.
- Auth via HttpOnly Cookie or Bearer token; tokens are not accepted in URLs.
- Heartbeat ping/pong and exponential backoff reconnection.
- Broadcast events include question and paper create/update/delete/order changes.

### Theme

- Light/dark theme toggle persisted to Cookie.
- System preference detection before app mount to avoid theme flash.
- Theme-aware `<meta name="theme-color">`.

## API Integration

`app/composables/useApi.ts` is the central API client. It:

- Sends browser credentials with `credentials: 'include'`.
- Forwards SSR request Cookies with `useRequestHeaders(['cookie'])`.
- Adds `X-CSRF-Token` for `POST`, `PATCH`, `PUT`, and `DELETE`.
- Refreshes the session and retries once after recoverable `401` responses.
- Clears auth state on invalid tokens or failed refresh.
- Supports blob downloads with native `fetch`.
- Applies request timeout handling and limited GET retries for transient failures.

`app/composables/useAuth.ts` wraps session and profile flows:

- `login`, `register`, `logout`, `loadSession`, `refreshSession`.
- `updateProfile`, `changePassword`, `uploadAvatar`, `deleteAccount`.
- Reactive `user`, `isAuthenticated`, and `isAuthReady`.
- `hasPermission(permission)` for UI permission checks.

`app/composables/useRealtime.ts` manages:

- Connect/disconnect based on auth state.
- Heartbeat and reconnect lifecycle.
- Event subscription through `on(event, handler)`.

For the full backend contract, see [docs/api-spec.md](docs/api-spec.md).

## Backend Contract Summary

All application APIs are under `/api/v1`. Important backend surfaces:

| Module | Prefix | Description |
| --- | --- | --- |
| Auth | `/api/v1/auth` | Login, register, refresh, logout, current user, profile, password, avatar, account deletion |
| Users | `/api/v1/users` | Admin-only user management |
| Questions | `/api/v1/questions` | Search, CRUD, personal bank, revisions, corrections |
| Papers | `/api/v1/papers` | Manual paper creation, generation, question ordering, export preview, DOCX download |
| Images | `/api/v1/images` | PNG question image upload |
| Meta | `/api/v1/meta` | Subject and tag metadata |
| Tasks | `/api/v1/tasks` | Celery task dispatch and polling |
| Realtime | `/api/v1/ws` | Authenticated WebSocket events |
| Health | `/api/v1/health` | PostgreSQL and Redis health checks |

## Production Deployment

See [docs/nginx-deployment.md](docs/nginx-deployment.md) for the frontend reverse-proxy setup and [../DEPLOYMENT-debian-production.md](../DEPLOYMENT-debian-production.md) for the full Debian deployment guide.

Key production requirements:

- Put Nginx in front of both Nuxt and FastAPI.
- Forward `/api/v1/*` and `/api/v1/ws` to the backend.
- Keep frontend API calls same-origin where possible.
- Configure backend `CORS_ORIGINS` and `TRUSTED_HOSTS`; production rejects missing values and `*`.
- Set `AUTH_COOKIE_SECURE=true` for HTTPS deployments.
