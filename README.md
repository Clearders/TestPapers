# TestPapers Frontend

> **版本**: 0.1.0 (Nuxt 4.4 / Vue 3.5)
> **依赖**: `package.json`
> **最后更新**: 2026-06-14

Nuxt 4 frontend for creating, managing, generating, and exporting test papers with real-time LaTeX rendering.

## Tech Stack

| Technology | Version | Purpose |
|---|---|---|
| Nuxt | ^4.4.8 | Vue 3 framework with SSR/SSG support |
| Vue | ^3.5.32 | UI framework |
| KaTeX | ^0.16.21 | Real-time LaTeX math formula rendering |
| Cropper.js | ^2.1.1 | Avatar image cropping |
| TypeScript | ^5.7.0 | Type safety throughout the codebase |
| PM2 | — | Production process manager |

## Project Structure

```text
TestPapers/
  app/
    app.vue                     # Root component
    components/
      AvatarCropper.vue         # Avatar image cropping (cropperjs)
      LatexRenderer.vue         # KaTeX-based LaTeX rendering component
      QuestionWorkspace.vue     # Main question bank workspace + paper assembly
      UserDropdown.vue          # Authenticated user menu
      questions/
        AddProblemPreview.vue   # Question creation preview
        EditQuestionModal.vue   # Question editing modal
        PaginationControls.vue  # Reusable pagination component
        QuestionBankCard.vue    # Individual question card display
        QuestionBankToolbar.vue # Filter, sort, and search toolbar
        QuestionCorrectionModal.vue  # Correction submission and review
        QuestionImageUploader.vue    # PNG image upload with preview
        QuestionRevisionHistory.vue  # Revision history viewer
    composables/
      useApi.ts                 # API client with auto token refresh and CSRF
      useAuth.ts                # Authentication state management
      useQuestionBank.ts        # Question CRUD, search, corrections, revisions
      useRealtime.ts            # WebSocket connection lifecycle (heartbeat + reconnect)
      useLatexParts.ts          # LaTeX content splitting utilities
      useTheme.ts               # Light/dark theme toggle
    domain/
      questions/                # Question constants, guards, and normalization
    layouts/
      default.vue               # Default page layout
    middleware/                  # Route middleware (auth, locale compat)
    pages/
      index.vue                 # Home / landing page
      login.vue                 # User login
      register.vue              # User registration
      account.vue               # Profile editing, password change, avatar, account deletion
      questions.vue             # Question browser and workspace
      add-problem.vue           # Create new question
      latex.vue                 # LaTeX editor
      users.vue                 # User management (admin only)
    plugins/                    # Nuxt plugins (auth session, locale compat)
    types/                      # Shared TypeScript API/domain types
      api.ts                    # ApiEnvelope, ApiPagination, PaginatedData
      auth.ts                   # AuthUser, AuthSession, payloads
      question.ts               # Question, QuestionEntity, corrections, revisions
      route-meta.d.ts           # Route metadata type augmentation
    utils/                      # Cross-domain utility helpers
      apiEndpoint.ts            # API base URL configuration and WebSocket URL builder
      format.ts                 # Date/number formatting utilities
  server/
    middleware/                  # Server-side locale compat middleware
  shared/                       # Shared runtime helpers (legacy locale)
  docs/
    api-spec.md                 # Full API specification (v7)
    nginx-deployment.md         # Nginx deployment guide
  scripts/
    run-nuxi.mjs                # Nuxt CLI wrapper
  nuxt.config.ts                # Nuxt configuration
  package.json
  tsconfig.json
```

## Local Commands

```bash
npm run dev         # Start development server
npm run build       # Build for production
npm run generate    # Static site generation
npm run preview     # Preview production build
```

The project wraps Nuxt through `scripts/run-nuxi.mjs`, so the same scripts work even when `node_modules/.bin` is not directly available on `PATH`.

## Runtime Configuration

```text
NUXT_PUBLIC_API_BASE=/api/v1
NUXT_API_BASE=http://127.0.0.1:8000/api/v1
NUXT_SERVER_API_BASE=http://127.0.0.1:8000/api/v1
NUXT_PUBLIC_WS_BASE=
```

