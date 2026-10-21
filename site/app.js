/* 股市大冒險 · 世界指數地圖 */
(function () {
'use strict';

const TOPO_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-50m.json';

const REGIONS = {
  all:      { label: '🌍 全球',     bbox: null },
  asia:     { label: '🌏 亞太',     bbox: [68, -47, 179, 48] },
  europe:   { label: '🏰 歐洲',     bbox: [-14, 34, 45, 62] },
  americas: { label: '🗽 美洲',     bbox: [-128, -42, -34, 56] },
  mea:      { label: '🐪 中東非洲', bbox: [-20, -36, 62, 40] }
};
const REGION_ORDER = ['asia', 'europe', 'mea', 'americas'];

// 遊戲風地形的原始資料（都是 Web Mercator 圖磚，且允許跨來源讀取像素）
// - DEM：AWS Terrain Tiles（Terrarium 編碼），提供陸地高度與海洋深度
// - 衛星影像：只拿來「判斷地貌」（沙漠 / 草原 / 森林 / 雪地 / 湖泊），不直接顯示
const DEM_URL = (z, x, y) => `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${z}/${x}/${y}.png`;
const IMG_URL = (z, x, y) => `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`;
const MAX_TILE_Z = 14;           // 最高圖磚層級（約 10 公尺 / 像素），再放大會直接放大這一層
const VIEW_N = 80, VIEW_S = -58; // 可視緯度範圍（Mercator 投影兩極會無限拉長，所以裁掉）

// 裝飾用的地形 / 動物 / 海洋小物件 [emoji, lon, lat]
const DECOR = [
  // 陸地上的山、樹、沙丘改由程序化地形繪製，這裡只留海上的小東西
  ['🐋', -35, 36], ['🐬', 72, -14], ['⛵', -140, 25], ['⛵', 160, 15],
  ['🐙', -20, -30], ['🦈', 60, -35], ['🦭', -30, 65]
];

// 地圖上的 3D 動物（Microsoft Fluent Emoji 3D，MIT 授權，已存在 assets/animals/）
// face：圖片裡動物面向哪邊（L 左 / R 右 / F 正面不翻轉）；gait：走路方式
const ANIMALS = {
  '🦌': ['deer'], '🐕': ['dog'], '🐅': ['tiger'], '🐉': ['dragon', 'L', 'float'], '🐎': ['horse'],
  '🦚': ['peacock', 'F', 'bird'], '🦘': ['kangaroo', 'L', 'hop'], '🐑': ['ewe'], '🐆': ['leopard'],
  '🦧': ['orangutan', 'F'], '🐘': ['elephant', 'L', 'heavy'], '🐒': ['monkey'], '🦔': ['hedgehog'],
  '🦡': ['badger'], '🐓': ['rooster', 'R', 'bird'], '🐂': ['ox', 'L', 'heavy'], '🐐': ['goat'],
  '🐄': ['cow', 'L', 'heavy'], '🐇': ['rabbit', 'L', 'hop'], '🦃': ['turkey', 'L', 'bird'],
  '🐪': ['camel', 'L', 'heavy'], '🦏': ['rhinoceros', 'L', 'heavy'], '🦅': ['eagle', 'L', 'bird'],
  '🦫': ['beaver'], '🦜': ['parrot', 'L', 'bird'], '🦎': ['lizard', 'F'], '🐧': ['penguin', 'F', 'waddle'],
  '🦙': ['llama']
};
const animalOf = (e) => {
  const a = ANIMALS[e];
  return a ? { src: `assets/animals/${a[0]}.png`, face: a[1] || 'L', gait: a[2] || 'walk' } : null;
};
// Windows 不會把國旗 emoji 畫成國旗（只顯示「TW」字母），所以改用 assets/flags/ 的國旗圖
const flagCode = (e) => {
  const cps = [...(e || '')].map((c) => c.codePointAt(0) - 0x1f1e6);
  return cps.length === 2 && cps.every((c) => c >= 0 && c < 26) ? cps.map((c) => String.fromCharCode(97 + c)).join('') : null;
};
const flagSrc = (e) => { const c = flagCode(e); return c ? `assets/flags/${c}.png` : null; };
const flagHtml = (e, cls = 'flg') => { const s = flagSrc(e); return s ? `<img class="${cls}" src="${s}" alt="">` : e; };

const $ = (s) => document.querySelector(s);
const hash = (s) => { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };
const pad3 = (id) => String(id == null ? '' : id).padStart(3, '0');
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
};

const state = {
  cfg: null, maps: [], bars: [], bySym: {}, byId: {}, countries: [],
  quotes: {}, generated: null, demo: false,
  auto: false, activeRegion: 'all',
  redUp: store.get('redUp', true),
  anim: store.get('anim', true),
  t: d3.zoomIdentity
};

/* ================= 時間 / 開盤狀態 ================= */
const dtfCache = {};
function parts(tz, d) {
  let f = dtfCache[tz];
  if (!f) f = dtfCache[tz] = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', weekday: 'short', hour: '2-digit', minute: '2-digit' });
  const o = {};
  for (const p of f.formatToParts(d)) o[p.type] = p.value;
  const dow = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[o.weekday];
  return { dow, min: (+o.hour % 24) * 60 + (+o.minute) };
}
const toMin = (s) => { const a = s.split(':'); return +a[0] * 60 + (+a[1]); };

function statusAt(m, d) {
  const { dow, min } = parts(m.tz, d);
  if (!(m.days || [1, 2, 3, 4, 5]).includes(dow)) return 'closed';
  const ses = m.ses.map((s) => [toMin(s[0]), toMin(s[1])]);
  for (const s of ses) if (min >= s[0] && min < s[1]) return 'open';
  if (min >= ses[0][0] && min < ses[ses.length - 1][1]) return 'break';
  return 'closed';
}
function marketStatus(m) {
  let s = statusAt(m, new Date());
  const q = state.quotes[m.s];
  // 理論上開盤，但資料 3 小時沒動 → 很可能是假日休市
  if (s === 'open' && q && q.t && !state.demo && Date.now() / 1000 - q.t > 3 * 3600) s = 'closed';
  return s;
}
const nextCache = {};
function nextOpen(m) {
  const c = nextCache[m.s], now = Date.now();
  if (c && now - c.at < 300000) return c.v;
  const step = 15 * 60000;
  let t = Math.ceil(now / step) * step, v = null, prev = statusAt(m, new Date(now));
  for (let i = 0; i < 7 * 96; i++) {
    const s = statusAt(m, new Date(t));
    if (s === 'open' && prev !== 'open') { v = t; break; }
    prev = s; t += step;
  }
  nextCache[m.s] = { at: now, v };
  return v;
}
// 自動模式只在這三個主要區域之間切換（中東非洲市場少，需要時手動點）
const AUTO_REGIONS = ['asia', 'europe', 'americas'];
function pickAutoRegion() {
  const count = {};
  AUTO_REGIONS.forEach((r) => (count[r] = 0));
  for (const m of state.maps) if (count[m.r] != null && marketStatus(m) === 'open') count[m.r]++;
  let best = null, bc = 0;
  for (const r of AUTO_REGIONS) if (count[r] > bc) { best = r; bc = count[r]; }
  if (best) return best;
  // 都休市：選最快開盤的區域
  let bt = Infinity; best = 'asia';
  for (const m of state.maps) {
    if (count[m.r] == null) continue;
    const t = nextOpen(m);
    if (t && t < bt) { bt = t; best = m.r; }
  }
  return best;
}

/* ================= 顏色 / 格式 ================= */
const isRed = (pct) => (pct >= 0) === state.redUp;
const hue = (pct) => (isRed(pct) ? 4 : 142);
// 介面改成深色遊戲面板，漲跌色要用較亮的版本才看得清楚
const pctColor = (pct) => (isRed(pct) ? 'hsl(4,88%,64%)' : 'hsl(140,70%,52%)');
const bandColor = (pct) => (isRed(pct) ? 'hsl(4,62%,38%)' : 'hsl(146,55%,28%)');
// 國土只上一層半透明的漲跌色，讓底下的地形透出來
function fillFor(m) {
  const q = state.quotes[m.s];
  if (!q) return 'rgba(255,255,255,.08)';
  const mag = Math.min(Math.abs(q.pct), 3) / 3;
  const open = marketStatus(m) === 'open';
  const a = open ? 0.12 + mag * 0.26 : 0.06 + mag * 0.12;
  return `hsla(${hue(q.pct)},${open ? 85 : 45}%,50%,${a.toFixed(3)})`;
}
// 文明帝國式國界：外圈彩色粗邊 + 內圈白色細線
function borderFor(m) {
  const q = state.quotes[m.s];
  if (!q) return 'rgba(255,255,255,.7)';
  const open = marketStatus(m) === 'open';
  return `hsl(${hue(q.pct)},${open ? 88 : 40}%,${open ? 50 : 62}%)`;
}
const fmtN = (p, mode) => {
  if (p == null || isNaN(p)) return '--';
  const a = Math.abs(p);
  const d = mode === 'short' ? (a >= 1000 ? 0 : 2) : (a >= 10000 ? 0 : 2);
  return p.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
};
const fmtPct = (p, d = 2) => (p >= 0 ? '+' : '') + p.toFixed(d) + '%';
const arrow = (p) => (p > 0 ? '▲' : p < 0 ? '▼' : '–');

/* ================= 資料 ================= */
async function fetchJSON(url) {
  const r = await fetch(url, { cache: 'no-store' });
  if (!r.ok) throw new Error(url + ' ' + r.status);
  return r.json();
}
async function loadQuotes() {
  try {
    const j = await fetchJSON('quotes.json?_=' + Date.now());
    state.quotes = j.quotes || {};
    state.generated = j.generated || null;
    state.demo = false;
  } catch (e) {
    if (!Object.keys(state.quotes).length) {
      state.quotes = makeDemo();
      state.generated = new Date().toISOString();
      state.demo = true;
    }
  }
}
function makeDemo() {
  const q = {};
  for (const i of state.cfg.items) {
    const h = hash(i.s);
    const base = [3000, 8000, 15000, 25000, 500, 60][h % 6] + (h % 997);
    const pct = ((h % 700) - 330) / 100;
    const prev = base / (1 + pct / 100);
    const spark = [0, 1, 2, 3, 4].map((j) => +(prev * (1 + (((h >> j) % 7) - 3) / 300)).toFixed(2));
    spark.push(base);
    q[i.s] = { p: base, pct, c: base - prev, prev, t: Math.floor(Date.now() / 1000), spark };
  }
  return q;
}

/* ================= 地圖 ================= */
let svg, gZoom, gLand, gEdge, gDecor, gMk, zoomB, projection, path, W = 0, H = 0;
let S0 = 1, viewBox = [[0, 0], [1, 1]];

/* ---------- 遊戲風地形（實作在 terrain.js） ---------- */
let tctx = null, dpr = 1, terrainRaf = 0;
function scheduleTerrain() {
  if (!terrainRaf) terrainRaf = requestAnimationFrame(drawTerrain);
}
function drawTerrain() {
  terrainRaf = 0;
  if (tctx && W) Terrain.draw(tctx, state.t, S0, W, H, dpr);
}

/* ---------- 遊戲風元件用的 SVG 定義 ---------- */
function buildDefs() {
  const defs = svg.insert('defs', ':first-child');
  // 動物腳下的柔和接地陰影（不用外框，讓動物像站在地形上而不是貼紙）
  defs.append('filter').attr('id', 'soft').attr('x', '-50%').attr('y', '-100%').attr('width', '200%').attr('height', '300%')
    .append('feGaussianBlur').attr('stdDeviation', 1.4);
  // 動物本體的投影：和地形光影同方向（光從左上來，影子落在右下）
  defs.append('filter').attr('id', 'cast').attr('x', '-30%').attr('y', '-30%').attr('width', '170%').attr('height', '170%')
    .append('feDropShadow').attr('dx', 1.6).attr('dy', 1.2).attr('stdDeviation', 0.9)
    .attr('flood-color', '#14210c').attr('flood-opacity', 0.45);
  // 旗幟底色（深藍漸層）
  const grad = (id, a, b) => {
    const lg = defs.append('linearGradient').attr('id', id).attr('x1', 0).attr('y1', 0).attr('x2', 0).attr('y2', 1);
    lg.append('stop').attr('offset', '0%').attr('stop-color', a);
    lg.append('stop').attr('offset', '100%').attr('stop-color', b);
  };
  grad('bannerBg', '#2c4570', '#14223a');
  grad('bannerOff', '#3c4659', '#222a38');
}

/* ---------- 動物自然走動 ---------- */
const walkers = new Map();
// 各種走路方式：step 步頻、bob 上下起伏（相對身高）、rock 左右搖晃角度、speed 移動速度（身高 / 秒）
const GAITS = {
  walk:   { step: 10, bob: 0.045, rock: 2.5, speed: 0.55 },
  heavy:  { step: 6.5, bob: 0.03, rock: 1.8, speed: 0.38 },
  hop:    { step: 7, bob: 0.32, rock: 0, speed: 0.85 },
  bird:   { step: 13, bob: 0.06, rock: 4, speed: 0.45 },
  waddle: { step: 8, bob: 0.025, rock: 9, speed: 0.3 },
  float:  { step: 5, bob: 0, rock: 2, speed: 0.5, float: true }
};
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)'); // 系統要求減少動態時，動物就待在原地
let walkRaf = 0, walkLast = 0;
function startWalk() {
  if (!walkRaf) { walkLast = performance.now(); walkRaf = requestAnimationFrame(walkStep); }
}
function walkStep(now) {
  walkRaf = 0;
  const dt = Math.min(0.1, (now - walkLast) / 1000);
  walkLast = now;
  const t = now / 1000;
  for (const m of state.maps) {
    const w = walkers.get(m.s);
    if (!w || !w.vis) continue;
    const st = w.st, R = w.size, G = GAITS[w.gait] || GAITS.walk;
    let hop = 0, rot = 0, sy = 1;
    if (st === 'closed' || !state.anim || reduceMotion.matches) {
      // 休市：慢慢走回家，趴下睡覺（身體壓低 + 緩慢呼吸）
      w.tx = 0; w.ty = 0;
      const d = Math.hypot(w.x, w.y);
      if (d > 0.5) { const sp = Math.min(d, R * 1.2 * dt); w.x -= (w.x / d) * sp; w.y -= (w.y / d) * sp; }
      sy = state.anim && !reduceMotion.matches ? 0.9 + Math.sin(t * 1.6 + R) * 0.025 : 0.9;
    } else {
      const speed = R * G.speed * (st === 'break' ? 0.5 : 1);
      const dx = w.tx - w.x, dy = w.ty - w.y, d = Math.hypot(dx, dy);
      if (w.wait > 0 || d < 0.6) {
        w.wait -= dt;
        if (w.wait <= 0 && d < 0.6) {
          // 選下一個目的地（在自己國家附近的小範圍內），走到後會停下來東張西望
          const a = Math.random() * Math.PI * 2, r = 0.35 + Math.sqrt(Math.random()) * 0.65;
          w.tx = Math.cos(a) * r * R * 1.3;
          w.ty = Math.sin(a) * r * R * 0.55;
          w.wait = 0;
        } else if (w.wait <= 0) w.wait = 0;
        sy = 1 + Math.sin(t * 2.4 + R) * 0.018; // 站著時輕輕呼吸
        if (G.float) hop = -R * 0.12 + Math.sin(t * 2.2 + R) * R * 0.05;
      } else {
        const sp = Math.min(d, speed * dt);
        w.x += (dx / d) * sp; w.y += (dy / d) * sp;
        // 往右走就讓面向左的動物翻面（面向右的反過來，正面的不翻）
        if (Math.abs(dx) > 0.3 && w.face !== 'F') w.dir = (dx > 0) === (w.face === 'L') ? -1 : 1;
        w.ph += dt * G.step;
        const s = Math.abs(Math.sin(w.ph));
        if (G.float) hop = -R * 0.12 + Math.sin(w.ph * 0.5) * R * 0.06;
        else hop = -s * R * G.bob;
        rot = Math.sin(w.ph) * G.rock;
        if (G.bob > 0.15) sy = 1 + s * 0.06 - Math.pow(1 - s, 6) * 0.1; // 跳躍型：騰空拉長、落地壓扁
        if (Math.hypot(w.tx - w.x, w.ty - w.y) < 0.6) w.wait = 1 + Math.random() * 3.5;
      }
    }
    // 跳得越高，地上的影子越小越淡
    const lift = Math.min(1, -hop / (R * 0.35));
    w.shadow.setAttribute('transform', `scale(${(1 - lift * 0.35).toFixed(3)})`);
    w.shadow.style.opacity = (1 - lift * 0.5).toFixed(2);
    w.wk.setAttribute('transform', `translate(${w.x.toFixed(2)},${w.y.toFixed(2)})`);
    w.body.setAttribute('transform', `translate(0,${hop.toFixed(2)}) rotate(${rot.toFixed(1)}) scale(${w.dir},${sy.toFixed(3)})`);
  }
  if (!document.hidden) walkRaf = requestAnimationFrame(walkStep);
}
document.addEventListener('visibilitychange', () => { if (!document.hidden) startWalk(); });

