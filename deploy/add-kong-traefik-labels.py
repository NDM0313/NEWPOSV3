#!/usr/bin/env python3
# Add Traefik labels to Kong in Supabase docker-compose (run on VPS)
import sys
path = "/root/supabase/docker/docker-compose.yml"
with open(path) as f:
    lines = f.readlines()
out = []
i = 0
while i < len(lines):
    out.append(lines[i])
    # After kong's entrypoint line, insert labels and networks
    if "entrypoint: bash -c" in lines[i] and "kong docker-start" in lines[i] and i > 0 and "kong:" in "".join(lines[max(0,i-20):i]):
        out.append("    labels:\n")
        out.append('      - "traefik.enable=true"\n')
        out.append('      - "traefik.http.routers.supabase-kong.rule=Host(`supabase.dincouture.pk`)"\n')
        out.append('      - "traefik.http.routers.supabase-kong.entrypoints=websecure"\n')
        out.append('      - "traefik.http.routers.supabase-kong.tls=true"\n')
        out.append('      - "traefik.http.services.supabase-kong.loadbalancer.server.port=8000"\n')
        out.append("    networks:\n")
        out.append("      - default\n")
        out.append("      - dokploy-network\n")
    i += 1
# Add top-level networks if missing
content = "".join(out)
if "dokploy-network:" not in content and "external: true" not in content:
    if "\nvolumes:" in content:
        content = content.replace("\nvolumes:", "\nnetworks:\n  dokploy-network:\n    external: true\n\nvolumes:", 1)
    elif "\nvolumes:" not in content:
        content = content.rstrip() + "\n\nnetworks:\n  dokploy-network:\n    external: true\n"
with open(path, "w") as f:
    f.write(content)
print("Done")
