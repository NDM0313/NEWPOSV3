#!/usr/bin/env python3
"""
Fix Kong 502: plugin 'analytics-v1-all' not enabled.
The kong.yml has routes (functions-v1-all, analytics-v1-all) wrongly nested under plugins.
Replace the malformed storage/functions/analytics block with correct service definitions.
Run on VPS: python3 deploy/fix-kong-analytics-plugin-error.py /root/supabase/docker/volumes/api/kong.yml
"""
import sys
import re

REPLACEMENT = r'''  ## Storage routes: the storage server manages its own auth
  - name: storage-v1
    _comment: 'Storage: /storage/v1/* -> http://storage:5000/*'
    url: http://storage:5000/
    routes:
      - name: storage-v1-all
        strip_path: true
        paths:
          - /storage/v1/
    plugins:
      - name: cors

  ## Edge Functions
  - name: functions-v1
    _comment: 'Edge Functions: /functions/v1/* -> http://functions:9000/*'
    url: http://functions:9000/
    routes:
      - name: functions-v1-all
        strip_path: true
        paths:
          - /functions/v1/
    plugins:
      - name: cors

  ## Analytics
  - name: analytics-v1
    _comment: 'Analytics: /analytics/v1/* -> http://analytics:4000/*'
    url: http://analytics:4000/
    routes:
      - name: analytics-v1-all
        strip_path: true
        paths:
          - /analytics/v1/
    plugins:
      - name: cors

'''

def main():
    path = sys.argv[1] if len(sys.argv) > 1 else "/root/supabase/docker/volumes/api/kong.yml"
    with open(path, "r") as f:
        content = f.read()

    start_marker = "  ## Storage routes: the storage server manages its own auth"
    end_marker = "  ## Secure Database routes"
    start = content.find(start_marker)
    end = content.find(end_marker)
    if start == -1 or end == -1 or end <= start:
        print("[fix-kong-analytics] Block not found; kong.yml may already be fixed or structure changed.")
        return 1
    new_content = content[:start] + REPLACEMENT.strip() + "\n\n  " + end_marker + content[end + len(end_marker):]
    with open(path, "w") as f:
        f.write(new_content)
    print("[fix-kong-analytics] Fixed storage/functions/analytics block in kong.yml")
    return 0

if __name__ == "__main__":
    sys.exit(main())
