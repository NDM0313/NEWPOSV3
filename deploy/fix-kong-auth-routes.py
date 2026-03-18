#!/usr/bin/env python3
"""
Fix Kong 404: no Route matched for /auth/v1/.
The auth section has routes (auth-v1-all, etc.) wrongly nested under plugins.
Replace with correct separate services for open auth + one secure auth-v1 service.
Run on VPS: python3 deploy/fix-kong-auth-routes.py /root/supabase/docker/volumes/api/kong.yml
"""
import sys

AUTH_BLOCK = """  ## Open Auth routes
  - name: auth-v1-open
    _comment: 'Auth: /auth/v1/verify -> http://auth:9999/verify'
    url: http://auth:9999/verify
    routes:
      - name: auth-v1-open
        strip_path: true
        paths:
          - /auth/v1/verify
    plugins:
      - name: cors
  - name: auth-v1-open-callback
    _comment: 'Auth: /auth/v1/callback -> http://auth:9999/callback'
    url: http://auth:9999/callback
    routes:
      - name: auth-v1-open-callback
        strip_path: true
        paths:
          - /auth/v1/callback
    plugins:
      - name: cors
  - name: auth-v1-open-authorize
    _comment: 'Auth: /auth/v1/authorize -> http://auth:9999/authorize'
    url: http://auth:9999/authorize
    routes:
      - name: auth-v1-open-authorize
        strip_path: true
        paths:
          - /auth/v1/authorize
    plugins:
      - name: cors
  ## Secure Auth routes
  - name: auth-v1
    _comment: 'Auth: /auth/v1/* -> http://auth:9999/*'
    url: http://auth:9999/
    routes:
      - name: auth-v1-all
        strip_path: true
        paths:
          - /auth/v1/
    plugins:
      - name: cors
      - name: key-auth
        config:
          hide_credentials: false
      - name: acl
        config:
          hide_groups_header: true
          allow:
            - admin
            - anon

"""


def main():
    path = sys.argv[1] if len(sys.argv) > 1 else "/root/supabase/docker/volumes/api/kong.yml"
    with open(path, "r") as f:
        content = f.read()

    start_marker = "  ## Open Auth routes"
    end_marker = "  ## Secure REST routes"
    start = content.find(start_marker)
    end = content.find(end_marker)
    if start == -1 or end == -1 or end <= start:
        print("[fix-kong-auth] Auth block not found.")
        return 1
    new_content = content[:start] + AUTH_BLOCK.strip() + "\n\n  " + end_marker + content[end + len(end_marker):]
    with open(path, "w") as f:
        f.write(new_content)
    print("[fix-kong-auth] Fixed auth services block in kong.yml")
    return 0


if __name__ == "__main__":
    sys.exit(main())
