#!/usr/bin/env python3
"""在本機預覽網頁（不需要上傳 GitHub）。

瀏覽器不允許 file:// 直接讀取 markets.json（CORS 限制），
所以要透過本機 HTTP 伺服器開啟。

用法：
    python scripts/serve_local.py              # 先抓一次真實報價，再啟動伺服器
    python scripts/serve_local.py --no-fetch   # 跳過抓取（沒有 quotes.json 時顯示演示資料）
    python scripts/serve_local.py --port 9000
"""
import argparse
import functools
import http.server
import os
import subprocess
import sys
import webbrowser

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = os.path.join(ROOT, "site")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", type=int, default=8000)
    ap.add_argument("--no-fetch", action="store_true", help="不抓取報價")
    args = ap.parse_args()

    if not args.no_fetch:
        print("正在抓取最新報價…（約需數十秒，可用 --no-fetch 跳過）")
        r = subprocess.run([sys.executable, os.path.join(ROOT, "scripts", "fetch_quotes.py")])
        if r.returncode != 0:
            print("抓取失敗，將以演示資料（或舊的 quotes.json）預覽")

    handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=SITE)
    # 只綁定 127.0.0.1，避免區域網路內其他裝置連入
    with http.server.ThreadingHTTPServer(("127.0.0.1", args.port), handler) as srv:
        url = f"http://localhost:{args.port}/"
        print(f"已啟動：{url}  （按 Ctrl+C 結束）")
        webbrowser.open(url)
        try:
            srv.serve_forever()
        except KeyboardInterrupt:
            print("\n已結束")


if __name__ == "__main__":
    main()