When `NUXT_PUBLIC_API_BASE` is a relative path (starting with `/`), Nuxt proxies matching API routes to the server API base. In production behind Nginx, leave `NUXT_PUBLIC_API_BASE=/api/v1` and configure Nginx to forward `/api/v1/*` to the backend.

## Feature Areas

### Authentication
- Login, registration, session restore, and logout
- HttpOnly Cookie-based session management — no JavaScript token storage
- Auto token refresh on `401` via `useApi.ts` (with exponential backoff retry)
- CSRF protection — `X-CSRF-Token` header automatically added for mutation requests
- Role-based permissions: admin, teacher, viewer

### User Profile
- Edit username (max once per 30 days) and display name
- Change password with current password verification
- Upload avatar (PNG, max 500KB)
- Delete account (soft delete)

### Question Bank
- Full-text search across question text, subjects, answer, tags, options, and source
- Multi-condition filtering: subjects (multi-select), difficulty, type, tags, LaTeX presence, owner
- Six question types: single choice, multiple choice, true/false, blank, short answer, essay
- Paginated browsing with configurable sort
- Personal question bank (`/mine`) for viewing own questions
- LaTeX formula rendering in real-time via KaTeX
- Image upload (Base64 PNG, max 30MB) for question illustrations
- Multi-subject assignment per question

### Question Revisions and Corrections
- Automatic revision history on every question update
- Revision records with field-level change summaries
- Correction submission by any authenticated user (wrong_answer, unclear, typo, other)
- Correction status management (accept/reject) by question owner or admin
- Delete individual revisions and corrections

### Paper Workspace
- Manual paper creation with question selection, ordering, and mark assignment
- Genetic algorithm auto paper generation with:
  - Multi-type targets (multiple question types with individual counts)
  - Multi-subject candidate filtering
  - Difficulty coefficient tuning
  - Required and preferred tag filtering
  - Own questions only mode
- Detailed generation diagnostics display
- DOCX download with LaTeX rendering in Word documents
- Export mode selection: paper order or categorized by question type

### User Management
- Admin-only user CRUD lifecycle
- Role assignment (admin / teacher / viewer)
- Account activation/deactivation

### Realtime Updates
- WebSocket connection managed by `useRealtime.ts`
- Authentication via HttpOnly Cookie or Bearer token; tokens are not accepted in URLs
- Heartbeat ping/pong (25s interval)
- Exponential backoff reconnection
- Receives broadcast events for question and paper changes
- Events: `question.created`, `question.updated`, `question.deleted`, `paper.created`, `paper.updated`, etc.

### Theme
- Light/dark theme toggle persisted to `localStorage`
- System preference detection on first visit

## API Integration

The `useApi.ts` composable provides the API client layer. Key behaviors:

- Automatically forwards HttpOnly `testpapers_session` Cookie with `credentials: 'include'`
- On `401`, automatically calls `POST /api/v1/auth/refresh` and retries the original request
- On `401 INVALID_TOKEN` or failed refresh, clears auth state and redirects to login
- Adds `X-CSRF-Token` header from the `testpapers_csrf` Cookie for POST/PATCH/PUT/DELETE requests
- SSR support: forwards client cookies via `useRequestHeaders(['cookie'])`
- Blob download support using native `fetch` API
- Configurable timeout (default 15s)
- GET requests retry once on network/server errors (408/429/500/502/503/504)

For the complete API reference, see [docs/api-spec.md](docs/api-spec.md).

## Production Deployment

See [docs/nginx-deployment.md](docs/nginx-deployment.md) for the recommended Nginx reverse-proxy setup. Key points:

- The Nuxt server does **not** proxy API requests in production on its own
- Place Nginx in front of both frontend (port 3000) and backend (port 8000)
- Set `NUXT_PUBLIC_API_BASE=/api/v1` for same-origin requests through Nginx
- Set `AUTH_COOKIE_SECURE=true` for HTTPS deployments
