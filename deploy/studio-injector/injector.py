#!/usr/bin/env python3
"""
Proxy to Supabase Studio that injects a "Backups" link in the sidebar (Platform section).
Kong -> this proxy -> studio:3000. Only modifies HTML responses for the main app.
"""
import os
import re
import gzip
import urllib.request
import urllib.error
import http.server
import socketserver
from urllib.parse import urlparse, urlunparse

STUDIO_UPSTREAM = os.environ.get("STUDIO_UPSTREAM", "http://studio:3000")
PORT = int(os.environ.get("PORT", "8080"))

# Floating "Backups" link only - append to body. Do NOT modify sidebar/React tree (was causing React #418 + Host validation).
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
        self.proxy_request(b"")

    def do_POST(self):
        cl = self.headers.get("Content-Length")
        body = self.rfile.read(int(cl)) if cl else b""
        self.proxy_request(body)

    def do_HEAD(self):
        self.proxy_request(b"", method="HEAD")

    def do_OPTIONS(self):
        self.proxy_request(b"", method="OPTIONS")

    def do_PUT(self):
        cl = self.headers.get("Content-Length")
        body = self.rfile.read(int(cl)) if cl else b""
        self.proxy_request(body, method="PUT")

    def do_PATCH(self):
        cl = self.headers.get("Content-Length")
        body = self.rfile.read(int(cl)) if cl else b""
        self.proxy_request(body, method="PATCH")

    def do_DELETE(self):
        self.proxy_request(b"", method="DELETE")

    def proxy_request(self, body, method=None):
        method = method or self.command
        path = self.path
        if "?" in path:
            path, qs = path.split("?", 1)
        else:
            qs = ""
        url = STUDIO_UPSTREAM + path + ("?" + qs if qs else "")
        req = urllib.request.Request(url, data=body if method == "POST" else None, method=method)
        for k, v in self.headers.items():
            if k.lower() in ("host", "connection", "transfer-encoding"):
                continue
            req.add_header(k, v)
        req.add_header("Host", urlparse(STUDIO_UPSTREAM).netloc or "studio")
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                data = resp.read()
                enc = resp.headers.get("Content-Encoding", "")
                if enc == "gzip":
                    data = gzip.decompress(data)
                ct = resp.headers.get("Content-Type", "")
                # Only inject into HTML for main app pages (root or /project/...)
                inject = (
                    "text/html" in ct
                    and (path in ("/", "") or path.startswith("/project/") or path.startswith("project/"))
                    and b"</body>" in data
                    and INJECT_SCRIPT.encode() not in data
                )
                if inject:
                    data = data.replace(b"</body>", INJECT_SCRIPT.encode() + b"\n</body>", 1)
                self.send_response(resp.status)
                for k, v in resp.headers.items():
                    if k.lower() in ("content-length", "transfer-encoding", "content-encoding"):
                        continue
                    self.send_header(k, v)
                self.send_header("Content-Length", str(len(data)))
                self.end_headers()
                self.wfile.write(data)
        except urllib.error.HTTPError as e:
            self.send_response(e.code)
            self.end_headers()
            try:
                self.wfile.write(e.read())
            except Exception:
                pass
        except Exception as e:
            self.send_response(502)
            self.send_header("Content-Type", "text/plain")
            self.end_headers()
            self.wfile.write(b"Bad Gateway: " + str(e).encode())

    def log_message(self, format, *args):
        pass


if __name__ == "__main__":
    with socketserver.TCPServer(("", PORT), ProxyHandler) as httpd:
        httpd.serve_forever()
