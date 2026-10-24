/* 台股市值前十大公司：畫在股市地圖的台灣島上（遊戲風的小建築 + 招牌）
 * - 縮小時（台灣只有一點點大）：前 3 大（台積電、聯發科、台達電）合成一座「模擬城市封面」式的小城市
 * - 放大到台灣夠大時：10 棟建築各自蓋在公司總部所在地，頭上掛招牌
 * - 台股加權指數上漲：窗戶亮燈；下跌：整片低迷變暗；漲超過 2% 放煙火；跌超過 2% 頭上烏雲下雨打雷
 * 由 app.js 呼叫 Corps.build() / Corps.layout()。
 */
(function () {
  'use strict';

  // 市值資料：2026 年 10 月 23 日收盤附近（新台幣兆元）；總部地址取自證交所上市公司基本資料
  const DATA_DATE = '2026-10-23';
  const CORPS = [
    { rk: 1, s: '2330', name: '台積電', cap: 61.85, ind: '晶圓代工', kind: 'tsmc', col: '#d71920', lon: 121.0135, lat: 24.7745, addr: '新竹科學園區力行六路 8 號' },
    { rk: 2, s: '2454', name: '聯發科', cap: 6.44, ind: 'IC 設計', kind: 'mtk', col: '#f08c00', lon: 121.0225, lat: 24.7790, addr: '新竹科學園區篤行一路 1 號' },
    { rk: 3, s: '2308', name: '台達電', cap: 4.05, ind: '電源、散熱、資料中心', kind: 'delta', col: '#0068b7', lon: 121.5781, lat: 25.0742, addr: '台北市內湖區瑞光路 186 號' },
    { rk: 4, s: '2317', name: '鴻海', cap: 3.45, ind: '電子代工、AI 伺服器', kind: 'honhai', col: '#1d4f9c', lon: 121.4217, lat: 24.9664, addr: '新北市土城區自由街 2 號' },
    { rk: 5, s: '3711', name: '日月光', cap: 2.92, ind: '封裝、測試', kind: 'ase', col: '#00539b', lon: 120.3050, lat: 22.7236, addr: '高雄市楠梓區經三路 26 號' },
    { rk: 6, s: '1303', name: '南亞', cap: 2.39, ind: '塑膠、化工', kind: 'nanya', col: '#0b7a52', lon: 121.5870, lat: 25.0594, addr: '台北市內湖區南京東路六段 380 號' },
    { rk: 7, s: '2881', name: '富邦金', cap: 2.22, ind: '金融、保險', kind: 'fubon', col: '#00808f', lon: 121.5422, lat: 25.0562, addr: '台北市中山區遼寧街 179 號' },
    { rk: 8, s: '2383', name: '台光電', cap: 1.82, ind: '高階銅箔基板', kind: 'emc', col: '#b4561c', lon: 121.1276, lat: 25.0498, addr: '桃園市觀音區大同一路 18 號' },
    { rk: 9, s: '3037', name: '欣興', cap: 1.78, ind: 'ABF 載板、PCB', kind: 'unimicron', col: '#2a56a8', lon: 121.3295, lat: 24.9848, addr: '桃園市龜山區山鶯路 179 號' },
    { rk: 10, s: '2882', name: '國泰金', cap: 1.66, ind: '金融、保險', kind: 'cathay', col: '#00a04a', lon: 121.5537, lat: 25.0374, addr: '台北市大安區仁愛路四段 296 號' }
  ];
  // 縮小時的小城市蓋在新竹（台積電、聯發科的所在地）
  const CLUSTER_AT = [121.0, 24.72];
  // 每經度在螢幕上超過這麼多 px（台灣大約 300px 高）就改成 10 棟各自蓋在總部
  const DETAIL_PPD = 80;
  const BOOM = 2, CRASH = -2;

  /* ---------- 建築畫法（SVG 字串；原點是建築底部中央的地面，y 往上是負的） ---------- */
  const hex = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
  const mix = (c, t, f) => {
    const a = hex(c), b = hex(t);
    return '#' + a.map((v, i) => Math.round(v + (b[i] - v) * f).toString(16).padStart(2, '0')).join('');
  };
  const dark = (c, f) => mix(c, '#0b1220', f), light = (c, f) => mix(c, '#ffffff', f);
  const f1 = (n) => +n.toFixed(2);

  // 立體方塊：正面 + 右側面（光從左上來，側面較暗）+ 屋頂；y0 是底部離地高度（疊在別的方塊上面）
  // win：[列, 欄] 正面窗戶；roof：指定屋頂顏色
  function box(x, w, h, d, c, { win, y0 = 0, roof } = {}) {
    const b = -y0, t = -y0 - h, dx = d, dy = d * 0.5;
    let s = `<path fill="${c}" d="M${x},${b}H${x + w}V${t}H${x}Z"/>`;
    s += `<path fill="${dark(c, 0.32)}" d="M${x + w},${b}L${x + w + dx},${b - dy}V${t - dy}L${x + w},${t}Z"/>`;
    s += `<path fill="${roof || light(c, 0.28)}" d="M${x},${t}L${x + dx},${t - dy}H${x + w + dx}L${x + w},${t}Z"/>`;
    if (win) {
      const [rows, cols] = win, mx = 1.6, my = 2, gw = (w - mx * 2) / cols, gh = (h - my * 2) / rows;
      const ww = f1(gw * 0.56), wh = f1(gh * 0.5);
      let p = '';
      for (let r = 0; r < rows; r++) for (let k = 0; k < cols; k++) {
        p += `M${f1(x + mx + k * gw + (gw - ww) / 2)},${f1(t + my + r * gh + (gh - wh) / 2)}h${ww}v${wh}h${-ww}Z`;
      }
      // 側面也開一排窗（平行四邊形）
      const sc = Math.max(1, Math.round(cols / 3)), sg = d / sc;
      for (let r = 0; r < rows; r++) for (let k = 0; k < sc; k++) {
        const x0 = x + w + k * sg + sg * 0.25, y1 = t + my + r * gh + (gh - wh) / 2 - (k * sg + sg * 0.25) * 0.5, sw = sg * 0.5;
        p += `M${f1(x0)},${f1(y1)}l${f1(sw)},${f1(-sw * 0.5)}v${wh}l${f1(-sw)},${f1(sw * 0.5)}Z`;
      }
      s += `<path class="w" d="${p}"/>`;
    }
    s += `<path class="edge" d="M${x},${b}H${x + w}L${x + w + dx},${b - dy}V${t - dy}H${x + dx}L${x},${t}Z"/>`;
    return s;
  }
  const cyl = (x, w, h, c, y0 = 0) => {
    const b = -y0, t = b - h, rx = w / 2, ry = w * 0.22, cx = x + rx;
    return `<path fill="${c}" d="M${x},${t}V${b}A${rx},${ry} 0 0 0 ${x + w},${b}V${t}Z"/>` +
      `<path fill="${dark(c, 0.3)}" d="M${cx + rx * 0.3},${t}V${b + ry * 0.95}A${rx},${ry} 0 0 0 ${x + w},${b}V${t}Z"/>` +
      `<ellipse fill="${light(c, 0.3)}" cx="${cx}" cy="${t}" rx="${rx}" ry="${ry}"/>`;
  };
  const tree = (x, y, r) => `<circle fill="#2f8a3e" cx="${x}" cy="${y}" r="${r}"/><circle fill="#5cc062" cx="${x - r * 0.3}" cy="${y - r * 0.3}" r="${r * 0.55}"/>`;

  // 每種建築：svg 內容、招牌掛的位置（top：建築最高點，給招牌和特效用）
  const ART = {
    tsmc: () => ({
      top: -40,
      svg: box(-22, 40, 13, 14, '#e9edf2', { win: [1, 9] }) +
        `<rect fill="#d71920" x="-22" y="-12.4" width="40" height="2.2"/>` +
        cyl(-6, 3.4, 9, '#f4f6f8', 17) + cyl(1, 3.4, 11, '#f4f6f8', 17) +
        `<rect fill="#d71920" x="-6" y="-26.6" width="3.4" height="1.5"/><rect fill="#d71920" x="1" y="-28.6" width="3.4" height="1.5"/>` +
        box(-30, 12, 34, 8, '#4f86c6', { win: [9, 3] })
    }),
    mtk: () => ({
      top: -60,
      svg: box(-8, 16, 46, 9, '#3a6ea8', { win: [12, 3] }) +
        box(-5, 10, 5, 6, '#f08c00', { y0: 46 }) +
        `<path stroke="#dfe6ef" stroke-width="1.1" d="M0.5,-51V-60"/><circle fill="#ff4b4b" cx="0.5" cy="-60.5" r="1.2"/>`
    }),
    delta: () => ({
      top: -42,
      svg: box(-9, 18, 34, 10, '#3f9d6a', { win: [9, 4], roof: '#7fcf6a' }) +
        tree(-4, -36.5, 2.6) + tree(3, -38.5, 2.4) + tree(10, -39, 2.2) +
        `<path fill="#bfe8ff" opacity=".85" d="M-9,-6H9V-2H-9Z"/>`
    }),
    honhai: () => ({
      top: -26,
      svg: box(-22, 32, 14, 12, '#c9ced6', { win: [2, 7] }) +
        `<path fill="#9aa3b0" d="M-22,-14L-18,-19L-14,-14L-10,-19L-6,-14L-2,-19L2,-14L6,-19L10,-14Z"/>` +
        box(10, 10, 22, 7, '#2f5f9e', { win: [6, 2] })
    }),
    ase: () => ({
      top: -24,
      svg: box(-17, 30, 15, 12, '#d8dde4', { win: [2, 6] }) +
        `<path fill="#232a36" d="M-8,-17.5L-2,-20.5H8L2,-17.5Z"/>` +
        `<path stroke="#e3c35a" stroke-width=".7" d="M-6,-16.5v1.2M-3,-16.5v1.2M0,-16.5v1.2M3,-17.2l1.8,-.9M5,-18.2l1.8,-.9"/>` +
        box(-23, 7, 20, 6, '#00539b', { win: [5, 1] })
    }),
    nanya: () => ({
      top: -32,
      svg: cyl(6, 9, 11, '#d3d9e0') + cyl(15, 7, 8, '#c3cad3') +
        `<path stroke="#8b96a5" stroke-width="1.2" fill="none" d="M-4,-14H10V-11"/>` +
        box(-16, 12, 26, 7, '#7d8ea3', { win: [7, 3] })
    }),
    fubon: () => ({
      top: -52,
      svg: box(-8, 15, 40, 8, '#2c7fb8', { win: [10, 3] }) +
        `<path fill="#9fd4f5" d="M-8,-40L-0.5,-51L7,-40Z"/><path fill="#1d5f8c" d="M7,-40L15,-44L-0.5,-51Z"/>`
    }),
    emc: () => ({
      top: -22,
      svg: box(-18, 30, 12, 12, '#dcc7ab', { win: [1, 6], roof: '#c8743a' }) +
        `<path stroke="#f3b27a" stroke-width=".6" d="M-15,-13.5L-9,-16.5M-9,-13.5L-3,-16.5M-3,-13.5L3,-16.5M3,-13.5L9,-16.5"/>` +
        cyl(-16, 4, 10, '#e7ecf1', 12)
    }),
    unimicron: () => ({
      top: -22,
      svg: box(-16, 28, 14, 12, '#cfd8d0', { win: [2, 6], roof: '#2f8a4c' }) +
        `<path stroke="#e6d16a" stroke-width=".6" fill="none" d="M-13,-15.5h6l3,-1.5h6M-10,-17l4,-2h7M-1,-15.5l4,-2h6"/>` +
        `<circle fill="#e6d16a" cx="-13" cy="-15.5" r=".8"/><circle fill="#e6d16a" cx="9" cy="-17.5" r=".8"/>`
    }),
    cathay: () => ({
      top: -50,
      svg: box(-9, 17, 36, 9, '#3a9e5f', { win: [9, 3] }) +
        `<path stroke="#6b4a2b" stroke-width="1.4" d="M3,-40.5V-44"/>` + tree(3, -46.5, 3.6)
    })
  };
  // 縮小時的小城市：前 3 大蓋在同一座廣場上（模擬城市封面的感覺），台積電在中間最大
  function clusterArt() {
    const t = ART.tsmc(), m = ART.mtk(), d = ART.delta();
    const plaza = `<path fill="#d9d2bf" d="M-38,2L-6,-12H38L6,2Z"/><path fill="#a99f86" d="M-38,2L6,2L6,4.5L-38,4.5Z"/>` +
      `<path fill="#8e856d" d="M6,2L38,-12V-9.5L6,4.5Z"/>` + tree(-31, -1, 2.4) + tree(30, -11, 2.2) + tree(-12, -10, 2);
    return {
      top: -62,
      svg: plaza +
        `<g transform="translate(-18,-7) scale(.82)">${m.svg}</g>` +
        `<g transform="translate(22,-8) scale(.8)">${d.svg}</g>` +
        `<g transform="translate(3,0) scale(1.05)">${t.svg}</g>`
    };
  }

  /* ---------- 建立 SVG ---------- */
  let root = null, items = [], cluster = null, fx = [], onPick = null, lastOrder = '';
  const NS = 'http://www.w3.org/2000/svg';
  const el = (tag, attrs, parent) => {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  };
  const setA = (e, k, v) => { v = String(v); if (e.getAttribute(k) !== v) e.setAttribute(k, v); };
  const show = (e, on) => { const d = on ? '' : 'none'; if (e.style.display !== d) e.style.display = d; };

  // 招牌：金色名次徽章 + 品牌色的名牌（字固定大小，不隨建築縮放，才看得清楚）
  function makeSign(parent, c) {
    const g = el('g', { class: 'sign' }, parent);
    el('rect', { class: 'sb', rx: 4, height: 15, fill: c.col }, g);
    el('circle', { class: 'rkb', r: 7.5, cx: 0, cy: 7.5 }, g);
    el('text', { class: 'rkt', x: 0, y: 8 }, g).textContent = c.rk;
    el('text', { class: 'snm', y: 8 }, g).textContent = c.name;
    return g;
  }

  function build(parent, opts) {
    root = parent;
    onPick = opts.onPick;
    root.setAttribute('class', 'corps');
    // 先放特效的底層（低迷時地上的陰影）再放建築，最後是特效（煙火、烏雲）
    cluster = { g: el('g', { class: 'bld mk cluster', role: 'button', tabindex: 0, 'aria-label': '台股市值前三大：台積電、聯發科、台達電' }, root) };
    el('ellipse', { class: 'gs', filter: 'url(#soft)' }, cluster.g);
    cluster.art = el('g', { class: 'art' }, cluster.g);
    const ca = clusterArt();
    cluster.art.innerHTML = ca.svg;
    cluster.top = ca.top;
    cluster.g.addEventListener('click', () => onPick && onPick(null));
    for (const c of CORPS) {
      const g = el('g', { class: 'bld mk', role: 'button', tabindex: 0, 'aria-label': `${c.name}（市值第 ${c.rk} 名）` }, root);
      const lead = el('path', { class: 'lead' }, g);
      const dot = el('circle', { class: 'hq', r: 2.2, fill: c.col }, g);
      const body = el('g', {}, g);
      el('ellipse', { class: 'gs', filter: 'url(#soft)' }, body);
      const art = el('g', { class: 'art' }, body);
      const a = ART[c.kind]();
      art.innerHTML = a.svg;
      const sign = makeSign(body, c);
      g.addEventListener('click', () => onPick && onPick(c));
      g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick && onPick(c); } });
      items.push({ c, g, body, art, sign, lead, dot, top: a.top, w: 0 });
    }
    // 特效：最多 3 組（縮小時只用 1 組，放在小城市頭上；放大時放在前 3 大頭上）
    for (let i = 0; i < 3; i++) {
      const g = el('g', { class: 'cfx' });
      root.insertBefore(g, cluster.g); // 特效在建築後面（天空），不會蓋住招牌
      const fw = el('g', { class: 'fw' }, g);
      const cols = ['#ffd54a', '#ff6b8b', '#7be3ff', '#b6ff6b', '#ffa94d'];
      [[-14, -10, 0], [12, -18, 0.55], [0, -30, 1.1], [-22, -26, 1.6], [20, -4, 2.1]].forEach(([x, y, d], k) => {
        const p = el('g', { transform: `translate(${x},${y})` }, fw);
        const b = el('g', { class: 'burst', style: `animation-delay:${d + i * 0.35}s` }, p);
        let s = '';
        for (let j = 0; j < 10; j++) {
          const a = (j / 10) * Math.PI * 2;
          s += `M${f1(Math.cos(a) * 3)},${f1(Math.sin(a) * 3)}L${f1(Math.cos(a) * 9)},${f1(Math.sin(a) * 9)}`;
        }
        el('path', { d: s, stroke: cols[(k + i) % cols.length] }, b);
        el('circle', { r: 1.6, fill: '#fff' }, b);
      });
      const st = el('g', { class: 'storm' }, g);
      const rain = el('g', { class: 'rain' }, st);
      for (let j = 0; j < 7; j++) {
        el('path', { d: `M${-15 + j * 5},-2l-2,6`, style: `animation-delay:${(j * 0.13 + i * 0.2).toFixed(2)}s` }, rain);
      }
      el('path', { class: 'bolt', d: 'M3,-6L-3,6H1L-2,15L6,2H2L5,-6Z', style: `animation-delay:${i * 1.1}s` }, st);
      el('g', { class: 'cloud' }, st).innerHTML =
        '<ellipse cx="0" cy="-8" rx="19" ry="7" fill="#4b5466"/><circle cx="-8" cy="-12" r="7" fill="#5a6476"/>' +
        '<circle cx="4" cy="-15" r="9" fill="#646e81"/><circle cx="13" cy="-10" r="6" fill="#535d70"/>' +
        '<ellipse cx="-1" cy="-17" rx="5" ry="3" fill="#7b869a" opacity=".7"/>';
      fx.push(g);
    }
  }

  // 建築的佔位框（未縮放、相對原點）：用 getBBox 量一次就好
  function bboxOf(it) {
    if (!it.bb) {
      try { const b = it.art.getBBox(); if (b.width) it.bb = { x: b.x, y: b.y, w: b.width, h: b.height }; } catch (e) { /* 還沒顯示 */ }
    }
    return it.bb || { x: -20, y: it.top, w: 40, h: -it.top };
  }

  /* ---------- 佈局：每次地圖移動 / 縮放都會呼叫，回傳建築佔的螢幕範圍（讓市場旗幟避開） ---------- */
  function layout(o) {
    if (!root) return [];
    const { W, H, xy, pct, visible } = o;
    const out = [];
    const mood = pct == null ? 'flat' : pct > 0 ? 'up' : pct < 0 ? 'down' : 'flat';
    const cls = `corps ${mood}${pct != null && pct >= BOOM ? ' boom' : ''}${pct != null && pct <= CRASH ? ' crash' : ''}`;
    setA(root, 'class', cls);
    if (!visible) { show(root, false); return out; }
    show(root, true);
    const [ax] = xy(121, 24), [bx] = xy(122, 24);
    const ppd = Math.abs(bx - ax);
    const detail = ppd >= DETAIL_PPD;
    const fxAt = [];

    // 縮小：前 3 大合成一座小城市
    show(cluster.g, !detail);
    if (!detail) {
      const [x, y] = xy(CLUSTER_AT[0], CLUSTER_AT[1]);
      const hgt = Math.max(30, Math.min(60, ppd * 5)), s = hgt / -cluster.top;
      const on = x > -80 && x < W + 80 && y > -80 && y < H + 80;
      show(cluster.g, on);
      if (on) {
        setA(cluster.g, 'transform', `translate(${f1(x)},${f1(y)})`);
        setA(cluster.art, 'transform', `scale(${f1(s)})`);
        const gs = cluster.g.querySelector('.gs');
        setA(gs, 'rx', f1(40 * s)); setA(gs, 'ry', f1(9 * s)); setA(gs, 'cy', f1(-2 * s));
        out.push({ x: x - 38 * s, y: y + cluster.top * s, w: 76 * s, h: (-cluster.top + 5) * s, an: true });
        fxAt.push([x + 3 * s, y + (cluster.top - 6) * s, s * 1.6]);
      }
      for (const it of items) show(it.g, false);
    } else {
      // 放大：10 棟各自蓋在總部。台北的幾家總部離得很近，建築本身可以前後交疊（像一排天際線），
      // 只有幾乎整棟被擋住時才往左右挪一點；招牌另外找不重疊的位置，真的放不下就先不掛（再放大就會出現）
      const u = Math.max(0.5, Math.min(2.2, ppd / 130));
      const ui = (o.avoid || []).slice();
      const vis = [];
      for (const it of items) {
        const c = it.c, [hx, hy] = xy(c.lon, c.lat);
        const s = u * (0.82 + 0.3 * Math.sqrt(c.cap / CORPS[0].cap));
        const bb = bboxOf(it);
        const box = (x, y) => ({ x: x + bb.x * s, y: y + bb.y * s, w: bb.w * s, h: bb.h * s });
        let px = hx, py = hy;
        const covered = (r) => vis.some((v) => inter(r, v.r) && ov(r, v.r) > 0.55);
        if (covered(box(px, py))) {
          for (const f of [0.6, -0.6, 1.2, -1.2, 1.8, -1.8]) {
            const tx = hx + f * bb.w * s, ty = hy + Math.abs(f) * 2;
            if (!covered(box(tx, ty))) { px = tx; py = ty; break; }
          }
        }
        const r = box(px, py);
        const on = r.x < W + 40 && r.x + r.w > -40 && r.y < H + 40 && r.y + r.h > -40;
        show(it.g, on);
        if (on) vis.push({ it, c, hx, hy, px, py, s, bb, r });
      }
      // 畫的順序：越下面（越靠近鏡頭）的越後畫，前面的建築才會擋住後面的；順序沒變就不動 DOM
      const order = vis.slice().sort((a, b) => a.py - b.py);
      const key = order.map((v) => v.c.rk).join(',');
      if (key !== lastOrder) { lastOrder = key; order.forEach((v) => root.appendChild(v.it.g)); }
      const signs = [];
      for (const v of vis) {
        const { it, c, hx, hy, px, py, s, bb, r } = v;
        out.push({ ...r, an: true });
        const moved = Math.hypot(px - hx, py - hy) > 1;
        setA(it.g, 'transform', `translate(${f1(hx)},${f1(hy)})`);
        setA(it.body, 'transform', `translate(${f1(px - hx)},${f1(py - hy)})`);
        setA(it.art, 'transform', `scale(${f1(s)})`);
        const gs = it.body.querySelector('.gs');
        setA(gs, 'rx', f1((bb.w / 2 + 3) * s)); setA(gs, 'ry', f1(5 * s)); setA(gs, 'cx', f1((bb.x + bb.w / 2) * s)); setA(gs, 'cy', f1(-1 * s));
        show(it.lead, moved); show(it.dot, moved);
        if (moved) setA(it.lead, 'd', `M0,0L${f1(px - hx)},${f1(py - hy)}`);
        // 招牌：先試建築正上方，再試左上、右上、往上一層；和其他招牌、介面重疊就換位置，都不行就先不掛
        const sw = 6 + 20 + c.name.length * 11, sh = 15, cx = px + (bb.x + bb.w / 2) * s, top = py + bb.y * s;
        const cands = [[0, 0], [-0.55, 0], [0.55, 0], [0, -1]];
        let spot = null;
        for (const [fx0, fy] of cands) {
          const sr = { x: cx - sw / 2 + fx0 * sw, y: top - sh - 3 + fy * (sh + 2), w: sw, h: sh };
          if (sr.x < 2 || sr.y < 2 || sr.x + sr.w > W - 2) continue;
          if (signs.some((q) => inter(sr, q)) || ui.some((q) => inter(sr, q))) continue;
          spot = sr; break;
        }
        show(it.sign, !!spot);
        if (spot) {
          signs.push(spot);
          out.push({ ...spot, an: true });
          setA(it.sign, 'transform', `translate(${f1(spot.x - px)},${f1(spot.y - py)})`);
          setA(it.sign.querySelector('.sb'), 'width', sw - 6);
          setA(it.sign.querySelector('.sb'), 'x', 6);
          setA(it.sign.querySelector('.rkb'), 'cx', 7.5);
          setA(it.sign.querySelector('.rkt'), 'x', 7.5);
          setA(it.sign.querySelector('.snm'), 'x', 6 + 10 + (sw - 16) / 2);
        }
        if (c.rk <= 3) fxAt.push([cx, top - 6, Math.max(0.8, u)]);
      }
    }    fx.forEach((g, i) => {
      const p = fxAt[i];
      show(g, !!p);
      if (p) setA(g, 'transform', `translate(${f1(p[0])},${f1(p[1])}) scale(${f1(p[2])})`);
    });
    return out;
  }
  const inter = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
  // a 被 b 蓋住的比例
  const ov = (a, b) => {
    const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x), h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
    return w > 0 && h > 0 ? (w * h) / (a.w * a.h) : 0;
  };

  window.Corps = { CORPS, DATA_DATE, build, layout, BOOM, CRASH };
})();
