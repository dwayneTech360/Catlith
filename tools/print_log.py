import subprocess
import time
import http.server
import threading
import re

def main():
    server = http.server.HTTPServer(('127.0.0.1', 8774), http.server.SimpleHTTPRequestHandler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    time.sleep(0.5)

    edge_path = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
    cmd = [
        edge_path,
        "--headless",
        "--disable-gpu",
        "--dump-dom",
        "http://127.0.0.1:8774/test.html"
    ]

    try:
        proc = subprocess.run(cmd, capture_output=True, encoding="utf-8", errors="replace", timeout=15)
        dom = proc.stdout
        log_match = re.search(r'<div id="log">(.*?)</div>', dom, re.DOTALL)
        if log_match:
            print("LOG CONTENT:")
            print(log_match.group(1).encode('ascii', errors='backslashreplace').decode('ascii'))
        else:
            print("Log div not found!")
    except Exception as e:
        print("Error:", e)
    finally:
        server.shutdown()

if __name__ == "__main__":
    main()
