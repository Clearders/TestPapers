# syntax=docker/dockerfile:1.7
# Multi-stage Dockerfile for the TestPapers Nuxt 4 / Vue 3 web frontend.
#
# Targets:
#   development  - Nuxt dev server with hot reload (npm run dev). Supports a
#                  bind mount of the host source for fast iteration; the image
#                  is also runnable standalone.
#   runtime      - immutable production build served by the Nitro node server.
#
# Both targets share the `deps` stage so the dev and release build paths stay
# aligned instead of drifting into two independent dependency installations.

FROM node:24-slim AS base
ENV NUXT_TELEMETRY_DISABLED=1 \
    NO_COLOR=1
WORKDIR /app

# ---- deps: install locked dependencies once, reused by dev and build ----
FROM base AS deps
# The root package's postinstall runs `nuxt prepare`, which needs the full
# source tree that is not present in this stage. Skip all lifecycle scripts
# here: native binaries (e.g. esbuild) come from optionalDependencies and
# `nuxi build`/`nuxi dev` run prepare themselves.
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

# ---- development: Nuxt dev server with hot reload ----
FROM base AS development
ENV NODE_ENV=development
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN chown -R node:node /app
USER node
EXPOSE 3000
HEALTHCHECK --interval=5s --timeout=3s --start-period=30s --retries=12 \
  CMD node -e "fetch('http://127.0.0.1:3000/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["npm", "run", "dev"]

# ---- build: production assets, consumed only by the runtime target ----
FROM deps AS build
ENV NODE_ENV=production
# Bake the API endpoints into the Nitro build so the released image is
# self-describing. Override via --build-arg when targeting another backend.
ARG NUXT_API_BASE=http://127.0.0.1:8000/api/v1
ARG NUXT_PUBLIC_API_BASE=/api/v1
ARG NUXT_PUBLIC_WS_BASE=
ENV NUXT_API_BASE=${NUXT_API_BASE} \
    NUXT_PUBLIC_API_BASE=${NUXT_PUBLIC_API_BASE} \
    NUXT_PUBLIC_WS_BASE=${NUXT_PUBLIC_WS_BASE}
COPY . .
RUN npm run build

# ---- runtime: immutable production output ----
FROM node:24-slim AS runtime
ENV NODE_ENV=production \
    NUXT_TELEMETRY_DISABLED=1 \
    HOST=0.0.0.0 \
    PORT=3000 \
    NITRO_HOST=0.0.0.0 \
    NITRO_PORT=3000
WORKDIR /app
COPY --from=build /app/.output ./.output
USER node
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=12 \
  CMD node -e "fetch('http://127.0.0.1:3000/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", ".output/server/index.mjs"]
