#!/usr/bin/env python3
"""
Simple HTTP server for Eatinator frontend with API proxy to FastAPI backend
"""

import http.server
import socketserver
import urllib.request
import urllib.parse
import json
import os
from pathlib import Path

PORT = 8000
FASTAPI_BACKEND = "http://localhost:5694"

class ProxyHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path.startswith('/api/'):
            self.proxy_request()
        else:
            super().do_GET()
    
    def do_POST(self):
        if self.path.startswith('/api/'):
            self.proxy_request()
        else:
            super().do_POST()
    
    def do_OPTIONS(self):
        if self.path.startswith('/api/'):
            self.send_response(200)
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
            self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
            self.send_header('Access-Control-Max-Age', '86400')
            self.end_headers()
        else:
            super().do_OPTIONS()
    
    def proxy_request(self):
        """Proxy API requests to FastAPI backend"""
        try:
            # Build the backend URL
            backend_url = FASTAPI_BACKEND + self.path
            if hasattr(self, 'query_string') and self.query_string:
                backend_url += '?' + self.query_string
            
            # Read request body for POST requests
            content_length = 0
            post_data = None
            if hasattr(self, 'headers') and 'Content-Length' in self.headers:
                content_length = int(self.headers['Content-Length'])
                post_data = self.rfile.read(content_length)
            
            # Create the request
            req = urllib.request.Request(backend_url, data=post_data)
            
            # Copy headers
            if hasattr(self, 'headers'):
                for header, value in self.headers.items():
                    if header.lower() not in ['host', 'connection']:
                        req.add_header(header, value)
            
            # Make the request
            response = urllib.request.urlopen(req)
            
            # Send response
            self.send_response(response.getcode())
            
            # Copy response headers
            for header, value in response.headers.items():
                if header.lower() not in ['connection', 'transfer-encoding']:
                    self.send_header(header, value)
            
            # Add CORS headers
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            
            # Copy response body
            self.wfile.write(response.read())
            
        except Exception as e:
            print(f"Proxy error: {e}")
            self.send_error(500, f"Proxy error: {str(e)}")

    def parse_request(self):
        """Parse the request and extract query string"""
        result = super().parse_request()
        if result:
            # Parse query string
            parsed = urllib.parse.urlparse(self.path)
            self.path = parsed.path
            self.query_string = parsed.query
        return result

if __name__ == "__main__":
    # Change to the project directory
    os.chdir(Path(__file__).parent)
    
    with socketserver.TCPServer(("", PORT), ProxyHTTPRequestHandler) as httpd:
        print(f"Serving at http://localhost:{PORT}")
        print(f"Proxying /api/* to {FASTAPI_BACKEND}")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nShutting down server...")