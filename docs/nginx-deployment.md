# Same-Origin HTTPS Proxy Deployment

This frontend is compatible with a same-origin HTTPS proxy layout. Nginx and
Caddy are both supported; choose one, not both. This deployment is fully Web,
API, PostgreSQL, and Redis based: it has **no Desktop, Mobile, SQLite, or Local
Engine dependency**.

- Browser API requests use `/api/v1`.
- Browser WebSocket requests use `/api/v1/ws`.
- Nuxt server-side requests use `NUXT_API_BASE` and should point to the backend service directly.

> **Important**: In production, the Nuxt server does **not** proxy `/api/v1` requests to the backend on its own. You **must** either:
>
> 1. Place a reverse proxy (Nginx) in front of both frontend and backend (recommended — see example below), or
> 2. Set `NUXT_PUBLIC_API_BASE=https://your-backend.example.com/api/v1` to have the browser call the backend directly. Note that this requires CORS and cookie domain configuration on the backend.

## Runtime Variables

Set `TESTPAPERS_ENV=staging` or `production` and provide both required
endpoints explicitly. `NUXT_API_BASE` is canonical; `NUXT_SERVER_API_BASE` is
only a legacy fallback and must not conflict with it. Do not put credentials,
query strings, fragments, or secrets in frontend endpoint variables.

Use these values when serving the frontend behind Nginx:

```bash
TESTPAPERS_ENV=production
NUXT_PUBLIC_API_BASE=/api/v1
NUXT_API_BASE=http://127.0.0.1:8000/api/v1
NUXT_PUBLIC_WS_BASE=
NITRO_HOST=127.0.0.1
NITRO_PORT=3000
```

`local` and `development` default to `/api/v1` for browser requests and
`http://127.0.0.1:8000/api/v1` for server requests. `test`, `staging`, and
`production` require explicit `NUXT_PUBLIC_API_BASE` and `NUXT_API_BASE`.
Set `NUXT_API_BASE` when the Nuxt server needs to validate sessions during SSR
or route middleware.

Nuxt emits the frontend Content Security Policy through `nuxt-security` with
per-request SSR script nonces. In the same-origin Nginx layout, `connect-src`
is limited to `'self'`. If you intentionally use a separate browser-visible API
or WebSocket host, set the corresponding `NUXT_PUBLIC_*` variable to the exact
`https://...` or `wss://...` origin; do not add scheme-wide `ws:` or `wss:`
allowances.

Run `npm run check:runtime-config` after changing a deployment profile, then
run `npm run verify` before release. The workspace smoke test remains optional
because it needs a locally installed Chrome-compatible browser and CDP.

For HTTPS deployments, configure the backend cookie settings as well:

```bash
APP_ENV=production
CORS_ORIGINS=https://testpapers.example.com
TRUSTED_HOSTS=testpapers.example.com
AUTH_COOKIE_SECURE=true
AUTH_COOKIE_SAMESITE=lax
```

Production backend startup is fail-closed for browser origins and host headers: `CORS_ORIGINS` and `TRUSTED_HOSTS` are required, and neither setting may include `*`.

## DNS and TLS Prerequisites

Point the public DNS A/AAAA record for `testpapers.example.com` to this host,
open TCP ports 80 and 443, and run exactly one public proxy. Nginx needs a
certificate provisioned before enabling its TLS server block (for example,
Certbot). Caddy obtains and renews publicly trusted certificates automatically
when DNS and ports are available.

Keep FastAPI and Nuxt bound to loopback addresses. Do not expose ports 3000 or
8000 directly to the Internet.

## Example Nginx Server

Replace `testpapers.example.com` with your intranet hostname or server IP.

