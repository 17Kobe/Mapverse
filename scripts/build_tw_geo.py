"""產生旅遊地圖（台灣）用的地理資料，輸出到 site/assets/geo/。

執行一次即可（結果已放在儲存庫裡，網頁不需要再連這兩個來源）：
    python scripts/build_tw_geo.py

輸出：
- tw-counties.json：台灣縣市界 TopoJSON（taiwan-atlas，資料來自內政部國土測繪中心，
  含澎湖、金門、馬祖、綠島、蘭嶼、小琉球、龜山島等離島）。前端用來畫海岸線光暈與縣市界。
- tw-fog.json：「戰爭迷霧」用的多邊形，已轉成單位 Web Mercator 平面座標（0~1），前端直接乘上
  世界邊長就是畫面座標，不必再做球面投影。每個環是整數陣列 [x0, y0, dx1, dy1, ...]，除以 q 還原。
    fog：台灣以外的陸地（Natural Earth 10m，裁到台灣周邊），蓋上迷霧
    tw ：台灣的陸地（taiwan-atlas），從迷霧裡挖掉，保證金門、馬祖不會被大陸的迷霧蓋到
"""
import json
import math
import os
import urllib.request

TW_URL = 'https://cdn.jsdelivr.net/npm/taiwan-atlas@2021.9.20/counties-10t.json'
WORLD_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-10m.json'
OUT = os.path.join(os.path.dirname(__file__), '..', 'site', 'assets', 'geo')
# 迷霧的範圍（經度、緯度）：寬螢幕縮到最小時看得到的區域都要涵蓋
FOG_BOX = (105.0, 14.0, 135.0, 34.0)


