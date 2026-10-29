import subprocess
import time
import http.server
import threading
import re

def main():
    server = http.server.HTTPServer(('127.0.0.1', 8769), http.server.SimpleHTTPRequestHandler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    time.sleep(0.5)

    edge_path = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
    cmd = [
        edge_path,
        "--headless",
        "--disable-gpu",
        "--virtual-time-budget=6000",
        "--dump-dom",
        "http://127.0.0.1:8769/test.html"
    ]

    try:
        proc = subprocess.run(cmd, capture_output=True, encoding="utf-8", errors="replace", timeout=15)
        dom = proc.stdout
        fails = re.findall(r'<div class="log-fail">(.*?)</div>', dom)
        print(f"Failed count: {len(fails)}")
        for f in fails:
            clean = f.encode('ascii', errors='backslashreplace').decode('ascii')
            print("  FAIL:", clean)
    except Exception as e:
        print("Error:", e)
    finally:
        server.shutdown()

if __name__ == "__main__":
    main()