```nginx
upstream testpapers_frontend {
    server 127.0.0.1:3000;
}

upstream testpaper_backend {
    server 127.0.0.1:8000;
}

server {
    listen 80;
    server_name testpapers.example.com;

    location /.well-known/acme-challenge/ { root /var/www/certbot; }
    location / { return 301 https://$host$request_uri; }
}

server {
    listen 443 ssl http2;
    server_name testpapers.example.com;

    ssl_certificate /etc/letsencrypt/live/testpapers.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/testpapers.example.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;

    client_max_body_size 20m;

    location /api/v1/ws {
        proxy_pass http://testpaper_backend/api/v1/ws;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
    }

    location /api/v1/ {
        proxy_pass http://testpaper_backend/api/v1/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location / {
        proxy_pass http://testpapers_frontend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Test before reloading: `sudo nginx -t && sudo systemctl reload nginx`.

## Equivalent Caddy Server

Save the following as `/etc/caddy/Caddyfile`, replacing the hostname. Caddy
automatically redirects HTTP to HTTPS and provisions TLS certificates. The
`handle` blocks are ordered deliberately: WebSocket traffic must reach FastAPI
before the broader API route.

```caddyfile
testpapers.example.com {
    encode zstd gzip
    request_body {
        max_size 45MB
    }

    @websocket path /api/v1/ws
    reverse_proxy @websocket 127.0.0.1:8000 {
        transport http {
            read_timeout 1h
            write_timeout 1h
        }
    }

    @api path /api/v1/*
    reverse_proxy @api 127.0.0.1:8000

    reverse_proxy 127.0.0.1:3000
}
```

Validate and apply it with `sudo caddy validate --config /etc/caddy/Caddyfile`
followed by `sudo systemctl reload caddy`.

## Start Order

Build and start the frontend after exporting the runtime variables:

```bash
npm run build
npm start
```

Start the backend on `127.0.0.1:8000` or update the `testpaper_backend` upstream and `NUXT_API_BASE` to match your backend address.

## Why This Layout

With this proxy format, the browser talks only to the Nginx origin. Login requests go to:

```text
POST http://testpapers.example.com/api/v1/auth/login
```

Nginx forwards that request to FastAPI:

```text
POST http://127.0.0.1:8000/api/v1/auth/login
```

Because the browser sees a same-origin response, the HttpOnly login cookie is stored for the frontend hostname and is sent automatically on later `/api/v1/*` requests.

## Release, Health, and Public-Bank Smoke Checks

Use a server-first release order: back up PostgreSQL and record the current
Alembic revision; deploy the compatible backend; run `alembic upgrade head`;
verify backend health; deploy the frontend pinned to the corresponding API
contract; then run browser and public-origin checks. Do not deploy a frontend
that requires a migration before that migration is applied.

```bash
# Run on the server after the backend is started.
curl --fail http://127.0.0.1:8000/api/v1/health/postgres
curl --fail http://127.0.0.1:8000/api/v1/health/redis
curl --fail --location https://testpapers.example.com/
curl --fail https://testpapers.example.com/api/v1/health/postgres
```

After publishing a deliberately answer-bearing test bank, replace
`<public-bank-id>` below and verify the public URL from a clean, logged-out
browser session. The response must render the page, but must not contain the
known answer text, internal user identifiers, emails, or draft content.

```bash
curl --fail --location \
  "https://testpapers.example.com/banks/<public-bank-id>" \
  -o /tmp/public-bank.html
! grep -F "<known-answer-text>" /tmp/public-bank.html
```

Confirm a private, withdrawn, and unknown bank URL all return the same
non-disclosing `404` response. Then log in through the HTTPS origin, verify the
session cookie has `Secure` and `HttpOnly`, and confirm the WebSocket upgrade
with the application smoke/E2E test rather than a hand-written unauthenticated
WebSocket request.

## Rollback Boundary

Frontend releases may be rolled back independently while the backend's
additive API and migration remain deployed. Roll back backend code only to a
release compatible with the database's current Alembic revision. Do not run
`alembic downgrade` merely to roll back an application binary: first roll back
all consumers of the new API, confirm no retained publication/subscription data
would be discarded, restore from the verified PostgreSQL backup if necessary,
and rehearse the downgrade on a copy of production data. Re-run the health and
public-bank smoke checks after every rollback.
