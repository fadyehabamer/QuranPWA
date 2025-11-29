# Simple HTTP Server for Testing PWA
# Run this file with: python server.py
# Then open: http://localhost:8000/quran.html

import http.server
import socketserver
import os

PORT = 8000

class MyHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # Add headers for PWA support
        self.send_header('Service-Worker-Allowed', '/')
        self.send_header('Cache-Control', 'no-cache')
        super().end_headers()

os.chdir(os.path.dirname(os.path.abspath(__file__)))

with socketserver.TCPServer(("", PORT), MyHTTPRequestHandler) as httpd:
    print(f"✅ Server running at http://localhost:{PORT}/")
    print(f"📖 Open: http://localhost:{PORT}/quran.html")
    print(f"⚙️  Settings: http://localhost:{PORT}/settings.html")
    print(f"\nPress Ctrl+C to stop the server")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n\n👋 Server stopped")
