# PWA Deployment

## Build

```bash
cd erp-mobile-app
npm run build:mobile
```

Output: `erp-mobile-app/dist/`

## Deployment Options

### Option A: Same domain at /m (erp.dincouture.pk/m)

1. Build mobile app
2. Copy `erp-mobile-app/dist/*` to web server under `/m/`
3. Nginx: add location for `/m`

```nginx
location /m {
    alias /usr/share/nginx/html/m;
    try_files $uri $uri/ /m/index.html;
    add_header Cache-Control "no-store, no-cache, must-revalidate";
}
```

### Option B: Subdomain (m.erp.dincouture.pk)

1. Add DNS: `m.erp.dincouture.pk` → same IP
2. Add Traefik/Dokploy route for `m.erp.dincouture.pk`
3. Serve `erp-mobile-app/dist` from that route

## PWA Features

- **manifest.webmanifest** — name, icons, theme, display: standalone
- **sw.js** — caches app shell; API calls not cached (offline queue handles data)
- **Install prompt** — mobile browsers show "Add to Home Screen" when criteria met

## Install Criteria (mobile)

- HTTPS
- manifest with name, icons, start_url
- Service worker registered
- User engagement (varies by browser)
