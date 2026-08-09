# TestPapers Frontend

> Version: 0.1.0 (Nuxt 4.4 / Vue 3.5)  
> Dependency source: `package.json`  
> Last updated: 2026-08-02

Nuxt 4 frontend for creating, managing, generating, previewing, collaboratively drafting, and exporting test papers. It integrates with the FastAPI backend through cookie-based authentication, CSRF-protected mutations, realtime WebSocket updates, LaTeX rendering, cloud shared drafts, and DOCX export controls.

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
      CloudDraftPanel.vue
      DraftCommentsDrawer.vue
      ExamDraftPanel.vue
      LatexRenderer.vue
      PaperBuilderPanel.vue
      PaperExportPanel.vue
      PaperGenerationForm.vue
      PaperLivePreview.vue
      QuestionBankPanel.vue
      QuestionCardList.vue
      QuestionWorkspace.vue
      UserDropdown.vue
      WorkspaceEditorToolbar.vue
      WorkspaceHeading.vue
      WorkspaceSectionTabs.vue
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
      useSharedDrafts.ts
      useTheme.ts
      useWorkspaceDraft.ts
    domain/
      drafts/
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
      draft.ts
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
    adr/
      0001-platform-repository-and-runtime-boundaries.md
      0002-local-cloud-domain-model-and-ownership.md
    data-model/
      domain-model.json
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

## Shared four-repository toolchain matrix

| Repository | Current pinned toolchain | Lock / ownership boundary |
| --- | --- | --- |
| TestPapers Web | Node.js 24.x in CI | `package-lock.json`; `npm run verify` is the repository gate. |
| TestPaper Backend | CPython 3.13 in CI | `uv.lock`; `python scripts/check.py` is the repository gate. |
| TestPapers Desktop | Rust 1.94.1 in contract CI; Java 21 in CI | `Cargo.lock` pins the generated client; Python is repository-validation tooling only; the Tauri runtime is deferred to CLE-23. |
| TestPapers Mobile | Dart 3.12.2 in contract CI; Java 21 in CI | `pubspec.lock` pins the generated client; Python is repository-validation tooling only; the Flutter runtime is deferred to CLE-35. |

Each repository starts and verifies independently; no command relies on a sibling checkout or relative source dependency.

Additional checks:

```bash
npm run check:auth-ssr-state
npm run check:csp-hardening
npm run check:data-model
npm run check:paper-domain
npm run check:shared-drafts
node scripts/check-paper-persistence-flow.mjs
npm run check:realtime-backoff
npm run check:dependencies
npm run smoke:workspace
npm run e2e:fullstack
```

`npm run check` runs the data-model contract, SSR auth, CSP, paper domain, shared draft, paper persistence, realtime backoff, and Nuxt build checks. `npm run verify` is the fast frontend gate. `npm run verify:ci` adds a high-severity production-dependency audit and the required Playwright journey against real Nuxt, FastAPI, PostgreSQL, WebSocket, and DOCX behavior.

The full-stack test pins its public Backend runtime in `e2e/backend.lock.json`; CI checks out that exact commit into temporary runner storage, never as a source dependency. For a local run, start the locked Backend on `127.0.0.1:8001` with its test PostgreSQL database migrated and the documented `e2e-admin` account bootstrapped, then run `npm run e2e:fullstack`. `npm run smoke:workspace` remains an optional deterministic browser diagnostic with intercepted API responses.

## Runtime Configuration

Copy [`.env.example`](.env.example) to `.env` for local use. It contains no
credentials or other secrets. `TESTPAPERS_ENV` is a strict profile selector:
`local`, `development`, `test`, `staging`, or `production`.

| Profile | Endpoint requirements |
| --- | --- |
| `local`, `development` | Safe defaults: public `/api/v1`, internal `http://127.0.0.1:8000/api/v1`. |
| `test` | Set both `NUXT_API_BASE` and `NUXT_PUBLIC_API_BASE` explicitly. |
| `staging`, `production` | Set both endpoints explicitly. The public endpoint may be same-origin `/api/v1` or an HTTPS URL; direct browser and WebSocket endpoints, when used, must be HTTPS and WSS. |

`NUXT_API_BASE` is the canonical server-to-server endpoint. `NUXT_SERVER_API_BASE`
is retained only as a legacy fallback; do not set both to different values. All
configured URLs reject embedded credentials, query strings, and fragments.

