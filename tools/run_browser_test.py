import subprocess
import time
import http.server
import threading
import re

def main():
    server = http.server.HTTPServer(('127.0.0.1', 0), http.server.SimpleHTTPRequestHandler)
    port = server.server_address[1]
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    time.sleep(0.3)

    edge_path = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
    cmd = [
        edge_path,
        "--headless",
        "--disable-gpu",
        "--virtual-time-budget=8000",
        "--dump-dom",
        f"http://127.0.0.1:{port}/test.html"
    ]

    try:
        proc = subprocess.run(cmd, capture_output=True, encoding="utf-8", errors="replace", timeout=15)
        dom = proc.stdout
        print("DOM length:", len(dom))
        
        match_pass = re.search(r'<span id="pass-count">(\d+)</span>', dom)
        match_fail = re.search(r'<span id="fail-count">(\d+)</span>', dom)
        match_total = re.search(r'<span id="total-count">(\d+)</span>', dom)

        if match_pass:
            print(f"Browser Test Results: Total={match_total.group(1)}, Passed={match_pass.group(1)}, Failed={match_fail.group(1)}")
        
        if "TOTAL TESTS:" in dom:
            idx = dom.find("TOTAL TESTS:")
            clean_summary = dom[idx:idx+90].encode('ascii', errors='backslashreplace').decode('ascii')
            print(clean_summary)
        else:
            log_match = re.search(r'<div id="log">(.*?)</div>', dom, re.DOTALL)
            if log_match:
                print("Log snippet:", log_match.group(1)[:300].encode('ascii', errors='backslashreplace').decode('ascii'))
    except Exception as e:
        print("Error:", e)
    finally:
        server.shutdown()

if __name__ == "__main__":
    main()
