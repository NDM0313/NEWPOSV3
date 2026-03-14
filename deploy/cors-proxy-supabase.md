# CORS for supabase.dincouture.pk (if Kong CORS is not enough)

If login from **erp.dincouture.pk** still fails with "blocked by CORS policy: No 'Access-Control-Allow-Origin' header", the reverse proxy **in front of** supabase.dincouture.pk (Caddy, Nginx, or Traefik) may be answering OPTIONS preflight without passing CORS headers. Add CORS at the proxy so OPTIONS and responses include the header.

## Caddy (Caddyfile)

For the block that handles `supabase.dincouture.pk`:

```caddyfile
supabase.dincouture.pk {
    # Respond to OPTIONS preflight with CORS
    @options method OPTIONS
    handle @options {
        header Access-Control-Allow-Origin "https://erp.dincouture.pk"
        header Access-Control-Allow-Methods "GET, HEAD, PUT, PATCH, POST, DELETE, OPTIONS"
        header Access-Control-Allow-Headers "Authorization, Content-Type, Accept, apikey, prefer, x-client-info, x-supabase-api-version"
        header Access-Control-Allow-Credentials "true"
        header Access-Control-Max-Age "86400"
        respond 204
    }
    handle {
        reverse_proxy supabase-kong:8000
        header Access-Control-Allow-Origin "https://erp.dincouture.pk"
        header Access-Control-Allow-Credentials "true"
    }
}
```

Reload: `caddy reload --config /etc/caddy/Caddyfile`

## Nginx

Inside the `server { ... }` for `supabase.dincouture.pk`:

```nginx
location / {
    if ($request_method = 'OPTIONS') {
        add_header Access-Control-Allow-Origin "https://erp.dincouture.pk";
        add_header Access-Control-Allow-Methods "GET, HEAD, PUT, PATCH, POST, DELETE, OPTIONS";
        add_header Access-Control-Allow-Headers "Authorization, Content-Type, Accept, apikey, prefer, x-client-info, x-supabase-api-version";
        add_header Access-Control-Allow-Credentials "true";
        add_header Access-Control-Max-Age 86400;
        add_header Content-Length 0;
        return 204;
    }
    proxy_pass http://supabase-kong:8000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    add_header Access-Control-Allow-Origin "https://erp.dincouture.pk" always;
    add_header Access-Control-Allow-Credentials "true" always;
}
```

Reload: `nginx -s reload`

## Traefik (labels or IngressRoute)

Add middleware that sets CORS headers for `supabase.dincouture.pk` and use it on the router. Or ensure OPTIONS is forwarded to Kong and Kong responds with CORS (our `add-kong-cors-erp-origin.sh` does that).

## Verify

From your machine (or VPS):

```bash
curl -sI -X OPTIONS "https://supabase.dincouture.pk/auth/v1/token" \
  -H "Origin: https://erp.dincouture.pk" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Authorization, Content-Type, apikey"
```

You should see `Access-Control-Allow-Origin: https://erp.dincouture.pk` in the response headers.
