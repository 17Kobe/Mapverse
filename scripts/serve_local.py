#!/usr/bin/env python3
"""在本機預覽網頁（不需要上傳 GitHub）。

瀏覽器不允許 file:// 直接讀取 markets.json（CORS 限制），
所以要透過本機 HTTP 伺服器開啟。行情資料不在本專案：網頁會直接向 iKDx-realtime 發佈的
https://ikdx-realtime.pages.dev/data/world/ 讀取（見 site/app.js 的 DATA_BASE）。

用法：
    python scripts/serve_local.py
    python scripts/serve_local.py --port 9000
"""
import argparse
import functools
import http.server
import os
import webbrowser

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = os.path.join(ROOT, "site")


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    """每次都要求瀏覽器重新確認檔案，改完程式重新整理就會生效（不會一半新、一半舊）"""

    def end_headers(self):
        self.send_header("Cache-Control", "no-cache")
        super().end_headers()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", type=int, default=8000)
    args = ap.parse_args()

    handler = functools.partial(NoCacheHandler, directory=SITE)
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