def fetch(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': 'Mapverse'}), timeout=60) as r:
        return json.load(r)


def decode(topo):
    """把 TopoJSON 的 arcs 還原成經緯度座標，回傳 (arc 取用函式)"""
    tf = topo.get('transform')
    arcs = []
    for a in topo['arcs']:
        pts, x, y = [], 0, 0
        for p in a:
            if tf:
                x += p[0]; y += p[1]
                pts.append((x * tf['scale'][0] + tf['translate'][0], y * tf['scale'][1] + tf['translate'][1]))
            else:
                pts.append((p[0], p[1]))
        arcs.append(pts)
    return lambda i: arcs[i] if i >= 0 else arcs[~i][::-1]


def rings_of(geom, arc):
    polys = geom['arcs'] if geom['type'] == 'MultiPolygon' else [geom['arcs']] if geom['type'] == 'Polygon' else []
    out = []
    for poly in polys:
        for r in poly:
            pts = []
            for i in r:
                p = arc(i)
                pts.extend(p if not pts else p[1:])
            out.append(pts)
    return out


def clip(ring, box):
    """Sutherland–Hodgman：把多邊形裁到矩形內（填色用，邊界上的退化邊沒關係）"""
    x0, y0, x1, y1 = box
    edges = [
        (lambda p: p[0] >= x0, lambda a, b: (x0, a[1] + (b[1] - a[1]) * (x0 - a[0]) / (b[0] - a[0]))),
        (lambda p: p[0] <= x1, lambda a, b: (x1, a[1] + (b[1] - a[1]) * (x1 - a[0]) / (b[0] - a[0]))),
        (lambda p: p[1] >= y0, lambda a, b: (a[0] + (b[0] - a[0]) * (y0 - a[1]) / (b[1] - a[1]), y0)),
        (lambda p: p[1] <= y1, lambda a, b: (a[0] + (b[0] - a[0]) * (y1 - a[1]) / (b[1] - a[1]), y1)),
    ]
    pts = ring
    for inside, cut in edges:
        if not pts:
            break
        res = []
        for i, cur in enumerate(pts):
            prev = pts[i - 1]
            if inside(cur):
                if not inside(prev):
                    res.append(cut(prev, cur))
                res.append(cur)
            elif inside(prev):
                res.append(cut(prev, cur))
        pts = res
    return pts


def simplify(pts, tol):
    """Douglas–Peucker（經緯度直接當平面算，台灣附近夠用）"""
    if len(pts) < 5:
        return pts
    keep = [False] * len(pts)
    keep[0] = keep[-1] = True
    # 封閉環的頭尾是同一點，先用離起點最遠的點切成兩段
    far = max(range(len(pts)), key=lambda i: (pts[i][0] - pts[0][0]) ** 2 + (pts[i][1] - pts[0][1]) ** 2)
    keep[far] = True
    stack = [(0, far), (far, len(pts) - 1)]
    while stack:
        a, b = stack.pop()
        (ax, ay), (bx, by) = pts[a], pts[b]
        dx, dy = bx - ax, by - ay
        L = math.hypot(dx, dy) or 1e-12
        best, bi = 0.0, -1
        for i in range(a + 1, b):
            d = abs(dy * (pts[i][0] - ax) - dx * (pts[i][1] - ay)) / L
            if d > best:
                best, bi = d, i
        if best > tol and bi > 0:
            keep[bi] = True
            stack += [(a, bi), (bi, b)]
    return [p for p, k in zip(pts, keep) if k]


def merc(p):
    lon, lat = p
    lat = max(-85, min(85, lat))
    u = (lon + 180) / 360
    v = 0.5 - math.log(math.tan(math.pi / 4 + math.radians(lat) / 2)) / (2 * math.pi)
    return u, v


def pack(ring, q):
    """一個環壓成整數陣列：[x0, y0, dx1, dy1, ...]（單位 Mercator × q，之後每點存和前一點的差）"""
    out, px, py = [], 0, 0
    for p in ring:
        u, v = merc(p)
        x, y = round(u * q), round(v * q)
        if out and x == px and y == py:
            continue
        out += [x - px, y - py]
        px, py = x, y
    return out


def main():
    os.makedirs(OUT, exist_ok=True)
    tw = fetch(TW_URL)
    with open(os.path.join(OUT, 'tw-counties.json'), 'w', encoding='utf-8') as f:
        json.dump(tw, f, ensure_ascii=False, separators=(',', ':'))

    arc = decode(tw)
    tw_rings = [simplify(r, 0.0003) for r in rings_of(tw['objects']['nation']['geometries'][0], arc)]

    world = fetch(WORLD_URL)
    warc = decode(world)
    fog = []
    for g in world['objects']['countries']['geometries']:
        if g.get('id') == '158':  # 台灣本身不上迷霧
            continue
        for r in rings_of(g, warc):
            xs = [p[0] for p in r]; ys = [p[1] for p in r]
            if max(xs) < FOG_BOX[0] or min(xs) > FOG_BOX[2] or max(ys) < FOG_BOX[1] or min(ys) > FOG_BOX[3]:
                continue
            c = clip(r, FOG_BOX)
            if len(c) >= 3:
                fog.append(simplify(c + [c[0]], 0.003))

    # 迷霧邊緣會模糊，精度 1e-6（縮到最大約差幾個像素）就夠；台灣本身用 1e-7
    # box：這份資料涵蓋的範圍（單位 Mercator），範圍內的陸海以這些多邊形為準（地形繪製用來修正海岸）
    b0, b1 = merc((FOG_BOX[0], FOG_BOX[3])), merc((FOG_BOX[2], FOG_BOX[1]))
    out = {'q': {'fog': 1e6, 'tw': 1e7}, 'box': [round(b0[0], 7), round(b0[1], 7), round(b1[0], 7), round(b1[1], 7)],
           'fog': [p for p in (pack(r, 1e6) for r in fog) if len(p) >= 6],
           'tw': [p for p in (pack(r, 1e7) for r in tw_rings) if len(p) >= 6]}
    with open(os.path.join(OUT, 'tw-fog.json'), 'w', encoding='utf-8') as f:
        json.dump(out, f, separators=(',', ':'))
    print('fog rings', len(out['fog']), 'pts', sum(map(len, out['fog'])) // 2, '| tw rings', len(out['tw']), 'pts', sum(map(len, out['tw'])) // 2)


if __name__ == '__main__':
    main()