function buildSvg() {
  svg = d3.select('#map');
  const cv = $('#terrain');
  tctx = cv.getContext('2d', { alpha: false });
  Terrain.init({ dem: DEM_URL, img: IMG_URL, maxZ: MAX_TILE_Z, onUpdate: scheduleTerrain });
  // 透明的觸控層，讓空白處也能拖曳 / 縮放
  svg.append('rect').attr('class', 'hit').attr('fill', 'transparent');

  gZoom = svg.append('g');
  gLand = gZoom.append('g').attr('class', 'land');
  gEdge = gZoom.append('g').attr('class', 'edge');
  gDecor = svg.append('g').attr('class', 'decor').style('pointer-events', 'none');
  gMk = svg.append('g').attr('class', 'markers');

  gDecor.selectAll('text').data(DECOR).enter().append('text').attr('class', 'dc').text((d) => d[0]);

  buildDefs();
  const g = gMk.selectAll('g.mk').data(state.maps, (d) => d.s).enter().append('g').attr('class', 'mk')
    .on('click', (e, d) => openCard(d));
  g.each(function (d) {
    const s = d3.select(this);
    // 3D 動物：原點就是牠腳踩的地面，會在自己國家附近走動，所以整組放在 walker 裡
    const an = s.append('g').attr('class', 'an');
    const wk = an.append('g').attr('class', 'walker');
    wk.append('ellipse').attr('class', 'ring');   // 開盤中：地面上擴散的光圈
    const shadow = wk.append('ellipse').attr('class', 'shadow').attr('filter', 'url(#soft)');
    const body = wk.append('g').attr('class', 'body');
    const info = animalOf(d.a);
    if (info) {
      const img = body.append('image').attr('class', 'beast').attr('href', info.src).attr('filter', 'url(#cast)')
        .attr('preserveAspectRatio', 'xMidYMax meet');
      // 圖檔載入失敗就退回 emoji
      img.on('error', () => { img.remove(); body.append('text').attr('class', 'emoji').text(d.a); scheduleLayout(); });
    } else body.append('text').attr('class', 'emoji').text(d.a);
    wk.append('text').attr('class', 'mood');
    walkers.set(d.s, {
      wk: wk.node(), body: body.node(), shadow: shadow.node(), face: info ? info.face : 'L', gait: info ? info.gait : 'walk',
      x: 0, y: 0, tx: 0, ty: 0, wait: hash(d.s) % 30 / 10, dir: 1, ph: 0
    });
    // 文明帝國式城市旗幟（左上角放國旗）
    const b = s.append('g').attr('class', 'bubble');
    b.append('rect').attr('class', 'bg').attr('rx', 8);
    b.append('rect').attr('class', 'band').attr('rx', 5);
    b.append('rect').attr('class', 'inner').attr('rx', 6);
    b.append('path').attr('class', 'tail');
    const fs = flagSrc(d.flag);
    if (fs) {
      b.append('image').attr('class', 'flag').attr('href', fs).attr('preserveAspectRatio', 'none');
      b.append('rect').attr('class', 'flag-b').attr('rx', 1.5);
    }
    const t1 = b.append('text').attr('class', 't1');
    t1.append('tspan').attr('class', 'a');
    t1.append('tspan').attr('class', 'm');
    const t2 = b.append('text').attr('class', 't2');
    t2.append('tspan').attr('class', 'va');
    t2.append('tspan').attr('class', 'pc').attr('dx', 5);
  });

  zoomB = d3.zoom().scaleExtent([1, 16]).on('zoom', (e) => { state.t = e.transform; onTransform(); });
  svg.call(zoomB);
}

