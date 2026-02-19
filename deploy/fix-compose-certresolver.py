p = '/root/supabase/docker/docker-compose.yml'
with open(p) as f:
    lines = f.readlines()
with open(p, 'w') as f:
    for L in lines:
        if 'certresolver' in L and 'supabase-kong' in L:
            L = '      - "traefik.http.routers.supabase-kong.tls.certresolver=letsencrypt"\n'
        f.write(L)
print('done')
