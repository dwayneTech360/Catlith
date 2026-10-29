import subprocess
import time
import http.server
import threading

def main():
    server = http.server.HTTPServer(('127.0.0.1', 8770), http.server.SimpleHTTPRequestHandler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    time.sleep(0.5)

    edge_path = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
    cmd = [
        edge_path,
        "--headless",
        "--disable-gpu",
        "--virtual-time-budget=3000",
        "--dump-dom",
        "http://127.0.0.1:8770/index.html"
    ]

    try:
        proc = subprocess.run(cmd, capture_output=True, encoding="utf-8", errors="replace", timeout=15)
        dom = proc.stdout
        print("DOM length:", len(dom))
        if "Cat Puzzle" in dom and "menu-container" in dom:
            print("SUCCESS: index.html rendered completely without crashing!")
        else:
            print("WARNING: index.html DOM might be incomplete:")
            print(dom[:300])
    except Exception as e:
        print("Error:", e)
    finally:
        server.shutdown()

if __name__ == "__main__":
    main()