function layoutGeometry() {
  const st = $('#stage');
  W = st.clientWidth; H = st.clientHeight;
  if (!W || !H) return;
  svg.attr('viewBox', `0 0 ${W} ${H}`);
  svg.select('rect.hit').attr('width', W).attr('height', H);

  // 高 DPI canvas
  dpr = Math.min(window.devicePixelRatio || 1, 3);
  const cv = tctx.canvas;
  cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);

  // Web Mercator：世界是邊長 S0 的正方形，與圖磚座標完全對齊
  const unit = d3.geoMercator().scale(1 / (2 * Math.PI)).translate([0.5, 0.5]);
  const yN = unit([0, VIEW_N])[1], yS = unit([0, VIEW_S])[1];
  S0 = Math.max(W, H / (yS - yN)); // 讓可視範圍在最小縮放時也能填滿畫面
  projection = d3.geoMercator().scale(S0 / (2 * Math.PI)).translate([S0 / 2, S0 / 2]);
  path = d3.geoPath(projection);
  viewBox = [[0, yN * S0], [S0, yS * S0]];

  gLand.selectAll('path').data(state.countries).join('path').attr('d', path);
  gEdge.selectAll('path').data(state.countries.filter((d) => state.byId[pad3(d.id)])).join('path').attr('d', path);
  const maxK = (Math.pow(2, MAX_TILE_Z + 1) * 256) / (S0 * dpr); // 最高層級再多放大 2 倍
  zoomB.extent([[0, 0], [W, H]]).translateExtent(viewBox).scaleExtent([1, maxK]);
  paintLand();
}
function paintLand() {
  if (!gLand) return;
  gLand.selectAll('path').each(function (d) {
    const m = state.byId[pad3(d.id)];
    d3.select(this).classed('hot', !!m)
      .attr('fill', m ? fillFor(m) : 'none')
      .style('stroke', m ? borderFor(m) : null); // 用 style 才能蓋過 CSS 的預設白色國界
  });
}

