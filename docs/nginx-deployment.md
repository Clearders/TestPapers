# Nginx Proxy Deployment

This frontend is compatible with a same-origin Nginx proxy layout:

- Browser API requests use `/api/v1`.
- Browser WebSocket requests use `/api/v1/ws`.
- Nuxt server-side requests use `NUXT_API_BASE` and should point to the backend service directly.

> **Important**: In production, the Nuxt server does **not** proxy `/api/v1` requests to the backend on its own. You **must** either:
>
> 1. Place a reverse proxy (Nginx) in front of both frontend and backend (recommended — see example below), or
> 2. Set `NUXT_PUBLIC_API_BASE=https://your-backend.example.com/api/v1` to have the browser call the backend directly. Note that this requires CORS and cookie domain configuration on the backend.

## Runtime Variables

Use these values when serving the frontend behind Nginx:

```bash
NUXT_PUBLIC_API_BASE=/api/v1
NUXT_API_BASE=http://127.0.0.1:8000/api/v1
NUXT_PUBLIC_WS_BASE=
NITRO_HOST=127.0.0.1
NITRO_PORT=3000
```

The frontend defaults already use `/api/v1` for browser requests. Set `NUXT_API_BASE` when the Nuxt server needs to validate sessions during SSR or route middleware.

Nuxt emits the frontend Content Security Policy through `nuxt-security` with
per-request SSR script nonces. In the same-origin Nginx layout, `connect-src`
is limited to `'self'`. If you intentionally use a separate browser-visible API
or WebSocket host, set the corresponding `NUXT_PUBLIC_*` variable to the exact
`https://...` or `wss://...` origin; do not add scheme-wide `ws:` or `wss:`
allowances.

For HTTPS deployments, configure the backend cookie settings as well:

```bash
APP_ENV=production
CORS_ORIGINS=https://testpapers.example.com
TRUSTED_HOSTS=testpapers.example.com
AUTH_COOKIE_SECURE=true
AUTH_COOKIE_SAMESITE=lax
```

Production backend startup is fail-closed for browser origins and host headers: `CORS_ORIGINS` and `TRUSTED_HOSTS` are required, and neither setting may include `*`.

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
