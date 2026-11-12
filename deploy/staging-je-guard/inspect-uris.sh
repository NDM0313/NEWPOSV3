#!/usr/bin/env bash
set -euo pipefail
python3 <<'PY'
import subprocess, re
from urllib.parse import urlparse, urlunparse

def env_of(container, prefix):
    out = subprocess.check_output(["docker","inspect",container,"-f","{{range .Config.Env}}{{println .}}{{end}}"], text=True)
    for line in out.splitlines():
        if line.startswith(prefix+"="):
            return line[len(prefix)+1:]
    return None

rest = env_of("supabase-rest","PGRST_DB_URI")
auth = env_of("supabase-auth","GOTRUE_DB_DATABASE_URL")

def redact(uri):
    u = urlparse(uri)
    if u.password:
        netloc = u.netloc.replace(u.password, "***")
    else:
        netloc = u.netloc
    return urlunparse((u.scheme, netloc, u.path, u.params, u.query, u.fragment)), u.scheme, u.username, u.hostname, u.port, u.path, u.query

for name, uri in [("rest", rest), ("auth", auth)]:
    red, scheme, user, host, port, path, query = redact(uri)
    print(f"{name}: scheme={scheme} user={user} host={host} port={port} path={path} query={query}")
    print(f"{name}_redacted={red}")
    # detect non-URL connection string
    if "://" not in (uri or ""):
        print(f"{name}_FORMAT=libpq_keywords")
        print(f"{name}_keys=", " ".join(re.findall(r"(\w+)=", uri or "")))
PY