| Command | Uses | Intended gate |
| --- | --- | --- |
| `npm run check:runtime-config` | Five-profile configuration contract and negative cases | Fast configuration validation |
| `npm run check` | Runtime config plus static/domain checks and production build | Required local integration gate |
| `npm run verify` | Contract lock, lint, typecheck, and `check` | Fast frontend gate |
| `npm run check:dependencies` | Production dependency audit at high severity | Required security gate |
| `npm run smoke:workspace` | Chrome/CDP workspace journey with deterministic API interception | Optional fast browser diagnostic |
| `npm run e2e:fullstack` | Playwright auth, question, paper, collaboration, WebSocket, review, and DOCX journey against the real Cloud stack | Required E2E gate |
| `npm run verify:ci` | Fast gate, production dependency audit, and real full-stack regression | Complete CI-equivalent gate after the Backend test runtime is ready |

For production, prefer the same-origin Nginx layout:

- Keep `NUXT_PUBLIC_API_BASE=/api/v1`.
- Set `NUXT_API_BASE` to the private backend URL.
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
- Cloud shared drafts for collaborative paper workspace state, collaborator management, review statuses, comments, and DOCX download from the shared draft state.

Shared drafts are saved through `/api/v1/drafts` and keep the current workspace state separate from persisted papers. A cloud draft download uses the draft's stored question snapshots, export mode, layout density, and answer-export setting, so temporary question edits in the collaborative draft appear in the downloaded DOCX without creating or updating a saved paper.

The workspace shows stale cloud revisions, unsaved cloud-draft changes, open review comments, answer-permission omissions, and the last effective DOCX layout before export. Draft approval stays unavailable until open comments are resolved.

### Realtime Updates

- WebSocket connection managed by `useRealtime.ts`.
- Auth via HttpOnly Cookie or Bearer token; tokens are not accepted in URLs.
- Heartbeat ping/pong and exponential backoff reconnection.
- Broadcast events include question and paper create/update/delete/order changes plus shared draft update, delete, comment, review, collaborator, and presence changes. Every server event includes `eventId` and `occurredAt`; clients ignore replayed event IDs.
- When a cloud draft is active, clients send `draft.subscribe`/`draft.unsubscribe` and `draft.presence.update` messages. The server replies with `draft.presence.snapshot` and broadcasts `draft.collaborators.updated` when membership changes.
- Presence is Redis-backed and shared across API instances: clients renew it every 15 seconds and it expires after 45 seconds. If Redis is unavailable, the UI identifies reconnecting state and the service exposes instance-local presence only until recovery.
- Remote draft content is applied automatically only when the workspace has no local changes. A stale local workspace remains intact and offers Load Latest or Save as New after `409 DRAFT_REVISION_CONFLICT`; comments and collaborator events update metadata without replacing local content.

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

`app/composables/useSharedDrafts.ts` manages:

- Listing, creating, loading, saving, deleting, and downloading cloud drafts.
- Collaborator add/update/remove flows for `viewer` and `editor` draft roles.
- Draft comments, question-level comment counts, and role-aware review status changes.
- `409 DRAFT_REVISION_CONFLICT` detection through `baseRevision` optimistic locking.

For the full backend contract, see [docs/api-spec.md](docs/api-spec.md).

The cross-platform repository strategy, runtime ownership, and dependency rules are defined in [ADR-0001](docs/adr/0001-platform-repository-and-runtime-boundaries.md).

The canonical local/cloud field dictionary, stable-ID rules, ownership matrix, and lifecycle/conflict invariants are defined in [ADR-0002](docs/adr/0002-local-cloud-domain-model-and-ownership.md) and the checked [domain-model contract](docs/data-model/domain-model.json).

## Backend Contract Summary

All application APIs are under `/api/v1`. Important backend surfaces:

| Module | Prefix | Description |
| --- | --- | --- |
| Auth | `/api/v1/auth` | Login, register, refresh, logout, current user, profile, password, avatar, account deletion |
| Users | `/api/v1/users` | Admin-only user management |
| Questions | `/api/v1/questions` | Search, CRUD, personal bank, revisions, corrections |
| Papers | `/api/v1/papers` | Manual paper creation, generation, question add/remove/reorder/replace, export preview, DOCX download |
| Drafts | `/api/v1/drafts` | Cloud shared paper drafts, collaborators, comments, review status, DOCX download |
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
- Run the backend July 2 migration before enabling collaborative drafts; the frontend expects the `/api/v1/drafts` routes and the `paper_drafts`, `paper_draft_collaborators`, and `paper_draft_comments` tables.