function regionTransform(key) {
  const R = REGIONS[key];
  if (!R || !R.bbox) return zoomB.constrain()(d3.zoomIdentity, [[0, 0], [W, H]], viewBox);
  const [lo0, la0, lo1, la1] = R.bbox;
  const mx = (lo0 + lo1) / 2, my = (la0 + la1) / 2;
  const pts = [[lo0, la0], [lo1, la0], [lo0, la1], [lo1, la1], [mx, la0], [mx, la1], [lo0, my], [lo1, my]].map((p) => projection(p));
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const k = Math.max(1, Math.min(16, Math.min(W / (x1 - x0), H / (y1 - y0)) * 0.9));
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  const tr = d3.zoomIdentity.translate(W / 2 - k * cx, H / 2 - k * cy).scale(k);
  return zoomB.constrain()(tr, [[0, 0], [W, H]], viewBox);
}
function applyRegion(animate) {
  if (!projection) return;
  const tr = regionTransform(state.activeRegion);
  const sel = animate && state.anim ? svg.transition().duration(900).ease(d3.easeCubicInOut) : svg;
  sel.call(zoomB.transform, tr);
}

function onTransform() {
  gZoom.attr('transform', state.t.toString());
  // 放大到城市 / 街道等級時，國界（50m 精度）會和真實海岸線對不齊，逐漸淡出
  const op = Math.max(0, Math.min(1, 1 - (Math.log2(state.t.k) - 5) / 2));
  gZoom.style('opacity', op).style('display', op > 0 ? null : 'none');
  scheduleTerrain();
  scheduleLayout();
}

