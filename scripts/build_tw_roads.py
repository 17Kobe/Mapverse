"""產生旅遊地圖（台灣）的主要道路，輸出到 site/assets/geo/tw-roads.json。

執行一次即可（結果已放在儲存庫裡，網頁不需要再連 OpenStreetMap）：
    python scripts/build_tw_roads.py [--cache 資料夾]

資料來源：OpenStreetMap（© OpenStreetMap 貢獻者，ODbL 授權），經 Overpass API 下載。
一次抓整個台灣容易被中斷，所以切成小格子分批抓；給 --cache 的話每一格會存檔，中斷後重跑只補缺的。

道路分三級：
    0 國道（高速公路，highway=motorway）
    1 快速公路（台61~台88，多半是 highway=trunk）
    2 省道（台1、台9 等，highway=primary/trunk 且 ref:zh 是「台…線」）

輸出格式（座標都是經緯度 × q 的整數）：
    lines：每條線 [級別, x0, y0, dx1, dy1, ...]，之後每點存和前一點的差
    tags ：路線編號牌的候選位置 [級別, 編號, x, y]，沿路線每隔幾公里一個，前端再依縮放挑著放
"""
import argparse
import json
import math
import os
import re
import time
import urllib.parse
import urllib.request

OVERPASS = 'https://overpass-api.de/api/interpreter'
OUT = os.path.join(os.path.dirname(__file__), '..', 'site', 'assets', 'geo', 'tw-roads.json')
# 台灣本島 + 澎湖、綠島、蘭嶼、小琉球（金門、馬祖的省道很短，而且框進去會抓到大陸的道路）
BBOX = (119.2, 21.8, 122.1, 25.4)
STEP = 0.6
Q = 1e5            # 座標精度約 1 公尺
TOL_M = 12         # 折線簡化的容許誤差（公尺）；前端放大到最大時約 1 像素
TAG_EVERY_KM = 6   # 路線編號牌候選位置的間距


def fetch_cell(bb, cache, offline=False):
    fn = cache and os.path.join(cache, '%.1f_%.1f.json' % (bb[0], bb[1]))
    if fn and os.path.exists(fn):
        with open(fn, encoding='utf-8') as f:
            return json.load(f)['elements']
    if offline:
        return []
    s = '%f,%f,%f,%f' % (bb[1], bb[0], bb[3], bb[2])
    query = ('[out:json][timeout:120];(way["highway"~"^(motorway|trunk)$"](%s);'
             'way["highway"="primary"]["ref:zh"~"^台"](%s););out tags geom;') % (s, s)
    for k in range(6):
        try:
            req = urllib.request.Request(OVERPASS, data=urllib.parse.urlencode({'data': query}).encode(),
                                         headers={'User-Agent': 'Mapverse/1.0 (road map build script)'})
            with urllib.request.urlopen(req, timeout=240) as r:
                raw = r.read()
            els = json.loads(raw)['elements']
            if fn:
                with open(fn, 'wb') as f:
                    f.write(raw)
            print('cell', s, 'ways', len(els))
            return els
        except Exception as ex:  # 伺服器忙碌或連線被中斷：等一下再試
            print('cell', s, 'retry', k + 1, ex)
            time.sleep(10 + k * 10)
    raise RuntimeError('Overpass 下載失敗：' + s)


def classify(t):
    """回傳 (級別, 編號牌文字)；不是主要道路回傳 None"""
    hw = t.get('highway')
    zh = (t.get('ref:zh') or '').split(';')[0].strip()
    ref = (t.get('ref') or '').split(';')[0].strip()
    m = re.match(r'^台(\d+)(\S*?)線?$', zh)
    if m:
        n = int(m.group(1))
        return (1 if 61 <= n <= 88 else 2), m.group(1) + m.group(2)
    m = re.match(r'^國道(\d+)(\D*?)號?$', zh)  # 國道1號、國道3甲號
    if m:
        return 0, m.group(1) + m.group(2)
    m = re.match(r'^(\d+)(\D*)$', ref)
    if hw == 'motorway':
        # 國道編號 1~10；快速公路有些路段也標成 motorway（台61、台62 等）
        if m and int(m.group(1)) >= 61:
            return 1, m.group(1) + m.group(2)
        return 0, (m.group(1) + m.group(2)) if m else ''
    if hw == 'trunk':
        if m:
            return (1 if int(m.group(1)) >= 61 else 2), m.group(1) + m.group(2)
        return 1, ''  # 沒有編號的快速道路（例如都會區快速道路）
    return None


