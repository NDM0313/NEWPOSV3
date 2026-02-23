# PWA Traefik / Nginx Rules

## Option A: Path /m on erp.dincouture.pk

### Dockerfile change (multi-stage)

Add mobile build and copy to `/m`:

```dockerfile
# In builder stage, after main build:
WORKDIR /app/erp-mobile-app
RUN npm ci && npm run build:mobile
# dist will be at /app/erp-mobile-app/dist

# In nginx stage:
COPY --from=builder /app/erp-mobile-app/dist /usr/share/nginx/html/m
```

### Nginx location

Add to `deploy/nginx.conf` inside the `server` block:

```nginx
location /m/ {
    alias /usr/share/nginx/html/m/;
    try_files $uri $uri/ /m/index.html;
    add_header Cache-Control "no-store, no-cache, must-revalidate";
}
location = /m {
    return 301 /m/;
}
```

## Option B: Subdomain m.erp.dincouture.pk

### Traefik (Dokploy) labels

```yaml
labels:
  - "traefik.enable=true"
  - "traefik.http.routers.erp-mobile.rule=Host(`m.erp.dincouture.pk`)"
  - "traefik.http.routers.erp-mobile.entrypoints=websecure"
  - "traefik.http.services.erp-mobile.loadbalancer.server.port=80"
```

### Separate container

Run a second nginx container serving only mobile dist, with above labels.
