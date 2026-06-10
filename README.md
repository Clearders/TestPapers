# TestPapers Frontend

Nuxt 4 frontend for creating, managing, generating, and exporting test papers with live LaTeX rendering.

## Tech Stack

| Technology | Purpose |
|---|---|
| Nuxt 4.3 | Vue 3 framework with SSR/SSG support |
| Vue 3.5 | UI framework |
| Vue Router 4 | Client-side routing |
| KaTeX 0.16 | Real-time LaTeX math formula rendering |
| TypeScript | Type safety throughout the codebase |
| PM2 | Production process manager |

## Project Structure

```text
TestPapers/
  app/
    app.vue                     # Root component
    components/
      LatexRenderer.vue         # KaTeX-based LaTeX rendering component
      QuestionWorkspace.vue     # Main question bank workspace
      questions/                # Question-specific UI building blocks
    composables/
      useApi.ts                 # API client with auto token refresh and CSRF
      useAuth.ts                # Authentication state management
      useQuestionBank.ts        # Question CRUD and search state
      useRealtime.ts            # WebSocket connection lifecycle
      useLatexParts.ts          # LaTeX content splitting utilities
    domain/
      questions/                # Question constants, guards, and normalization
    layouts/
      default.vue               # Default page layout
    middleware/                  # Route middleware (auth, localization)
    pages/
      index.vue                 # Home / landing page
      login.vue                 # User login
      register.vue              # User registration
      questions.vue             # Question browser and workspace
      add-problem.vue           # Create new question
      latex.vue                 # LaTeX editor
      users.vue                 # User management (admin only)
    plugins/                    # Nuxt plugins
    types/                      # Shared TypeScript API/domain types
    utils/                      # Cross-domain utility helpers
  server/
    middleware/                  # Server-side middleware
  shared/                       # Shared runtime helpers
  docs/
    api-spec.md                 # Full API specification
    nginx-deployment.md         # Nginx deployment guide
  scripts/
    run-nuxi.mjs                # Nuxt CLI wrapper
  nuxt.config.ts                # Nuxt configuration
  package.json
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

When `NUXT_PUBLIC_API_BASE` is a relative path (starting with `/`), Nuxt proxies matching API routes to the server API base configured in `nuxt.config.ts`.

## Feature Areas

### Authentication
- Login, registration, session restore, and logout
- HttpOnly Cookie-based session management — no JavaScript token storage
- Auto token refresh on `401 TOKEN_EXPIRED` via `useApi.ts`
- CSRF protection — `X-CSRF-Token` header automatically added for mutation requests

### Question Bank
- Full-text search across question text, subject, answer, tags, and options
- Multi-condition filtering: subject, difficulty, type, tags, LaTeX presence, owner
- Paginated browsing with configurable sort
- Personal question bank (`/mine`) for viewing own questions
- LaTeX formula rendering in real-time via KaTeX
- Image upload (Base64 PNG) for question illustrations

### Paper Workspace
- Manual paper creation with question selection, ordering, and mark assignment
- Genetic algorithm auto paper generation with difficulty coefficient, tag filtering
- Export preview (JSON) with paper-order or categorized question ordering
- DOCX download with LaTeX formula rendering in Word documents

### User Management
- Admin-only user CRUD lifecycle
- Role assignment (admin / teacher / viewer)
- Account activation/deactivation

### Realtime Updates
- WebSocket connection managed by `useRealtime.ts`
- Receives broadcast events for question and paper changes
- Events: `question.created`, `question.updated`, `question.deleted`, `paper.created`, `paper.updated`, etc.

## API Integration

The `useApi.ts` composable provides the API client layer. Key behaviors:

- Automatically forwards HttpOnly `testpapers_session` Cookie with `credentials: 'include'`
- On `401 TOKEN_EXPIRED`, automatically calls `POST /api/v1/auth/refresh` and retries the original request
- On `401 INVALID_TOKEN` or failed refresh, clears auth state and redirects to login
- Adds `X-CSRF-Token` header from the `testpapers_csrf` Cookie for POST/PATCH/PUT/DELETE requests
- SSR support: forwards client cookies via `useRequestHeaders(['cookie'])`

For the complete API reference, see [docs/api-spec.md](docs/api-spec.md).
