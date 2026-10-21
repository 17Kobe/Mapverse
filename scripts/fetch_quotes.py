#!/usr/bin/env python3
"""抓取 site/markets.json 裡所有代碼的最新報價，寫入 site/quotes.json。

- 只用 Python 標準庫，GitHub Actions 裡不需要裝任何套件
- 資料來源：Yahoo Finance chart 介面（非官方、免費，資料通常延遲 15 分鐘左右）
- 某個代碼抓失敗時，沿用上一版（PREV_FILE）的資料並標記 stale，網頁不會出現空洞
"""
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = os.path.join(ROOT, "site")
PREV_FILE = os.environ.get("PREV_FILE", "")
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/124.0 Safari/537.36")


def fetch_one(sym):
    """回傳 (sym, quote_dict 或 None, 錯誤資訊)"""
    err = ""
    for attempt in range(3):
        host = "query1" if attempt % 2 == 0 else "query2"
        url = (f"https://{host}.finance.yahoo.com/v8/finance/chart/"
               f"{urllib.parse.quote(sym, safe='')}?range=5d&interval=1d&includePrePost=false")
        req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/json"})
        try:
            with urllib.request.urlopen(req, timeout=20) as r:
                data = json.load(r)
            q = parse_chart(data)
            if q:
                return sym, q, ""
            err = "empty result"
        except urllib.error.HTTPError as e:
            err = f"HTTP {e.code}"
            if e.code == 429:
                time.sleep(3 * (attempt + 1))
        except Exception as e:  # 網路錯誤、JSON 錯誤等
            err = f"{type(e).__name__}: {e}"
        time.sleep(1.2 * (attempt + 1))
    return sym, None, err


def parse_chart(data):
    res = (data.get("chart") or {}).get("result")
    if not res:
        return None
    res = res[0]
    meta = res.get("meta") or {}
    ts = res.get("timestamp") or []
    closes = ((res.get("indicators") or {}).get("quote") or [{}])[0].get("close") or []
    pairs = [(t, c) for t, c in zip(ts, closes) if c is not None]
    price = meta.get("regularMarketPrice")
    if price is None and pairs:
        price = pairs[-1][1]
    if price is None:
        return None
    # 前一個交易日收盤：倒數第二根日 K（最後一根是今天，盤中會隨價格變動）
    if len(pairs) >= 2:
        prev = pairs[-2][1]
    else:
        prev = meta.get("chartPreviousClose") or meta.get("previousClose")
    if not prev:
        return None
    t = meta.get("regularMarketTime") or (pairs[-1][0] if pairs else int(time.time()))
    spark = [round(c, 4) for _, c in pairs][-6:]
    if spark:
        spark[-1] = round(price, 4)
    return {
        "p": round(price, 4),
        "c": round(price - prev, 4),
        "pct": round((price - prev) / prev * 100, 3),
        "prev": round(prev, 4),
        "t": int(t),
        "spark": spark,
    }


def load_prev():
    if PREV_FILE and os.path.exists(PREV_FILE):
        try:
            with open(PREV_FILE, encoding="utf-8") as f:
                return (json.load(f) or {}).get("quotes") or {}
        except Exception:
            pass
    return {}


def main():
    with open(os.path.join(SITE, "markets.json"), encoding="utf-8") as f:
        cfg = json.load(f)
    symbols = sorted({i["s"] for i in cfg["items"]})
    prev = load_prev()

    quotes, failed = {}, []
    with ThreadPoolExecutor(max_workers=4) as ex:
        for sym, q, err in ex.map(fetch_one, symbols):
            if q:
                quotes[sym] = q
            else:
                failed.append((sym, err))
                if sym in prev:
                    old = dict(prev[sym])
                    old["stale"] = True
                    quotes[sym] = old

    ok = len(symbols) - len(failed)
    print(f"成功 {ok} / {len(symbols)}")
    for sym, err in failed:
        print(f"  失敗 {sym}: {err}" + ("（沿用舊資料）" if sym in prev else ""))

    if not quotes:
        print("沒有任何資料，放棄本次部署", file=sys.stderr)
        sys.exit(1)

    out = {
        "generated": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "ok": ok,
        "total": len(symbols),
        "quotes": quotes,
    }
    with open(os.path.join(SITE, "quotes.json"), "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, separators=(",", ":"))


if __name__ == "__main__":
    main()