/* ---------- 標記佈局（螢幕座標，自動避讓） ---------- */
let raf = 0;
function scheduleLayout() {
  if (raf) return;
  raf = requestAnimationFrame(() => { raf = 0; layoutMarkers(); });
}
const inter = (a, b) => {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? w * h : 0;
};

function layoutMarkers() {
  if (!projection || !state.maps.length) return;
  const t = state.t, k = t.k;
  const size = Math.max(19, Math.min(30, 14 + k * 2.8)); // 動物身高（px），放大地圖時略微變大
  const rects = [], vis = new Map();
  const arr = state.maps.slice().sort((a, b) => b.w - a.w);

  // 第一輪：放動物，太擠的先隱藏（放大後會出現）
  for (const m of arr) {
    const p = projection([m.lon, m.lat]);
    const x = t.applyX(p[0]), y = t.applyY(p[1]);
    if (x < -20 || x > W + 20 || y < -20 || y > H + 20) continue;
    // 原點是腳下的地面，身體往上長；佔位框也包含牠走動的範圍
    const a = { x: x - size * 0.75, y: y - size * 1.05, w: size * 1.5, h: size * 1.35 };
    const area = a.w * a.h;
    if (rects.some((r) => inter(a, r) / area > 0.3)) continue;
    rects.push(a);
    vis.set(m.s, { m, x, y, a, size, b: null });
  }
  // 第二輪：放氣泡，先試完整版，再試迷你版
  for (const m of arr) {
    const o = vis.get(m.s);
    if (!o || !state.quotes[m.s]) continue;
    const modes = [{ w: 118, h: 40, mode: 'full' }, { w: 80, h: 22, mode: 'mini' }];
    outer:
    for (const md of modes) {
      const cands = [
        { x: o.x - md.w / 2, y: o.a.y - md.h - 5, pos: 'up' },
        { x: o.x - md.w / 2, y: o.a.y + o.a.h + 2, pos: 'down' },
        { x: o.a.x + o.a.w + 2, y: o.y - md.h / 2, pos: 'right' },
        { x: o.a.x - md.w - 2, y: o.y - md.h / 2, pos: 'left' }
      ];
      for (const c of cands) {
        const r = { x: c.x, y: c.y, w: md.w, h: md.h };
        if (r.x < 2 || r.y < 2 || r.x + r.w > W - 2 || r.y + r.h > H - 2) continue;
        if (rects.some((z) => inter(r, z) > 0)) continue;
        rects.push(r);
        o.b = { r, mode: md.mode, pos: c.pos };
        break outer;
      }
    }
  }

  gMk.selectAll('g.mk').each(function (m) {
    const s = d3.select(this), o = vis.get(m.s), wk = walkers.get(m.s);
    if (!o) { s.style('display', 'none'); if (wk) wk.vis = false; return; }
    s.style('display', null).attr('transform', `translate(${o.x},${o.y})`);
    const st = marketStatus(m), q = state.quotes[m.s];
    const pct = q ? q.pct : 0;
    if (wk) { wk.vis = true; wk.st = st; wk.size = o.size; }
    const an = s.select('.an').attr('class', 'an ' + st);
    const z = o.size;
    an.select('.ring').attr('rx', z * 0.62).attr('ry', z * 0.22);
    an.select('.shadow').attr('rx', z * 0.36).attr('ry', z * 0.1).attr('cy', -z * 0.02);
    an.select('.beast').attr('x', -z / 2).attr('y', -z).attr('width', z).attr('height', z);
    an.select('.emoji').attr('y', -z * 0.45).attr('font-size', z * 0.9);
    an.select('.mood').attr('x', z * 0.42).attr('y', -z * 0.95).attr('font-size', Math.max(10, z * 0.42))
      .text(st === 'closed' ? '💤' : '');

    const b = s.select('.bubble');
    if (!o.b || !q) { b.style('display', 'none'); return; }
    const { w, h } = o.b.r, full = o.b.mode === 'full', col = pctColor(pct);
    b.style('display', null).attr('transform', `translate(${o.b.r.x - o.x},${o.b.r.y - o.y})`);
    b.select('.bg').attr('width', w).attr('height', h).attr('fill', st === 'closed' ? 'url(#bannerOff)' : 'url(#bannerBg)');
    b.select('.inner').attr('x', 2.5).attr('y', 2.5).attr('width', w - 5).attr('height', h - 5);
    // 旗幟上半部的名稱色帶（漲跌色；休市時變灰）
    b.select('.band').style('display', full ? null : 'none').attr('x', 3).attr('y', 3).attr('width', w - 6).attr('height', 18)
      .attr('fill', st === 'closed' ? '#4a5466' : bandColor(pct));
    b.select('.tail').style('display', o.b.pos === 'up' ? null : 'none')
      .attr('d', `M${w / 2 - 6},${h - 1} L${w / 2},${h + 6} L${w / 2 + 6},${h - 1}`);
    // 國旗：完整版放在名稱色帶左側，迷你版放在漲跌幅左邊
    const hasFlag = !b.select('.flag').empty();
    const fw = full ? 24 : 18, fh = full ? 16 : 12, fx = full ? 6 : 5, fy = full ? 4 : 5;
    b.select('.flag').attr('x', fx).attr('y', fy).attr('width', fw).attr('height', fh)
      .style('opacity', st === 'closed' ? 0.75 : 1);
    b.select('.flag-b').attr('x', fx - 0.5).attr('y', fy - 0.5).attr('width', fw + 1).attr('height', fh + 1);
    const tx0 = hasFlag ? fx + fw + 2 : 0; // 文字置中在國旗右邊剩下的空間
    const t1 = b.select('.t1').attr('x', tx0 + (w - tx0) / 2).attr('y', full ? 12.5 : h / 2 + 0.5);
    const t2 = b.select('.t2').attr('x', w / 2).attr('y', 30).style('display', full ? null : 'none');
    if (full) {
      t1.select('.a').text(hasFlag ? m.short : `${m.flag} ${m.short}`);
      t1.select('.m').text('');
      t2.select('.va').text(fmtN(q.p, 'short'));
      t2.select('.pc').attr('fill', col).text(`${arrow(pct)}${Math.abs(pct).toFixed(2)}%`);
    } else {
      t1.select('.a').text(hasFlag ? '' : m.flag);
      t1.select('.m').attr('fill', col).attr('dx', hasFlag ? 0 : 3).text(fmtPct(pct, 1));
    }
  });

  // 裝飾：不壓住任何標記才顯示
  const ds = Math.max(15, Math.min(24, 14 + k * 1.6));
  gDecor.selectAll('text').each(function (d) {
    const p = projection([d[1], d[2]]);
    const x = t.applyX(p[0]), y = t.applyY(p[1]);
    const r = { x: x - ds / 2, y: y - ds / 2, w: ds, h: ds };
    // 放大後真實地形已經夠豐富，裝飾小圖示就收起來
    const hide = k > 4 || x < 0 || x > W || y < 0 || y > H || rects.some((z) => inter(r, z) > 0);
    d3.select(this).style('display', hide ? 'none' : null).attr('x', x).attr('y', y).attr('font-size', ds);
  });
}