def merge(lines):
    """把端點相接的線段接成長線（同一級別、同一編號），簡化與編號牌間距才連貫"""
    lines = [l for l in lines if len(l) >= 2]
    ends = {}
    for i, l in enumerate(lines):
        for p in (l[0], l[-1]):
            ends.setdefault(p, []).append(i)
    used = [False] * len(lines)
    out = []
    for i in range(len(lines)):
        if used[i]:
            continue
        used[i] = True
        cur = list(lines[i])
        for front in (False, True):
            while True:
                p = cur[0] if front else cur[-1]
                nxt = next((j for j in ends.get(p, []) if not used[j]), None)
                if nxt is None:
                    break
                used[nxt] = True
                l = lines[nxt]
                if front:
                    seg = l if l[-1] == p else l[::-1]
                    cur = seg[:-1] + cur
                else:
                    seg = l if l[0] == p else l[::-1]
                    cur = cur + seg[1:]
        out.append(cur)
    return out


def simplify(pts, tol_m):
    """Douglas–Peucker（經度依緯度縮放成公尺）"""
    if len(pts) < 3:
        return pts
    kx = 111320 * math.cos(math.radians(pts[0][1]))
    ky = 110540
    P = [(p[0] * kx, p[1] * ky) for p in pts]
    keep = [False] * len(P)
    keep[0] = keep[-1] = True
    stack = [(0, len(P) - 1)]
    while stack:
        a, b = stack.pop()
        (ax, ay), (bx, by) = P[a], P[b]
        dx, dy = bx - ax, by - ay
        L = math.hypot(dx, dy)
        best, bi = 0.0, -1
        for i in range(a + 1, b):
            px, py = P[i]
            d = abs(dy * (px - ax) - dx * (py - ay)) / L if L > 1e-9 else math.hypot(px - ax, py - ay)
            if d > best:
                best, bi = d, i
        if best > tol_m and bi > 0:
            keep[bi] = True
            stack += [(a, bi), (bi, b)]
    return [p for p, k in zip(pts, keep) if k]


def tag_points(pts, every_km):
    """沿線每隔 every_km 公里取一點（第一點在半個間距處）"""
    out, acc, nxt = [], 0.0, every_km * 500
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        d = math.hypot((x1 - x0) * 111320 * math.cos(math.radians(y0)), (y1 - y0) * 110540)
        while d > 0 and acc + d >= nxt:
            f = (nxt - acc) / d
            out.append((x0 + (x1 - x0) * f, y0 + (y1 - y0) * f))
            nxt += every_km * 1000
        acc += d
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--cache', help='每一格的下載結果存在這個資料夾，重跑時直接讀')
    ap.add_argument('--offline', action='store_true', help='只用 --cache 裡已經有的格子（測試用）')
    a = ap.parse_args()
    if a.cache:
        os.makedirs(a.cache, exist_ok=True)

    ways = {}
    y = BBOX[1]
    while y < BBOX[3] - 1e-9:
        x = BBOX[0]
        while x < BBOX[2] - 1e-9:
            bb = (round(x, 4), round(y, 4), round(min(BBOX[2], x + STEP), 4), round(min(BBOX[3], y + STEP), 4))
            for e in fetch_cell(bb, a.cache, a.offline):
                ways[e['id']] = e  # 跨格子的道路會重複出現，用 id 去重
            x += STEP
        y += STEP

    groups = {}
    for e in ways.values():
        c = classify(e.get('tags', {}))
        if c is None or not e.get('geometry'):
            continue
        pts = [(round(g['lon'], 7), round(g['lat'], 7)) for g in e['geometry']]
        # 西北角的格子會框到福建沿海（台灣本島最西約東經 120.0°，澎湖在北緯 24° 以南）
        if min(p[0] for p in pts) < 120.0 and max(p[1] for p in pts) > 24.0:
            continue
        groups.setdefault(c, []).append(pts)

    lines, tags = [], []
    npts = 0
    for (cls, label), ls in sorted(groups.items()):
        for l in merge(ls):
            s = simplify(l, TOL_M)
            out, px, py = [cls], 0, 0
            for lon, lat in s:
                qx, qy = round(lon * Q), round(lat * Q)
                if len(out) > 1 and qx == px and qy == py:
                    continue
                out += [qx - px, qy - py]
                px, py = qx, qy
            if len(out) >= 5:
                lines.append(out)
                npts += (len(out) - 1) // 2
            if label:
                for lon, lat in tag_points(l, TAG_EVERY_KM):
                    tags.append([cls, label, round(lon * Q), round(lat * Q)])

    res = {'q': Q, 'lines': lines, 'tags': tags}
    with open(OUT, 'w', encoding='utf-8') as f:
        json.dump(res, f, ensure_ascii=False, separators=(',', ':'))
    per = [sum((len(l) - 1) // 2 for l in lines if l[0] == c) for c in range(3)]
    print('ways', len(ways), '| lines', len(lines), 'points', npts, '(國道 %d / 快速 %d / 省道 %d)' % tuple(per),
          '| tags', len(tags), '| bytes', os.path.getsize(OUT))


if __name__ == '__main__':
    main()
