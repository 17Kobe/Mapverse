/* 地緣動畫場景（「地緣」篩選才顯示）：在地圖上用小動畫演出三則新聞的局勢，局勢（markets.json 卡片的 tone：
 * ok 緩和 / warn 緊張 / bad 衝突）改了，動畫的樣子也跟著變，不用另外改程式。
 *   美伊衝突：油輪沿波斯灣 → 荷莫茲海峽 → 紅海航道移動；緊張時船變少、變慢、船身變色，衝突時在海峽前排隊停下，
 *             偶爾放行一艘，並遭飛彈攻擊起火冒煙。
 *   俄烏戰爭：雙方無人機飛向油庫（煉油廠），命中後爆炸、起火冒黑煙；停火時不再出動，換成白旗。
 *   美中貿易：貨櫃船經過收費站，每艘都要繳關稅（金幣飛向收費站）；休戰時關卡柵欄大多抬起、只收一點，戰火升高時柵欄放下、收很多。
 * 全部畫在 SVG（螢幕座標），航線以經緯度定義，每次地圖移動 / 縮放時 layout() 重新投影；step() 每幀只改位置。
 * 航線都用 50m 陸地資料驗證過不會穿過陸地（見 GeoScenes.data）。
 * 之後要加新場景：在 DATA 加航線 / 座標，照 laneScene（航線型）或 droneScene（定點打擊型）新增一個場景即可。 */