/* ================= HUD / 篩選 / 道具欄 ================= */
function buildChips() {
  const defs = [['auto', '🧭 自動'], ['all', '🌍 全球'], ['asia', '🌏 亞太'], ['europe', '🏰 歐洲'], ['americas', '🗽 美洲'], ['mea', '🐪 中東非洲']];
  const nav = $('#chips');
  nav.innerHTML = defs.map((d) => `<button class="chip gbtn" data-k="${d[0]}">${d[1]}</button>`).join('');
  nav.onclick = (e) => {
    const b = e.target.closest('.chip');
    if (!b) return;
    const k = b.dataset.k;
    if (k === 'auto') { state.auto = true; state.activeRegion = pickAutoRegion(); }
    else { state.auto = false; state.activeRegion = k; }
    updateChips(); applyRegion(true); renderDock();
  };
}
function updateChips() {
  document.querySelectorAll('.chip').forEach((b) => {
    const k = b.dataset.k;
    b.classList.toggle('on', k === 'auto' ? state.auto : k === state.activeRegion);
  });
}

function renderHud() {
  const open = state.maps.filter((m) => marketStatus(m) === 'open');
  const pool = (open.length ? open : state.maps).map((m) => state.quotes[m.s]).filter(Boolean);
  const avg = pool.length ? pool.reduce((a, q) => a + q.pct, 0) / pool.length : 0;
  const fill = $('#hpFill');
  fill.style.width = Math.max(6, Math.min(100, 50 + avg * 12)) + '%';
  fill.style.background = `hsl(${hue(avg)},72%,55%)`;
  $('#hpText').textContent = fmtPct(avg);
  let line;
  if (state.demo) line = '🎮 演示資料（還沒部署爬蟲，數字是隨機的）';
  else {
    const when = state.generated ? new Date(state.generated).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' }) : '--';
    line = `🟢 ${open.length} 個市場開盤中 · 更新於 ${when} · 資料約延遲 15 分鐘`;
  }
  $('#statusLine').textContent = line;
}

