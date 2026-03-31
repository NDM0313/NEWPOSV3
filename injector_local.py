#!/usr/bin/env python3
"""
Enhanced Proxy to Supabase Studio for self-hosted mode.
1. Injects a "Backups" link in the sidebar.
2. Mocks Platform routes that the UI expects but the backend lacks.
3. Bridges /api-keys/legacy to /api-keys.
4. Provides informative errors for unsupported operations.
"""
import os
import gzip
import json
import urllib.request
import urllib.error
import http.server
import socketserver
from urllib.parse import urlparse

STUDIO_UPSTREAM = os.environ.get("STUDIO_UPSTREAM", "http://studio:3000")
PORT = int(os.environ.get("PORT", "8080"))

# Floating "Backups" link only
INJECT_SCRIPT = r"""<script>
(function(){
  if (document.getElementById('erp-backup-float')) return;
  var wrap = document.createElement('div');
  wrap.id = 'erp-backup-float';
  wrap.style.cssText = 'position:fixed;bottom:16px;left:16px;z-index:99999;';
  var a = document.createElement('a');
  a.href = '/backup';
  a.textContent = 'Backups';
  a.style.cssText = 'display:inline-block;padding:8px 14px;background:#252525;color:#a1a1a1;text-decoration:none;font-size:13px;border-radius:6px;border:1px solid #2e2e2e;';
  a.onmouseover = function(){ this.style.color="#ededed"; this.style.borderColor="#3b82f6"; };
  a.onmouseout = function(){ this.style.color="#a1a1a1"; this.style.borderColor="#2e2e2e"; };
  wrap.appendChild(a);
  document.body.appendChild(wrap);
})();
</script>"""

class ProxyHandler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        self.handle_request()

    def do_POST(self):
        self.handle_request()

    def do_HEAD(self):
        self.handle_request()

    def do_OPTIONS(self):
        self.handle_request()

    def do_PUT(self):
        self.handle_request()

    def do_PATCH(self):
        self.handle_request()

    def do_DELETE(self):
        self.handle_request()

    def handle_request(self):
        path = self.path
        method = self.command
        
        # 1. Intercept /api/platform/organizations/default
        if path.startswith("/api/platform/organizations/default"):
            self.send_json_response(self.get_mock_org())
            return

        # 2. Intercept /api/platform/projects/default
        if path.startswith("/api/platform/projects/default") and "/api-keys" not in path and "/config/api" not in path:
            self.send_json_response(self.get_mock_project())
            return

        # 3. Intercept /api/platform/projects/default/config/api
        if path.startswith("/api/platform/projects/default/config/api"):
            self.send_json_response({
                "auto_apidoc_enabled": True,
                "max_rows": 1000,
                "db_schema": "public, storage, graphql_public",
                "db_extra_search_path": "public, extensions",
                "jwt_secret": "hidden-in-self-hosted"
            })
            return

        # 4. Bridge /api/v1/projects/default/api-keys/legacy -> /api/v1/projects/default/api-keys
        if path.startswith("/api/v1/projects/default/api-keys/legacy"):
            self.path = path.replace("/legacy", "")
            self.proxy_request()
            return

        # 5. Handle POST /api/v1/projects/default/api-keys (Creation)
        if method == "POST" and path.startswith("/api/v1/projects/default/api-keys"):
            self.send_response(405)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({
                "error": "Method Not Allowed",
                "message": "New API key creation is not supported in self-hosted mode. Please use the existing anon/service_role keys from your environment configuration."
            }).encode())
            return

        self.proxy_request()

    def send_json_response(self, data, status=200):
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps(data).encode())

    def get_mock_org(self):
        return {
            "id": 1,
            "name": "Default Organization",
            "slug": "default",
            "billing_email": "admin@example.com"
        }

    def get_mock_project(self):
        return {
            "id": 1,
            "ref": "default",
            "name": "Default Project",
            "organization_id": 1,
            "status": "ACTIVE_HEALTHY",
            "cloud_provider": "localhost",
            "region": "local"
        }

    def proxy_request(self):
        method = self.command
        path = self.path
        url = STUDIO_UPSTREAM + path
        
        cl = self.headers.get("Content-Length")
        body = self.rfile.read(int(cl)) if cl else None
        
        req = urllib.request.Request(url, data=body, method=method)
        
        for k, v in self.headers.items():
            if k.lower() in ("host", "connection", "transfer-encoding", "content-length"):
                continue
            req.add_header(k, v)
        
        req.add_header("Host", urlparse(STUDIO_UPSTREAM).netloc or "studio")
        
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                data = resp.read()
                enc = resp.headers.get("Content-Encoding", "")
                if enc == "gzip":
                    try:
                        data = gzip.decompress(data)
                        enc = ""
                    except Exception:
                        pass
                
                ct = resp.headers.get("Content-Type", "")
                if "text/html" in ct and b"</body>" in data:
                    if INJECT_SCRIPT.encode() not in data:
                        data = data.replace(b"</body>", INJECT_SCRIPT.encode() + b"\n</body>", 1)
                
                self.send_response(resp.status)
                for k, v in resp.headers.items():
                    if k.lower() in ("content-length", "transfer-encoding", "content-encoding"):
                        continue
                    self.send_header(k, v)
                
                if enc:
                    self.send_header("Content-Encoding", enc)
                
                self.send_header("Content-Length", str(len(data)))
                self.end_headers()
                self.wfile.write(data)
        except urllib.error.HTTPError as e:
            self.send_response(e.code)
            for k, v in e.headers.items():
                if k.lower() in ("content-length", "transfer-encoding"):
                    continue
                self.send_header(k, v)
            content = e.read()
            self.send_header("Content-Length", str(len(content)))
            self.end_headers()
            self.wfile.write(content)
        except Exception as e:
            self.send_response(502)
            self.send_header("Content-Type", "text/plain")
            self.end_headers()
            self.wfile.write(b"Bad Gateway: " + str(e).encode())

    def log_message(self, format, *args):
        pass

if __name__ == "__main__":
    print(f"Starting injector on port {PORT} targeting {STUDIO_UPSTREAM}")
    with socketserver.TCPServer(("", PORT), ProxyHandler) as httpd:
        httpd.serve_forever()
