import subprocess
import time
import http.server
import threading
import re

def main():
    server = http.server.HTTPServer(('127.0.0.1', 8778), http.server.SimpleHTTPRequestHandler)
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
        "http://127.0.0.1:8778/index.html"
    ]

    try:
        proc = subprocess.run(cmd, capture_output=True, encoding="utf-8", errors="replace", timeout=15)
        dom = proc.stdout
        modal_match = re.search(r'<div id="modal-how-to-play" class="([^"]+)"', dom)
        if modal_match:
            print("Modal classes on load:", modal_match.group(1))
            if "visible" in modal_match.group(1):
                print("SUCCESS: #modal-how-to-play is automatically visible on initial load / refresh!")
            else:
                print("NOTE: modal does not have visible class")
        else:
            print("Could not find modal-how-to-play")
    except Exception as e:
        print("Error:", e)
    finally:
        server.shutdown()

if __name__ == "__main__":
    main()