function dockRegion() {
  return state.activeRegion === 'all' ? pickAutoRegion() : state.activeRegion;
}
function renderDock() {
  const r = dockRegion();
  const extras = state.bars.filter((i) => i.r === r);
  const globals = state.bars.filter((i) => i.r === 'global');
  $('#dockTitle').textContent = `🎒 道具欄 · ${REGIONS[r].label} 其他指數 + 全球行情`;
  const card = (i, sep) => {
    const q = state.quotes[i.s];
    const v = q ? fmtN(q.p) : '--';
    const p = q ? `<div class="ip" style="color:${pctColor(q.pct)}">${arrow(q.pct)}${Math.abs(q.pct).toFixed(2)}%</div>` : '<div class="ip">--</div>';
    return `<button class="item gbtn${sep ? ' sep' : ''}" data-s="${i.s}"><div class="ie">${flagHtml(i.e)}</div><div class="in">${i.zh}</div><div class="iv">${v}</div>${p}</button>`;
  };
  const box = $('#items');
  const sl = box.scrollLeft;
  box.innerHTML = extras.map((i) => card(i, false)).join('') + globals.map((i, n) => card(i, n === 0 && extras.length > 0)).join('');
  box.scrollLeft = sl;
}

/* ================= 彈窗 ================= */
function showSheet(html) {
  const s = $('#sheet');
  s.innerHTML = `<div class="back"></div><div class="box"><button class="x gbtn" aria-label="關閉">✕</button>${html}</div>`;
  s.hidden = false;
}
function spark(arr, col) {
  if (!arr || arr.length < 2) return '';
  const w = 280, h = 64, p = 8;
  const mn = Math.min(...arr), mx = Math.max(...arr), rg = mx - mn || 1;
  const pts = arr.map((v, i) => [p + (i * (w - 2 * p)) / (arr.length - 1), h - p - ((v - mn) / rg) * (h - 2 * p)]);
  const last = pts[pts.length - 1];
  return `<svg class="spark" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none"><polyline fill="none" stroke="${col}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" points="${pts.map((q) => q.join(',')).join(' ')}"/><circle cx="${last[0]}" cy="${last[1]}" r="4.5" fill="${col}"/></svg>`;
}
function openCard(m) {
  const q = state.quotes[m.s];
  const isMap = m.type === 'map';
  const col = q ? pctColor(q.pct) : '#888';
  let meta = '';
  if (isMap) {
    const st = marketStatus(m);
    const label = { open: '🟢 開盤中', break: '🍱 午休中', closed: '😴 休市' }[st];
    const local = new Intl.DateTimeFormat('zh-TW', { timeZone: m.tz, weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date());
    meta += `<div><b>狀態</b>　${label}</div><div><b>當地時間</b>　${local}（${m.tz}）</div>`;
    if (st !== 'open') {
      const n = nextOpen(m);
      if (n) meta += `<div><b>下次開盤</b>　${new Date(n).toLocaleString('zh-TW', { weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false })}（你的時區）</div>`;
    }
  }
  if (q && q.t) meta += `<div><b>最後成交</b>　${new Date(q.t * 1000).toLocaleString('zh-TW', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })}${q.stale ? '　⚠️ 本輪抓取失敗，沿用舊資料' : ''}</div>`;
  const beast = isMap ? animalOf(m.a) : null;
  const bigIcon = beast ? `<img class="beast3d" src="${beast.src}" alt="${m.a}">` : flagHtml(isMap ? m.a : m.e, 'flg big-flg');
  const chg = q ? `${arrow(q.pct)} ${q.c >= 0 ? '+' : '−'}${fmtN(Math.abs(q.c))}（${fmtPct(q.pct)}）` : '暫無資料';
  showSheet(`
    <div class="hd"><span class="big">${bigIcon}</span>
      <div><div class="nm">${isMap ? flagHtml(m.flag) + ' ' : ''}${m.zh}</div><div class="sym">${m.s}</div></div></div>
    <div class="px">${q ? fmtN(q.p) : '--'}</div>
    <div class="chg" style="color:${col}">${chg}</div>
    ${q ? spark(q.spark, col) : ''}
    <div class="meta">${meta}</div>`);
}
function openSettings() {
  showSheet(`
    <h3>⚙️ 設定</h3>
    <button class="big-btn gbtn" data-act="color">${state.redUp ? '🔴 紅漲綠跌（點我切換）' : '🟢 綠漲紅跌（點我切換）'}</button>
    <button class="big-btn gbtn" data-act="anim">${state.anim ? '🎬 動畫：開（點我關閉）' : '⏸️ 動畫：關（點我開啟）'}</button>
    <p class="small">資料來自 Yahoo Finance，由 GitHub Actions 定時抓取，通常延遲 15 分鐘以上，僅供娛樂參考，不構成投資建議。開盤狀態按各交易所常規時段推算，遇到假日會在資料停止更新後自動變為休市。</p>
    <p class="small">遊戲風地形由程式即時繪製：高度資料來自 AWS Terrain Tiles（Mapzen / SRTM 等），地貌判斷參考 Esri World Imagery（Esri、Maxar、Earthstar Geographics）。3D 動物圖來自 Microsoft Fluent Emoji（MIT 授權），國旗圖來自 flagcdn.com。</p>`);
}
function onSheetClick(e) {
  const s = $('#sheet');
  if (e.target.closest('.x') || e.target.classList.contains('back')) { s.hidden = true; return; }
  const a = e.target.closest('[data-act]');
  if (!a) return;
  if (a.dataset.act === 'color') { state.redUp = !state.redUp; store.set('redUp', state.redUp); refreshView(); }
  if (a.dataset.act === 'anim') { state.anim = !state.anim; store.set('anim', state.anim); document.body.classList.toggle('noanim', !state.anim); }
  openSettings();
}

/* ================= 重新整理 / 啟動 ================= */
function refreshView() {
  paintLand(); scheduleLayout(); renderDock(); renderHud();
}
function tick() {
  if (state.auto) {
    const r = pickAutoRegion();
    if (r !== state.activeRegion) { state.activeRegion = r; updateChips(); applyRegion(true); }
  }
  refreshView();
}

async function init() {
  document.body.classList.toggle('noanim', !state.anim);
  const [cfg, topo] = await Promise.all([fetchJSON('markets.json'), d3.json(TOPO_URL)]);
  state.cfg = cfg;
  state.maps = cfg.items.filter((i) => i.type === 'map').sort((a, b) => a.w - b.w);
  state.bars = cfg.items.filter((i) => i.type === 'bar');
  cfg.items.forEach((i) => (state.bySym[i.s] = i));
  state.maps.forEach((m) => (state.byId[pad3(m.id)] = m));
  state.countries = topojson.feature(topo, topo.objects.countries).features;
  await loadQuotes();

  const desktop = window.matchMedia('(min-width:900px)').matches;
  state.auto = !desktop;
  state.activeRegion = state.auto ? pickAutoRegion() : 'all';

  buildSvg();
  buildChips();
  layoutGeometry();
  updateChips();
  applyRegion(false);
  renderDock();
  renderHud();
  scheduleLayout();
  $('#loading').classList.add('gone');
  startWalk();

  $('#items').addEventListener('click', (e) => {
    const b = e.target.closest('.item');
    if (b && state.bySym[b.dataset.s]) openCard(state.bySym[b.dataset.s]);
  });
  $('#sheet').addEventListener('click', onSheetClick);
  $('#btnSet').addEventListener('click', openSettings);

  let rt = 0;
  if (window.ResizeObserver) {
    new ResizeObserver(() => {
      clearTimeout(rt);
      rt = setTimeout(() => {
        const st = $('#stage');
        if (st.clientWidth === W && st.clientHeight === H) return;
        layoutGeometry(); applyRegion(false); scheduleLayout();
      }, 120);
    }).observe($('#stage'));
  }

  setInterval(async () => { await loadQuotes(); tick(); }, 60000);
  setInterval(tick, 30000);
  document.addEventListener('visibilitychange', async () => {
    if (!document.hidden) { await loadQuotes(); tick(); }
  });
}

init().catch((e) => {
  console.error(e);
  const l = $('#loading');
  if (l) l.innerHTML = '<div class="spin">😵</div><p>地圖載入失敗，請檢查網路後重新整理</p>';
});
})();