(function () {
  'use strict';

  const NS = 'http://www.w3.org/2000/svg';
  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  // 局勢顏色：緩和綠 / 緊張橘 / 衝突紅（和地緣卡片的色帶同一組色系）
  const TONE = { ok: '#3ddc84', warn: '#ffb02e', bad: '#ff5148' };
  const FONT =
    'font-family:var(--font);font-weight:800;text-anchor:middle;paint-order:stroke;stroke:rgba(5,10,22,.88);stroke-width:2.6px;stroke-linejoin:round;fill:#fff;pointer-events:none';

  /* ---------- 資料：航線 [經度, 緯度]（都在海上，用 50m 陸地資料驗證過）---------- */
  // 波斯灣 → 荷莫茲海峽 → 阿曼灣（兩條航線共用的主幹）
  const TRUNK = [[50.8, 27.2], [52.0, 27.0], [53.0, 26.7], [54.2, 26.5], [55.6, 26.38], [56.45, 26.56], [56.8, 26.0], [57.2, 25.35]];
  // 往東：阿拉伯海 → 印度 / 亞洲
  const EAST = [[58.6, 24.6], [60.5, 24.0], [62.5, 23.4], [64.5, 22.7], [66.6, 21.7], [68.3, 20.6]];
  // 往西：阿拉伯海 → 亞丁灣 → 曼德海峽 → 紅海 → 蘇伊士
  const WEST = [
    [58.9, 24.2], [61.0, 22.5], [60.2, 19.2], [57.0, 17.0], [53.5, 15.2], [50.0, 13.6], [47.0, 12.5], [44.6, 12.15], [43.9, 12.3],
    [43.45, 12.42], [43.27, 12.65], [43.15, 12.95], [42.8, 13.5], [42.2, 14.3], [41.6, 15.0], [41.0, 16.0], [40.6, 17.0],
    [40.1, 18.0], [39.3, 19.0], [38.9, 20.0], [38.2, 21.0], [38.0, 22.0], [37.3, 23.0], [36.9, 24.0], [36.1, 25.0],
    [35.5, 26.0], [34.9, 27.0], [34.4, 27.6], [33.7, 28.0], [33.5, 28.3], [33.1, 28.6], [32.9, 29.0], [32.7, 29.5], [32.6, 29.85]
  ];
  // 上海外海 → 東海 → 吐噶喇海峽 → 日本南方（貨櫃船往來美國的第一段）
  const TRADE = [[123.0, 30.9], [126.0, 30.2], [127.5, 29.6], [129.4, 28.8], [132.5, 29.8], [135.8, 31.8], [139.0, 33.2]];

  const DATA = {
    routes: { hormuzEast: TRUNK.concat(EAST), hormuzWest: TRUNK.concat(WEST), trade: TRADE },
    // 讓「地緣」篩選的視野一併涵蓋整條紅海航道與東端（app.js 的 regionTransform 會讀）
    anchors: [[43.3, 12.6], [68.3, 20.6]],
    // 烏俄雙方的出擊點與油庫（座標都在陸地上）
    ua: {
      launch: [[36.3, 49.8], [34.8, 50.9], [35.0, 48.4], [32.0, 46.9]],
      depots: [[33.42, 49.07], [30.74, 46.48], [36.23, 49.99]]
    },
    ru: {
      launch: [[36.2, 51.7], [38.0, 47.2], [34.1, 45.3], [34.4, 53.2]],
      depots: [[36.58, 50.6], [39.2, 51.7], [39.07, 44.1], [37.77, 44.72], [44.52, 48.7]]
    },
    flag: [37.6, 47.7]
  };

  let H = null, root = null, fxG = null, scenes = [], on = false;
  
  /* ---------- 小工具 ---------- */
  function rng(seed) {
    let s = seed >>> 0 || 1;
    return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
  }
  function el(parent, tag, attrs) {
    const e = document.createElementNS(NS, tag);
    if (attrs) for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  const f1 = (n) => n.toFixed(1);
  function place(e, x, y, rot, sx, sy) {
    let s = `translate(${f1(x)} ${f1(y)})`;
    if (rot) s += ` rotate(${f1(rot)})`;
    if (sx !== undefined) s += ` scale(${sx.toFixed(3)} ${(sy === undefined ? sx : sy).toFixed(3)})`;
    e.setAttribute('transform', s);
  }
  const show = (e, v) => {
    const d = v ? '' : 'none';
    if (e.style.display !== d) e.style.display = d;
  };
  const T = (s) => (H && H.t ? H.t(s) : s);

  // 經緯度折線 → 螢幕折線。世界會左右循環，所以每個點都接在前一點旁邊（跨日期變更線也連得起來）
  function buildPath(geo) {
    const W = H.worldW(), pts = [];
    let px = null;
    for (const [lo, la] of geo) {
      const p = H.toScreen(lo, la);
      let x = p[0];
      if (px !== null) {
        while (x - px > W / 2) x -= W;
        while (px - x > W / 2) x += W;
      }
      pts.push({ x, y: p[1] });
      px = x;
    }
    const cum = [0];
    for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
    return { pts, cum, L: cum[cum.length - 1] };
  }
  // 折線上距離起點 s 的位置與方向
  function at(P, s, o) {
    s = clamp(s, 0, P.L);
    const c = P.cum;
    let lo = 0, hi = c.length - 1;
    while (hi - lo > 1) {
      const m = (lo + hi) >> 1;
      if (c[m] <= s) lo = m;
      else hi = m;
    }
    const a = P.pts[lo], b = P.pts[hi], seg = c[hi] - c[lo] || 1, f = (s - c[lo]) / seg;
    o.x = a.x + (b.x - a.x) * f;
    o.y = a.y + (b.y - a.y) * f;
    o.dx = (b.x - a.x) / seg;
    o.dy = (b.y - a.y) / seg;
    return o;
  }
  // 點投影到折線上，回傳沿線距離
  function snap(P, x, y) {
    let best = Infinity, bd = 0;
    for (let i = 0; i < P.pts.length - 1; i++) {
      const a = P.pts[i], b = P.pts[i + 1], vx = b.x - a.x, vy = b.y - a.y, s2 = vx * vx + vy * vy || 1;
      const t = clamp(((x - a.x) * vx + (y - a.y) * vy) / s2, 0, 1);
      const d = (a.x + vx * t - x) ** 2 + (a.y + vy * t - y) ** 2;
      if (d < best) {
        best = d;
        bd = P.cum[i] + t * Math.sqrt(s2);
      }
    }
    return bd;
  }
  const bboxOf = (pts) => {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const p of pts) {
      x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y);
    }
    return { x0, y0, x1, y1 };
  };

  /* ---------- 圖形（座標單位：船長約 24，原點在水線正中央，船頭朝右）---------- */
  function buildTanker(parent, laden) {
    const g = el(parent, 'g');
    el(g, 'path', { d: 'M-13,1 L-32,-0.4 L-32,2.9 Z', fill: '#fff', 'fill-opacity': 0.42 });
    el(g, 'path', { d: 'M-13,-1.6 H13 L15.8,-1.6 L11,3.9 H-11.6 Z', fill: '#27324a', stroke: '#0b1220', 'stroke-width': 0.6 });
    const ac = el(g, 'rect', { x: -12.4, y: 1.5, width: 23.4, height: 1.3, fill: TONE.ok });
    // 甲板上的油艙與管線
    const tank = laden ? '#4a3a33' : '#c9d2de';
    for (let i = 0; i < 3; i++)
      el(g, 'rect', { x: -4.2 + i * 5.4, y: -3.7, width: 4.6, height: 2.2, rx: 1, fill: tank, stroke: '#0b1220', 'stroke-width': 0.4 });
    el(g, 'line', { x1: -4.5, y1: -4.2, x2: 12.5, y2: -4.2, stroke: '#8795ab', 'stroke-width': 0.6 });
    // 船尾的駕駛艙與煙囪
    el(g, 'rect', { x: -12.4, y: -7.6, width: 6.4, height: 6, rx: 0.6, fill: '#f2f4f8', stroke: '#6f7c93', 'stroke-width': 0.5 });
    el(g, 'rect', { x: -11.6, y: -6.5, width: 4.8, height: 1.1, fill: '#3b5b8c' });
    const fn = el(g, 'rect', { x: -10.2, y: -10, width: 2.4, height: 2.5, fill: TONE.ok });
    const bc = el(g, 'circle', { cx: -9, cy: -11.3, r: 1.1, fill: TONE.ok });
    // 起火（平常隱藏）
    const fl = el(g, 'g', { style: 'display:none' });
    for (const x of [1, 6.5]) {
      const f = el(fl, 'g');
      f.setAttribute('transform', `translate(${x} -4)`);
      el(f, 'path', { d: 'M0,0 C-2.6,-2.2 -1.4,-5 0,-8 C1.4,-5 2.6,-2.2 0,0Z', fill: '#ff8a1f' });
      el(f, 'path', { d: 'M0,0 C-1.2,-1.2 -0.6,-3 0,-4.4 C0.6,-3 1.2,-1.2 0,0Z', fill: '#ffe066' });
    }
    return { g, accents: [ac, fn], bc, flames: fl };
  }
  const BOX = ['#e4572e', '#2e86de', '#f6c026', '#27ae60', '#8e44ad', '#ecf0f1', '#e67e22'];
  function buildContainerShip(parent, rand) {
    const g = el(parent, 'g');
    el(g, 'path', { d: 'M-14,1 L-33,-0.4 L-33,2.9 Z', fill: '#fff', 'fill-opacity': 0.42 });
    el(g, 'path', { d: 'M-14.4,-1.5 H14 L17.2,-1.5 L12,4 H-12.8 Z', fill: '#1c2b45', stroke: '#0b1220', 'stroke-width': 0.6 });
    const ac = el(g, 'rect', { x: -13.6, y: 1.5, width: 25.2, height: 1.3, fill: TONE.ok });
    // 貨櫃堆：每一欄 1～3 層，顏色隨機
    for (let c = 0; c < 5; c++) {
      const rows = 1 + Math.floor(rand() * 3);
      for (let r = 0; r < rows; r++)
        el(g, 'rect', { x: -7.6 + c * 4.3, y: -1.5 - (r + 1) * 2.2, width: 4, height: 2.1, fill: BOX[Math.floor(rand() * BOX.length)], stroke: '#0b1220', 'stroke-width': 0.35 });
    }
    el(g, 'rect', { x: -14.4, y: -8.6, width: 5.4, height: 7.1, rx: 0.6, fill: '#f2f4f8', stroke: '#6f7c93', 'stroke-width': 0.5 });
    el(g, 'rect', { x: -13.6, y: -7.5, width: 3.8, height: 1.1, fill: '#3b5b8c' });
    const fn = el(g, 'rect', { x: -12.4, y: -11, width: 2.4, height: 2.5, fill: TONE.ok });
    return { g, accents: [ac, fn], bc: null, flames: null };
  }
  // 油庫：兩座儲油槽 + 管線；起火時冒火焰與黑煙
  function buildDepot(parent) {
    const g = el(parent, 'g');
    el(g, 'ellipse', { cx: 0, cy: 0.5, rx: 10, ry: 2.4, fill: '#0f1a08', opacity: 0.4 });
    const scorch = el(g, 'ellipse', { cx: 0, cy: 0, rx: 9, ry: 2.2, fill: '#15110d', opacity: 0 });
    const tanks = [];
    for (const [x, w, h] of [[-6, 6, 5.5], [2, 7, 6.5]]) {
      const t = el(g, 'g');
      const body = el(t, 'rect', { x, y: -h, width: w, height: h, fill: '#b7c0cd', stroke: '#2a3340', 'stroke-width': 0.6 });
      const top = el(t, 'ellipse', { cx: x + w / 2, cy: -h, rx: w / 2, ry: 1.3, fill: '#dde3ea', stroke: '#2a3340', 'stroke-width': 0.5 });
      el(t, 'rect', { x, y: -h * 0.55, width: w, height: 0.9, fill: '#e0453a', opacity: 0.85 });
      tanks.push({ body, top, x: x + w / 2, y: -h });
    }
    el(g, 'line', { x1: -0.5, y1: -2, x2: 2, y2: -2, stroke: '#4a5566', 'stroke-width': 0.9 });
    const fire = el(g, 'g', { style: 'display:none' });
    const flames = tanks.map((t, i) => {
      const f = el(fire, 'g');
      f.setAttribute('transform', `translate(${t.x} ${t.y})`);
      el(f, 'path', { d: 'M0,0 C-3.2,-2.4 -1.6,-5.8 0,-9.5 C1.6,-5.8 3.2,-2.4 0,0Z', fill: '#ff7a1a' });
      el(f, 'path', { d: 'M0,0 C-1.6,-1.4 -0.8,-3.4 0,-5.2 C0.8,-3.4 1.6,-1.4 0,0Z', fill: '#ffe066' });
      return f;
    });
    const smoke = [];
    for (let i = 0; i < 6; i++) smoke.push(el(g, 'circle', { r: 1, fill: '#262a31', opacity: 0, style: 'display:none' }));
    return { g, scorch, tanks, fire, flames, smoke };
  }
  function buildDrone(parent, side) {
    const g = el(parent, 'g');
    const col = side === 'ua' ? '#ffd23f' : '#d6dde8';
    el(g, 'path', { d: 'M7.5,0 L-5.5,-6 L-3.5,0 L-5.5,6 Z', fill: col, stroke: '#171c26', 'stroke-width': 0.8, 'stroke-linejoin': 'round' });
    el(g, 'line', { x1: -3.5, y1: 0, x2: 4.5, y2: 0, stroke: '#171c26', 'stroke-width': 0.8 });
    el(g, 'circle', { cx: -6.6, cy: 0, r: 1.5, fill: '#ff8a1f' });
    return g;
  }

  /* ---------- 爆炸 / 飛彈軌跡（所有場景共用的小特效，座標是螢幕座標）---------- */
  const bursts = [];
  function buildFx() {
    fxG = el(root, 'g', { class: 'gs-fx' });
    for (let i = 0; i < 8; i++) {
      const g = el(fxG, 'g', { style: 'display:none' });
      const ring = el(g, 'circle', { r: 1, fill: 'none', stroke: '#ffd37a', 'stroke-width': 1.6 });
      const img = el(g, 'image', { href: 'assets/icons/collision.png', preserveAspectRatio: 'xMidYMid meet' });
      bursts.push({ g, ring, img, age: 99, dur: 0.9, x: 0, y: 0, u: 1 });
    }
  }
  function burst(x, y, u) {
    let b = bursts.find((q) => q.age >= q.dur);
    if (!b) b = bursts.reduce((a, c) => (c.age > a.age ? c : a));
    Object.assign(b, { age: 0, x, y, u });
    show(b.g, true);
  }
  function stepBursts(dt) {
    for (const b of bursts) {
      if (b.age >= b.dur) continue;
      b.age += dt;
      const p = clamp(b.age / b.dur, 0, 1);
      if (p >= 1) {
        show(b.g, false);
        continue;
      }
      const s = b.u * (0.5 + p * 1.1);
      b.g.setAttribute('transform', `translate(${f1(b.x)} ${f1(b.y)})`);
      b.img.setAttribute('x', f1(-s * 0.9));
      b.img.setAttribute('y', f1(-s * 1.5));
      b.img.setAttribute('width', f1(s * 1.8));
      b.img.setAttribute('height', f1(s * 1.8));
      b.img.setAttribute('opacity', (p < 0.55 ? 1 : 1 - (p - 0.55) / 0.45).toFixed(2));
      b.ring.setAttribute('r', f1(b.u * (0.4 + p * 2.2)));
      b.ring.setAttribute('opacity', (1 - p).toFixed(2));
    }
  }
  // 飛彈 / 無人機後面的軌跡：記下最近幾個位置畫成漸淡的折線
  function makeTrail(parent, color, w) {
    const pl = el(parent, 'polyline', { fill: 'none', stroke: color, 'stroke-width': w, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', opacity: 0.6 });
    return { pl, pts: [], push(x, y) { this.pts.push(x, y); if (this.pts.length > 18) this.pts.splice(0, 2); this.pl.setAttribute('points', this.pts.map(f1).join(' ')); }, clear() { this.pts.length = 0; this.pl.setAttribute('points', ''); } };
  }

  /* ---------- 航線型場景（油輪 / 貨櫃船）---------- */
  // 局勢決定的參數：out / in 去程、回程船數；speed 速度倍率；dwell 收費站每艘停留秒數；coins 每艘繳的金幣數
  const HORMUZ = {
    id: 'hormuz', card: 'geo-iran', kind: 'tanker', seed: 11,
    // 每艘船走哪條航線（去程 = 載滿油從波斯灣出發，回程 = 空船返回）
    out: ['hormuzWest', 'hormuzEast', 'hormuzWest', 'hormuzWest', 'hormuzEast', 'hormuzWest', 'hormuzEast', 'hormuzWest', 'hormuzWest', 'hormuzEast', 'hormuzWest', 'hormuzEast'],
    in: ['hormuzWest', 'hormuzEast', 'hormuzWest', 'hormuzEast', 'hormuzWest', 'hormuzWest', 'hormuzEast', 'hormuzWest'],
    gates: [
      { id: 'hormuz', type: 'choke', geo: [56.45, 26.56], routes: ['hormuzEast', 'hormuzWest'] },
      { id: 'bab', type: 'choke', geo: [43.27, 12.65], routes: ['hormuzWest'] }
    ],
    params: {
      ok: { out: 12, in: 8, speed: 1 },
      warn: { out: 8, in: 4, speed: 0.6 },
      bad: { out: 7, in: 0, speed: 0.38 }
    },
    attack: { launch: [56.2, 27.45] }
  };
  const TRADE_LANE = {
    id: 'trade', card: 'geo-trade', kind: 'container', seed: 23,
    out: ['trade', 'trade', 'trade', 'trade', 'trade', 'trade', 'trade'],
    in: ['trade', 'trade', 'trade', 'trade', 'trade', 'trade'],
    gates: [{ id: 'toll', type: 'toll', geo: [126.0, 30.2], routes: ['trade'] }],
    params: {
      ok: { out: 6, in: 5, speed: 0.8, dwell: 0.45, coins: 2 },
      warn: { out: 6, in: 4, speed: 0.65, dwell: 1.5, coins: 5 },
      bad: { out: 5, in: 3, speed: 0.5, dwell: 2.8, coins: 9 }
    }
  };

  // 海峽什麼時候放行：緩和 = 一直通；緊張 = 每 16 秒關 5 秒；衝突 = 每 24 秒只開 1.8 秒（偷渡一兩艘）
  function chokeOpen(id, tone, t) {
    if (tone === 'ok') return true;
    const off = id === 'bab' ? 7 : 0;
    if (tone === 'warn') return (t + off) % 16 < 11;
    return (t + off) % (id === 'bab' ? 20 : 24) < 1.8;
  }

  function laneScene(def) {
    const g = el(root, 'g', { class: 'gs gs-' + def.id });
    const rand = rng(def.seed);
    const sc = { def, g, tone: 'warn', routes: {}, gates: [], ships: [], coins: [], size: 14, vis: false, fitN: 99, bb: null, evt: 6 + rand() * 4, missiles: [], stat: false };
    // 關卡標記
    for (const gd of def.gates) {
      const gt = { ...gd, d: {}, x: 0, y: 0, open: true, busy: false, g: el(g, 'g', { style: 'display:none' }) };
      if (gd.type === 'choke') {
        gt.ring = el(gt.g, 'circle', { r: 7, fill: 'rgba(255,60,50,.14)', stroke: TONE.bad, 'stroke-width': 1.5, 'stroke-dasharray': '3 2.2' });
        gt.bar = el(gt.g, 'line', { x1: -4.6, y1: 4.6, x2: 4.6, y2: -4.6, stroke: TONE.bad, 'stroke-width': 1.9, 'stroke-linecap': 'round' });
        gt.lab = el(gt.g, 'text', { y: 15, 'font-size': 8.5, style: FONT });
      } else {
        // 收費站：小屋 + 招牌 + 柵欄
        const b = el(gt.g, 'g');
        el(b, 'rect', { x: -5, y: -6, width: 10, height: 8, rx: 1, fill: '#e9edf3', stroke: '#4a5566', 'stroke-width': 0.7 });
        el(b, 'rect', { x: -6, y: -8.6, width: 12, height: 3, rx: 1, fill: '#d8453a', stroke: '#4a5566', 'stroke-width': 0.7 });
        el(b, 'rect', { x: -3, y: -4.2, width: 6, height: 2.6, fill: '#3b5b8c' });
        gt.sign = el(gt.g, 'g');
        gt.signBg = el(gt.sign, 'rect', { x: -12, y: -4.8, width: 24, height: 9.6, rx: 2.4, fill: '#10182b', stroke: TONE.ok, 'stroke-width': 1.3 });
        gt.signT = el(gt.sign, 'text', { y: 2.6, 'font-size': 7.5, style: 'font-family:var(--font);font-weight:800;text-anchor:middle;fill:#fff;pointer-events:none' });
        gt.arm = el(gt.g, 'g');
        el(gt.arm, 'line', { x1: 0, y1: 0, x2: 17, y2: 0, stroke: '#f4f4f4', 'stroke-width': 2.6, 'stroke-linecap': 'round' });
        el(gt.arm, 'line', { x1: 3, y1: 0, x2: 17, y2: 0, stroke: '#d8453a', 'stroke-width': 2.6, 'stroke-dasharray': '3.4 3.4' });
        gt.armOpen = 0; // 0 = 放下，1 = 抬起
      }
      sc.gates.push(gt);
    }
    // 船
    const mkShip = (route, dir, rank, n) => {
      const outer = el(g, 'g', { style: 'display:none' });
      const body = def.kind === 'tanker' ? buildTanker(outer, dir > 0) : buildContainerShip(outer, rand);
      // 起火後冒的黑煙（不跟著船翻面，所以放在 outer）
      const smoke = [];
      if (def.kind === 'tanker') for (let i = 0; i < 4; i++) smoke.push(el(outer, 'circle', { r: 1, fill: '#262a31', opacity: 0, style: 'display:none' }));
      sc.ships.push({ outer, body, smoke, route, dir, rank, on: false, s: 0, f: (rank + rand() * 0.6) / n, seeded: false, v: 0.88 + rand() * 0.24, ph: rand() * TAU, paid: {}, dwell: 0, fire: 0, stuck: false, o: { x: 0, y: 0, dx: 1, dy: 0 } });
    };
    def.out.forEach((r, i) => mkShip(r, 1, i, def.out.length));
    def.in.forEach((r, i) => mkShip(r, -1, i, def.in.length));
    if (def.kind === 'container') for (let i = 0; i < 16; i++) {
      const c = el(g, 'g', { style: 'display:none' });
      el(c, 'circle', { r: 3.6, fill: '#ffd23f', stroke: '#9a6a00', 'stroke-width': 0.9 });
      el(c, 'text', { y: 2.2, 'font-size': 5.6, style: 'font-family:var(--font);font-weight:800;text-anchor:middle;fill:#7a4f00;pointer-events:none' }).textContent = '$';
      sc.coins.push({ g: c, t: 99, delay: 0, sx: 0, sy: 0 });
    }
    if (def.attack) {
      for (let i = 0; i < 2; i++) {
        const m = el(g, 'g', { style: 'display:none' });
        const trail = makeTrail(m, '#fff1c9', 1.6);
        const head = el(m, 'circle', { r: 2.1, fill: '#ff8a1f', stroke: '#fff', 'stroke-width': 0.8 });
        sc.missiles.push({ g: m, trail, head, on: false, t: 0, dur: 1, x0: 0, y0: 0, ship: null });
      }
    }
    sc.layout = layoutLane;
    sc.step = stepLane;
    scenes.push(sc);
    return sc;
  }

  function layoutLane(sc) {
    const def = sc.def;
    const k = H.zoom();
    sc.size = clamp(12 + k * 1.3, 14, 24);
    const u = sc.size / 24;
    let all = [], Lmax = 0;
    for (const key of new Set(def.out.concat(def.in))) {
      const P = buildPath(DATA.routes[key]);
      sc.routes[key] = P;
      all = all.concat(P.pts);
      Lmax = Math.max(Lmax, P.L);
    }
    sc.bb = bboxOf(all);
    const [W, Hh] = H.size(), m = sc.size * 2;
    sc.vis = sc.bb.x1 > -m && sc.bb.x0 < W + m && sc.bb.y1 > -m && sc.bb.y0 < Hh + m;
    show(sc.g, sc.vis);
    if (!sc.vis) return;
    // 航線太短（縮小的世界）就少放幾艘，不要擠成一團
    sc.fitN = Math.max(1, Math.round(Lmax / (sc.size * 1.9)));
    for (const gt of sc.gates) {
      const p = H.toScreen(gt.geo[0], gt.geo[1]);
      // 關卡位置接在第一條航線旁邊的世界副本，才會和船走的那份世界對齊
      const P0 = sc.routes[gt.routes[0]], Wd = H.worldW();
      while (p[0] - P0.pts[0].x > Wd / 2) p[0] -= Wd;
      while (P0.pts[0].x - p[0] > Wd / 2) p[0] += Wd;
      const base = snap(P0, p[0], p[1]);
      const q = at(P0, base, { x: 0, y: 0, dx: 1, dy: 0 });
      gt.x = q.x;
      gt.y = q.y;
      gt.tx = q.dx;
      gt.ty = q.dy;
      for (const r of gt.routes) gt.d[r] = snap(sc.routes[r], q.x, q.y);
      if (gt.type === 'toll') {
        // 收費站蓋在航道南側（螢幕下方）
        const nx = -q.dy, ny = q.dx, sgn = ny >= 0 ? 1 : -1;
        gt.bx = q.x + nx * sgn * sc.size * 0.75;
        gt.by = q.y + ny * sgn * sc.size * 0.75;
        gt.ang0 = Math.atan2(-ny * sgn, -nx * sgn); // 放下 = 橫過航道
        const open = Math.atan2(q.dy, q.dx);
        // 抬起 = 順著航道方向（取和放下相差 90 度中，朝航道前進方向那個）
        gt.ang1 = gt.ang0 + (Math.sin(open - gt.ang0) >= 0 ? Math.PI / 2 : -Math.PI / 2);
        place(gt.g, gt.bx, gt.by, 0, u * 1.25);
        gt.sx = gt.bx;
        gt.sy = gt.by - 14 * u * 1.25; // 金幣飛向招牌
      } else {
        place(gt.g, gt.x, gt.y, 0, u * 1.25);
      }
    }
    // 縮放後航線長度改變：用進度比例換算回距離
    for (const sh of sc.ships) sh.s = sh.f * sc.routes[sh.route].L;
    renderLane(sc, 0);
  }

  function renderLane(sc, t) {
    const tone = sc.tone, col = TONE[tone], u = sc.size / 24;
    const prm = sc.def.params[tone];
    const lim = { 1: Math.min(prm.out, sc.fitN), '-1': Math.min(prm.in, sc.fitN) };
    for (const gt of sc.gates) {
      if (gt.type === 'choke') {
        // 海峽標記：緩和時不顯示；緊張 / 衝突時閃爍，關閉中畫紅色禁止符號，放行窗口畫橘色圓圈
        const showG = tone !== 'ok';
        show(gt.g, showG);
        if (showG) {
          const shut = !gt.open;
          gt.ring.setAttribute('stroke', shut ? TONE.bad : TONE.warn);
          gt.ring.setAttribute('fill', shut ? 'rgba(255,60,50,.16)' : 'rgba(255,176,46,.14)');
          gt.bar.setAttribute('opacity', shut ? 1 : 0);
          gt.g.setAttribute('opacity', (0.72 + Math.sin(t * 4) * 0.28).toFixed(2));
          gt.lab.textContent = shut ? T(tone === 'bad' ? '封鎖' : '通行受限') : '';
        }
      } else {
        show(gt.g, true);
        gt.signBg.setAttribute('stroke', col);
        gt.signT.textContent = T('關稅');
        const a = lerp(gt.ang0, gt.ang1, gt.armOpen);
        gt.arm.setAttribute('transform', `rotate(${(a * 180 / Math.PI).toFixed(1)})`);
        place(gt.sign, 0, -14, 0, 1 + clamp(gt.pop || 0, 0, 1) * 0.28);
      }
    }
    for (const sh of sc.ships) {
      // 目前這個局勢要不要有這艘：被淘汰的船走完這趟就消失
      // 靜態（關閉動畫）：只擺出符合局勢數量的船
      if (sc.stat) sh.on = sh.rank < lim[sh.dir];
      show(sh.outer, sh.on);
      if (!sh.on) continue;
      const P = sc.routes[sh.route];
      const a = at(P, sh.dir > 0 ? sh.s : P.L - sh.s, sh.o);
      const dx = a.dx * sh.dir, dy = a.dy * sh.dir;
      const sgn = dx >= 0 ? 1 : -1;
      const tilt = Math.atan2(sgn * dy, Math.abs(dx)) * 28;
      const bob = Math.sin(t * (sh.stuck ? 2.4 : 1.6) + sh.ph) * (sh.stuck ? 0.5 : 0.28) * u * 3;
      place(sh.outer, a.x, a.y + bob, 0);
      sh.body.g.setAttribute('transform', `rotate(${(tilt + Math.sin(t * 1.3 + sh.ph) * 1.4).toFixed(1)}) scale(${(sgn * u).toFixed(3)} ${u.toFixed(3)})`);
      // 兩端淡入淡出；船身顏色依局勢
      const edge = sc.size * 1.2;
      const fade = clamp(Math.min(sh.s, P.L - sh.s) / edge, 0, 1);
      sh.outer.setAttribute('opacity', fade.toFixed(2));
      for (const ac of sh.body.accents) ac.setAttribute('fill', sh.fire > 0 ? TONE.bad : col);
      if (sh.body.bc) {
        const blink = sh.stuck || sh.fire > 0 ? (Math.sin(t * 9 + sh.ph) > 0 ? 1 : 0.15) : 1;
        sh.body.bc.setAttribute('fill', sh.fire > 0 ? TONE.bad : col);
        sh.body.bc.setAttribute('opacity', blink);
      }
      if (sh.body.flames) {
        show(sh.body.flames, sh.fire > 0);
        if (sh.fire > 0) {
          const fl = sh.body.flames.childNodes;
          fl.forEach((f, i) => f.setAttribute('transform', `translate(${i ? 6.5 : 1} -4) scale(${(0.8 + Math.sin(t * 15 + i * 2) * 0.22).toFixed(2)} ${(0.9 + Math.sin(t * 11 + i) * 0.3).toFixed(2)})`));
        }
      }
      // 黑煙：4 團循環往上飄、變大變淡
      if (sh.smoke.length) {
        const burning = sh.fire > 0;
        sh.smoke.forEach((c, i) => {
          show(c, burning);
          if (!burning) return;
          const p = (t * 0.45 + i / sh.smoke.length) % 1;
          c.setAttribute('cx', f1((Math.sin(t * 2 + i * 1.7) * 2 + p * 5) * u * 1.4));
          c.setAttribute('cy', f1(-(8 + p * 22) * u));
          c.setAttribute('r', f1((2 + p * 4.5) * u));
          c.setAttribute('opacity', ((1 - p) * 0.6).toFixed(2));
        });
      }
    }
    // 金幣
    for (const c of sc.coins) {
      if (c.t >= 1) {
        show(c.g, false);
        continue;
      }
      show(c.g, true);
      const p = clamp(c.t, 0, 1), gt = sc.gates[0];
      const x = lerp(c.sx, gt.sx, p), y = lerp(c.sy, gt.sy, p) - Math.sin(p * Math.PI) * sc.size * 1.1;
      place(c.g, x, y, 0, u * 1.9 * (1 - p * 0.3));
      c.g.setAttribute('opacity', (p > 0.85 ? (1 - p) / 0.15 : 1).toFixed(2));
    }
  }

  function stepLane(sc, dt, t) {
    const def = sc.def, tone = sc.tone, prm = def.params[tone];
    const size = sc.size, gap = size * 1.05, stopGap = size * 0.75, base = size * 1.5;
    const lim = { 1: Math.min(prm.out, sc.fitN), '-1': Math.min(prm.in, sc.fitN) };
    for (const gt of sc.gates) if (gt.type === 'choke') gt.open = chokeOpen(gt.id, tone, t);
    // 1. 該上場的船（局勢變多了）等航線起點空出來就下水
    for (const sh of sc.ships) {
      if (sh.on || sh.rank >= lim[sh.dir]) continue;
      const L = sc.routes[sh.route].L;
      if (!sh.seeded) {
        // 第一次：直接出現在航線上的各個位置，不用從起點一艘一艘排出來
        sh.seeded = true;
        sh.on = true;
        sh.s = sh.f * L;
        continue;
      }
      const clear = !sc.ships.some((o) => o.on && o.route === sh.route && o.dir === sh.dir && o.s < gap * 1.6);
      if (clear) {
        sh.on = true;
        sh.s = 0;
        sh.paid = {};
        sh.dwell = 0;
      }
    }
    // 2. 每艘船前方第一個擋住它的關卡，依距離排隊（同一個關卡、同方向的船共用一個隊伍）
    const queues = new Map();
    for (const sh of sc.ships) {
      sh.blk = null;
      sh.slow = Infinity;
      if (!sh.on) continue;
      const P = sc.routes[sh.route];
      let brem = Infinity;
      for (const gt of sc.gates) {
        const d = gt.d[sh.route];
        if (d === undefined) continue;
        const rem = (sh.dir > 0 ? d : P.L - d) - sh.s;
        if (rem < -1) continue; // 已經通過
        sh.slow = Math.min(sh.slow, rem);
        const allowed = gt.type === 'toll' ? sh.paid[gt.id] : gt.open;
        if (!allowed && rem < brem) {
          brem = rem;
          sh.blk = gt;
          sh.rem = rem;
        }
      }
      if (sh.blk) {
        const key = sh.blk.id + '|' + sh.dir;
        if (!queues.has(key)) queues.set(key, []);
        queues.get(key).push(sh);
      }
    }
    for (const gt of sc.gates) if (gt.type === 'toll') gt.busy = false;
    for (const q of queues.values()) {
      q.sort((a, b) => a.rem - b.rem);
      q.forEach((sh, i) => {
        sh.smax = sh.s + sh.rem - (stopGap + i * gap);
        const gt = sh.blk;
        // 收費站：排第一的船到站後停下來繳稅，繳完才放行
        if (gt.type === 'toll' && i === 0 && sh.rem <= stopGap + 2) {
          gt.busy = true;
          if (sh.dwell === 0) emitCoins(sc, sh, prm.coins);
          sh.dwell += dt;
          if (sh.dwell >= prm.dwell) {
            sh.paid[gt.id] = true;
            sh.dwell = 0;
            sh.blk = null;
          }
        }
      });
    }
    // 3. 前進
    for (const sh of sc.ships) {
      if (!sh.on) continue;
      const P = sc.routes[sh.route];
      let v = base * sh.v * prm.speed;
      // 靠近關卡（緩和以外）先減速
      if (tone !== 'ok' && sh.slow < size * 3) v *= 0.5 + 0.5 * clamp(sh.slow / (size * 3), 0, 1);
      if (sh.fire > 0) v *= 0.4;
      let ns = sh.s + v * dt;
      sh.stuck = false;
      if (sh.blk) {
        const cap = Math.max(sh.s, sh.smax);
        if (ns >= cap - 0.3) {
          ns = cap;
          sh.stuck = true;
        }
      }
      sh.s = ns;
      sh.f = ns / P.L;
      if (sh.fire > 0) sh.fire = Math.max(0, sh.fire - dt);
      if (sh.s >= P.L) {
        sh.s = 0;
        sh.f = 0;
        sh.paid = {};
        sh.dwell = 0;
        sh.fire = 0;
        sh.v = 0.88 + Math.random() * 0.24;
        if (sh.rank >= lim[sh.dir]) sh.on = false; // 這個局勢用不到的船，走完就收起來
      }
    }
    // 4. 收費站柵欄：有船在繳稅就放下，沒有就抬起；緩和時也是短暫放下一下
    for (const gt of sc.gates) {
      if (gt.type !== 'toll') continue;
      const target = gt.busy ? 0 : 1;
      gt.armOpen += clamp(target - gt.armOpen, -dt * 3.2, dt * 3.2);
    }
    // 5. 金幣與招牌的彈跳
    for (const gt of sc.gates) if (gt.pop > 0) gt.pop = Math.max(0, gt.pop - dt * 3);
    for (const c of sc.coins) if (c.t < 1) c.t = c.delay > 0 ? (c.delay -= dt, c.t) : c.t + dt / 0.85;
    // 6. 衝突時偶爾有飛彈擊中船
    if (def.attack && tone === 'bad') attackStep(sc, dt);
    stepMissiles(sc, dt);
    renderLane(sc, t);
  }

  function emitCoins(sc, sh, n) {
    const gt = sc.gates.find((x) => x.type === 'toll');
    for (let i = 0; i < n; i++) {
      const c = sc.coins.find((q) => q.t >= 1);
      if (!c) break;
      c.t = 0;
      c.delay = i * 0.13;
      c.sx = sh.o.x + (Math.random() - 0.5) * sc.size * 0.6;
      c.sy = sh.o.y - sc.size * 0.5;
    }
    // 收到錢，招牌彈一下
    gt.pop = 1;
  }

  function attackStep(sc, dt) {
    sc.evt -= dt;
    if (sc.evt > 0) return;
    sc.evt = 7 + Math.random() * 7;
    // 目標：去程船裡最靠近荷莫茲海峽的一艘（排隊在最前面的）
    const gt = sc.gates[0];
    let tgt = null, best = Infinity;
    for (const sh of sc.ships) {
      if (!sh.on || sh.dir < 0 || sh.fire > 0) continue;
      const rem = Math.abs(gt.d[sh.route] - sh.s);
      if (rem < best) {
        best = rem;
        tgt = sh;
      }
    }
    const m = sc.missiles.find((q) => !q.on);
    if (!tgt || !m) return;
    const p = H.toScreen(sc.def.attack.launch[0], sc.def.attack.launch[1]);
    // 發射點接在目標船旁邊的世界副本（跨世界循環時不會飛過半個地球）
    const W = H.worldW();
    let x0 = p[0];
    while (x0 - tgt.o.x > W / 2) x0 -= W;
    while (tgt.o.x - x0 > W / 2) x0 += W;
    Object.assign(m, { on: true, t: 0, dur: 1.1, x0, y0: p[1], ship: tgt });
    show(m.g, true);
    m.trail.clear();
  }
  function stepMissiles(sc, dt) {
    for (const m of sc.missiles) {
      if (!m.on) continue;
      m.t += dt / m.dur;
      const tg = m.ship.o, p = clamp(m.t, 0, 1);
      // 飛彈弧線：先往上拉一點再俯衝
      const x = lerp(m.x0, tg.x, p), y = lerp(m.y0, tg.y, p) - Math.sin(p * Math.PI) * sc.size * 1.6;
      m.head.setAttribute('cx', f1(x));
      m.head.setAttribute('cy', f1(y));
      m.trail.push(x, y);
      if (m.t >= 1) {
        m.on = false;
        show(m.g, false);
        m.trail.clear();
        if (m.ship.on) {
          burst(tg.x, tg.y - sc.size * 0.3, sc.size * 0.9);
          m.ship.fire = 9;
        }
      }
    }
  }

  /* ---------- 定點打擊型場景（俄烏：無人機炸油庫）---------- */
  function droneScene() {
    const g = el(root, 'g', { class: 'gs gs-ukr' });
    const rand = rng(37);
    const sc = { id: 'ukr', card: 'geo-ukraine', g, tone: 'bad', size: 14, vis: false, targets: [], drones: [], timer: 2, flagG: null, bb: null };
    const mk = (side, geos) => geos.forEach((geo) => {
      const d = buildDepot(g);
      sc.targets.push({ side, geo, d, x: 0, y: 0, burn: 0, heat: 0, ph: rand() * TAU });
    });
    mk('ru', DATA.ru.depots);
    mk('ua', DATA.ua.depots);
    for (let i = 0; i < 4; i++) {
      const outer = el(g, 'g', { style: 'display:none' });
      const trail = makeTrail(outer, '#ffffff', 1.4);
      const body = el(outer, 'g');
      const shape = { ua: buildDrone(body, 'ua'), ru: buildDrone(body, 'ru') };
      sc.drones.push({ outer, trail, body, shape, on: false, t: 0, dur: 3, a: null, b: null, c: null, tgt: null, side: 'ua' });
    }
    // 停火時的白旗
    const fg = el(g, 'g', { style: 'display:none' });
    sc.flagG = fg;
    el(fg, 'ellipse', { cx: 0, cy: 0.5, rx: 6, ry: 1.6, fill: '#0f1a08', opacity: 0.4 });
    sc.flagImg = el(fg, 'image', { href: 'assets/icons/white_flag.png', preserveAspectRatio: 'xMidYMax meet' });
    sc.layout = layoutDrone;
    sc.step = stepDrone;
    scenes.push(sc);
  }
  const P2 = (geo) => H.toScreen(geo[0], geo[1]);

  function layoutDrone(sc) {
    const k = H.zoom();
    sc.size = clamp(12 + k * 1.3, 14, 24);
    const [W, Hh] = H.size(), m = sc.size * 3;
    const pts = [];
    // 以烏克蘭為中心的展開座標：其餘點接在它旁邊
    const c = P2([34, 48.5]);
    const Wd = H.worldW();
    const near = (geo) => {
      const p = P2(geo);
      let x = p[0];
      while (x - c[0] > Wd / 2) x -= Wd;
      while (c[0] - x > Wd / 2) x += Wd;
      return { x, y: p[1] };
    };
    for (const tg of sc.targets) {
      const p = near(tg.geo);
      tg.x = p.x;
      tg.y = p.y;
      pts.push(p);
    }
    sc.near = near;
    sc.bb = bboxOf(pts);
    sc.vis = sc.bb.x1 > -m && sc.bb.x0 < W + m && sc.bb.y1 > -m && sc.bb.y0 < Hh + m;
    show(sc.g, sc.vis);
    if (!sc.vis) return;
    renderDrone(sc, 0);
  }

  function renderDrone(sc, t, stepping) {
    const u = sc.size / 24 * 1.15, tone = sc.tone;
    show(sc.flagG, tone === 'ok');
    if (tone === 'ok') {
      const p = sc.near(DATA.flag);
      place(sc.flagG, p.x, p.y, Math.sin(t * 1.4) * 4);
      const s = sc.size * 1.5;
      sc.flagImg.setAttribute('x', f1(-s / 2));
      sc.flagImg.setAttribute('y', f1(-s));
      sc.flagImg.setAttribute('width', f1(s));
      sc.flagImg.setAttribute('height', f1(s));
    }
    for (const tg of sc.targets) {
      const d = tg.d;
      place(d.g, tg.x, tg.y, 0, u);
      const burning = tg.burn > 0;
      // 燒焦痕跡：起火時變深，之後 10 秒慢慢恢復
      d.scorch.setAttribute('opacity', clamp(tg.heat, 0, 1).toFixed(2) * 0.75);
      for (const tk of d.tanks) {
        const hot = clamp(tg.heat, 0, 1);
        tk.body.setAttribute('fill', hot > 0.05 ? `rgb(${Math.round(183 - hot * 100)},${Math.round(192 - hot * 112)},${Math.round(205 - hot * 120)})` : '#b7c0cd');
      }
      show(d.fire, burning);
      if (burning) {
        const fade = clamp(tg.burn / 1.5, 0, 1);
        d.flames.forEach((f, i) => {
          const tk = d.tanks[i];
          f.setAttribute('transform', `translate(${tk.x} ${tk.y}) scale(${(fade * (0.85 + Math.sin(t * 14 + i * 2.1) * 0.22)).toFixed(2)} ${(fade * (0.95 + Math.sin(t * 10 + i) * 0.3)).toFixed(2)})`);
        });
      }
      d.smoke.forEach((c, i) => {
        show(c, burning);
        if (!burning) return;
        const p = (t * 0.32 + i / d.smoke.length) % 1;
        const fade = clamp(tg.burn / 2, 0, 1);
        c.setAttribute('cx', f1(Math.sin(t * 1.3 + i * 1.9) * 3 + p * 7));
        c.setAttribute('cy', f1(-8 - p * 24));
        c.setAttribute('r', f1(2.2 + p * 5.5));
        c.setAttribute('opacity', ((1 - p) * 0.65 * fade).toFixed(2));
      });
    }
    for (const dr of sc.drones) {
      if (!dr.on) {
        show(dr.outer, false);
        continue;
      }
      show(dr.outer, true);
      const p = clamp(dr.t, 0, 1);
      // 二次貝茲曲線：飛行路線微微彎曲
      const q = 1 - p;
      const x = q * q * dr.a.x + 2 * q * p * dr.c.x + p * p * dr.b.x, y = q * q * dr.a.y + 2 * q * p * dr.c.y + p * p * dr.b.y;
      const dx = 2 * q * (dr.c.x - dr.a.x) + 2 * p * (dr.b.x - dr.c.x), dy = 2 * q * (dr.c.y - dr.a.y) + 2 * p * (dr.b.y - dr.c.y);
      place(dr.body, x, y, Math.atan2(dy, dx) * 180 / Math.PI, u * 0.95);
      if (stepping) dr.trail.push(x, y);
    }
  }

  function stepDrone(sc, dt, t) {
    const tone = sc.tone;
    for (const tg of sc.targets) {
      if (tg.burn > 0) tg.burn = Math.max(0, tg.burn - dt);
      // 起火時熱度往上，熄滅後慢慢降（燒焦痕跡跟著淡掉）
      tg.heat += ((tg.burn > 0 ? 1 : 0) - tg.heat) * Math.min(1, dt * (tg.burn > 0 ? 2.5 : 0.25));
    }
    // 出擊：衝突頻繁、緊張偶爾、緩和（停火）完全不出動；同時最多 3 架
    if (tone !== 'ok') {
      sc.timer -= dt;
      const flying = sc.drones.filter((d) => d.on).length;
      if (sc.timer <= 0 && flying < 3) {
        sc.timer = tone === 'bad' ? 1.8 + Math.random() * 2.4 : 8 + Math.random() * 6;
        launchDrone(sc);
      }
    }
    for (const dr of sc.drones) {
      if (!dr.on) continue;
      dr.t += dt / dr.dur;
      if (dr.t >= 1) {
        dr.on = false;
        dr.trail.clear();
        const tg = dr.tgt;
        burst(tg.x, tg.y - sc.size * 0.35, sc.size * 1.05);
        tg.burn = (tone === 'bad' ? 10 : 6) + Math.random() * 3;
      }
    }
    renderDrone(sc, t, true);
  }

  function launchDrone(sc) {
    const dr = sc.drones.find((d) => !d.on);
    if (!dr) return;
    // 兩邊輪流 / 隨機：烏克蘭打俄羅斯油庫為主，俄羅斯也打烏克蘭油庫
    const side = Math.random() < 0.6 ? 'ua' : 'ru';
    const foe = side === 'ua' ? 'ru' : 'ua';
    const cands = sc.targets.filter((t) => t.side === foe && t.burn <= 0);
    if (!cands.length) return;
    const tgt = cands[Math.floor(Math.random() * cands.length)];
    const ls = DATA[side].launch;
    const a = sc.near(ls[Math.floor(Math.random() * ls.length)]);
    const b = { x: tgt.x, y: tgt.y - sc.size * 0.1 };
    const dist = Math.hypot(b.x - a.x, b.y - a.y);
    const off = (Math.random() < 0.5 ? -1 : 1) * dist * 0.16;
    const c = { x: (a.x + b.x) / 2 - ((b.y - a.y) / (dist || 1)) * off, y: (a.y + b.y) / 2 + ((b.x - a.x) / (dist || 1)) * off };
    Object.assign(dr, { on: true, t: 0, a, b, c, tgt, side, dur: clamp(dist / (sc.size * 4.2), 2.2, 5.5) });
    show(dr.shape.ua, side === 'ua');
    show(dr.shape.ru, side === 'ru');
    dr.trail.clear();
  }

  /* ---------- 對外介面 ---------- */
  // 局勢：取該卡片第一個有 tone 的資料列（ok / warn / bad），沒有就當緊張
  function toneOf(card) {
    const t = H.tone ? H.tone(card) : null;
    return t === 'ok' || t === 'bad' ? t : 'warn';
  }

  const GeoScenes = {
    data: DATA,
    // host：{ layer（SVG <g>）, toScreen(lon,lat), worldW(), size(), zoom(), tone(cardId), enabled(), reduce(), t(str) }
    init(host) {
      H = host;
      root = el(host.layer, 'g', { class: 'geo-scenes', style: 'display:none;pointer-events:none' });
      buildFx();
      laneScene(HORMUZ);
      laneScene(TRADE_LANE);
      droneScene();
    },
    anchors() {
      return DATA.anchors.map(([lon, lat]) => ({ lon, lat }));
    },
    // 地圖位置 / 縮放 / 篩選改變時呼叫：重新投影航線與關卡
    layout() {
      if (!root) return;
      const en = !!H.enabled();
      if (en !== on) {
        on = en;
        show(root, on);
      }
      if (!on) return;
      for (const sc of scenes) {
        sc.tone = toneOf(sc.def ? sc.def.card : sc.card);
        sc.stat = !!H.reduce();
        sc.layout(sc);
      }
    },
    // 每幀呼叫：推進動畫
    step(dt, t) {
      if (!root || !on || H.reduce()) return;
      for (const sc of scenes) {
        if (!sc.vis) continue;
        sc.tone = toneOf(sc.def ? sc.def.card : sc.card);
        sc.stat = false;
        sc.step(sc, dt, t);
      }
      stepBursts(dt);
    }
  };
  window.GeoScenes = GeoScenes;
})();
