#!/usr/bin/env python3
"""在本機預覽網頁（不需要上傳 GitHub）。

瀏覽器不允許 file:// 直接讀取 markets.json（CORS 限制），
所以要透過本機 HTTP 伺服器開啟。行情資料不在本專案：網頁會直接向 iKDx-realtime 發佈的
https://ikdx-realtime.pages.dev/data/world/ 讀取（見 site/app.js 的 DATA_BASE）。

用法：
    python scripts/serve_local.py
    python scripts/serve_local.py --port 9000
預設從 8000 埠開始；該埠已經被別的程式（例如另一個專案的預覽伺服器）占用時，會自動改用下一個空的埠。
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


class Server(http.server.ThreadingHTTPServer):
    # Windows 的 SO_REUSEADDR 允許多個程式綁在同一個埠，結果先啟動的舊伺服器會一直接走連線，
    # 瀏覽器就看到別的專案。關掉它，埠被占用時綁定才會失敗，由 main 改用下一個埠。
    allow_reuse_address = False


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", type=int, default=8000)
    args = ap.parse_args()

    handler = functools.partial(NoCacheHandler, directory=SITE)
    # 只綁定 127.0.0.1，避免區域網路內其他裝置連入
    srv = None
    for port in range(args.port, args.port + 20):
        try:
            srv = Server(("127.0.0.1", port), handler)
            break
        except OSError:
            print(f"埠 {port} 已被占用，改用下一個…")
    if srv is None:
        raise SystemExit(f"找不到可用的埠（{args.port}～{args.port + 19} 都被占用）")
    with srv:
        url = f"http://localhost:{port}/"
        print(f"已啟動：{url}  （按 Ctrl+C 結束）")
        webbrowser.open(url)
        try:
            srv.serve_forever()
        except KeyboardInterrupt:
            print("\n已結束")


if __name__ == "__main__":
    main()
