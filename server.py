import http.server
import socketserver
import subprocess
import json
import re

PORT = 8080
JETSON_IP = "172.20.10.8"

class PingHandler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        # Nếu web gọi đến /api/ping, thực hiện lệnh ping của hệ điều hành
        if self.path == '/api/ping':
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            
            try:
                # Ping 1 gói tin (-c 1), chờ tối đa 1 giây (-W 1)
                output = subprocess.check_output(
                    ['ping', '-c', '1', '-W', '1', JETSON_IP], 
                    stderr=subprocess.STDOUT, text=True
                )
                # Dùng regex để tìm con số thời gian (VD: time=15.2 ms)
                match = re.search(r'time=([\d\.]+)\s*ms', output)
                
                if match:
                    ping_time = float(match.group(1))
                    res = {'status': 'ok', 'ping': ping_time}
                else:
                    res = {'status': 'error', 'ping': 999}
            except Exception:
                # Nếu ping rớt hoặc timeout
                res = {'status': 'error', 'ping': 999}
            
            # Trả dữ liệu về cho trình duyệt
            self.wfile.write(json.dumps(res).encode())
        else:
            # Nếu không gọi API, phục vụ file index.html bình thường
            super().do_GET()

# Khởi chạy server
with socketserver.TCPServer(("", PORT), PingHandler) as httpd:
    print(f"Web server và Ping API đang chạy tại cổng {PORT}")
    httpd.serve_forever()
