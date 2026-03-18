#!/usr/bin/env python3
import urllib.request
env_path = "/root/supabase/docker/.env"
key = None
with open(env_path) as f:
    for line in f:
        if line.startswith("ANON_KEY="):
            key = line.split("=", 1)[1].rstrip("\r\n")
            break
if not key:
    print("No ANON_KEY"); exit(1)
print("Key len", len(key))
req = urllib.request.Request("https://supabase.dincouture.pk/auth/v1/health", headers={"apikey": key})
try:
    r = urllib.request.urlopen(req, timeout=10)
    print("Status", r.status)
    print(r.read().decode())
except urllib.error.HTTPError as e:
    print("HTTPError", e.code, e.read().decode())
