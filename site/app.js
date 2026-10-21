/* 股市大冒險 · 世界指數地圖 */
(function () {
'use strict';

const TOPO_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-50m.json';

// 區域篩選：縮放範圍改由該區市場的實際位置計算（見 regionTransform），不再用一大塊經緯度框
const REGIONS = {
  all:      { label: '🌍 全球' },
  asia:     { label: '🌏 亞太' },
  europe:   { label: '🏰 歐洲' },
  americas: { label: '🗽 美洲' },
  mea:      { label: '🐪 中東非洲' }
};
const REGION_ORDER = ['asia', 'europe', 'americas', 'mea'];
// 區域檢視至少放大幾倍；塞不下的小市場會留在畫面外（拖曳即可看到）
const REGION_MIN_K = 1.5;
const REGION_MAX_K = 5;

// 左側圖層列（手機版是底部導覽列）。之後要加新地圖，在這裡加一筆並把 ready 設成 true 即可
const LAYERS = [
  { k: 'stocks', icon: '📈', label: '股市', title: '世界股市', ready: true },
  { k: 'food', icon: '🍜', label: '美食景點', title: '美食・景點・活動' },
  { k: 'utility', icon: '🌦️', label: '水電天氣', title: '水電・天氣' },
  { k: 'tide', icon: '🌊', label: '海潮', title: '海潮' },
  { k: 'sun', icon: '🌅', label: '日出', title: '日出・日落' }
];
const desktopMQ = window.matchMedia('(min-width:900px)');

// 遊戲風地形的原始資料（都是 Web Mercator 圖磚，且允許跨來源讀取像素）
// - DEM：AWS Terrain Tiles（Terrarium 編碼），提供陸地高度與海洋深度
// - 衛星影像：只拿來「判斷地貌」（沙漠 / 草原 / 森林 / 雪地 / 湖泊），不直接顯示
const DEM_URL = (z, x, y) => `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${z}/${x}/${y}.png`;
const IMG_URL = (z, x, y) => `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`;
const MAX_TILE_Z = 14;           // 最高圖磚層級（約 10 公尺 / 像素），再放大會直接放大這一層
const VIEW_N = 80, VIEW_S = -58; // 可視緯度範圍（Mercator 投影兩極會無限拉長，所以裁掉）

// 地圖上會動的小角色（海洋生物、船、各地的人物）。和市場動物分開，不能點
// src：assets/ 底下的圖；face：圖裡面向哪邊（L / R / F 不翻轉）；s：相對市場動物的大小
// mode：wander 散步 / swim 游泳 / whale 鯨魚噴水 / dolphin 跳出水面 / bob 原地浮沉 / boat 船 /
//       surf 衝浪 / ski 滑雪 / chase 繞圈追逐（lag 是落後的角度）/ still 不動
// sea：在海上（影子改成水波）
const CRITTERS = [
  { src: 'critters/whale-spout.png', alt: 'critters/whale.png', lon: -38, lat: 38, mode: 'whale', s: 1.15, sea: true },
  { src: 'critters/dolphin.png', lon: 72, lat: -12, mode: 'dolphin', s: 0.85, sea: true },
  { src: 'critters/shark.png', lon: 62, lat: -36, mode: 'swim', s: 0.9, sea: true },
  { src: 'critters/fish.png', lon: -74, lat: 16, mode: 'swim', s: 0.6, sea: true },
  { src: 'critters/seal.png', lon: -27, lat: 66, mode: 'bob', s: 0.75, sea: true },
  { src: 'critters/sailboat.png', lon: -140, lat: 22, mode: 'boat', face: 'F', s: 1, sea: true },
  { src: 'critters/sailboat.png', lon: 162, lat: 12, mode: 'boat', face: 'F', s: 1, sea: true },
  // 北海小英雄：維京長船在北海巡航
  { src: 'people/viking.svg', lon: 3.5, lat: 59.5, mode: 'boat', face: 'R', s: 1.35, sea: true },
  // 非洲莽原：獵人追斑馬，旁邊有長頸鹿散步
  { src: 'critters/zebra.png', lon: 36, lat: -3, mode: 'chase', lag: 0, s: 0.95 },
  { src: 'critters/hunter.png', lon: 36, lat: -3, mode: 'chase', lag: 1.05, s: 0.85 },
  { src: 'critters/giraffe.png', lon: 29, lat: -10, mode: 'wander', s: 1.2 },
  // 北極：因紐特（愛斯基摩）人在冰屋旁走來走去
  { src: 'people/igloo.svg', lon: -74, lat: 68.5, mode: 'still', face: 'F', s: 1 },
  { src: 'people/eskimo.svg', lon: -69, lat: 67.6, mode: 'wander', face: 'F', gait: 'waddle', s: 0.85 },
  // 其他特別的人
  { src: 'critters/rower.png', lon: -62, lat: -3.3, mode: 'boat', face: 'F', s: 0.9 },       // 亞馬遜河划船
  { src: 'critters/surfer.png', lon: 155, lat: -30, mode: 'surf', face: 'R', s: 0.9, sea: true }, // 澳洲黃金海岸衝浪
  { src: 'critters/skier.png', lon: 14, lat: 65, mode: 'ski', face: 'R', s: 0.85 }            // 挪威山上滑雪
];
// 雲：固定在地球上（經緯度），隨西風慢慢往東飄，地圖拖曳時跟著地面走
const CLOUD_N = 13, CLOUD_WIND = 0.5; // 每秒往東飄幾度經度

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
  auto: false, activeRegion: 'all', layer: 'stocks', panel: false,
  redUp: store.get('redUp', true),
  anim: store.get('anim', true),
  t: d3.zoomIdentity,
  rot: 0 // 多指數旗幟的輪播序號
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
let svg, gZoom, gWorlds, gLand, gLine, gEdge, gDecor, gMk, zoomB, projection, path, W = 0, H = 0;
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
    const closed = st === 'closed';
    let hop = 0, rot = 0, sy = 1, sleeping = false;
    if (!state.anim || reduceMotion.matches) {
      // 動畫關閉 / 系統要求減少動態：站在原地不動
      w.x = w.y = w.tx = w.ty = 0;
      sleeping = closed;
      if (closed) sy = 0.9;
    } else {
      // 開盤：活潑地走來走去；午休：慢慢走；休市：懶洋洋地散步，大部分時間趴著睡覺
      const speed = R * G.speed * (closed ? 0.35 : st === 'break' ? 0.5 : 1);
      const dx = w.tx - w.x, dy = w.ty - w.y, d = Math.hypot(dx, dy);
      if (w.wait > 0 || d < 0.6) {
        w.wait -= dt;
        if (w.wait <= 0 && d < 0.6) {
          // 選下一個目的地（在自己國家附近的小範圍內），走到後會停下來東張西望
          const a = Math.random() * Math.PI * 2, r = 0.35 + Math.sqrt(Math.random()) * 0.65;
          const span = closed ? 0.7 : 1.3;
          w.tx = Math.cos(a) * r * R * span;
          w.ty = Math.sin(a) * r * R * span * 0.42;
          w.wait = 0;
        } else if (w.wait <= 0) w.wait = 0;
        if (closed) {
          sleeping = true;
          sy = 0.88 + Math.sin(t * 1.7 + R) * 0.035; // 趴著睡，慢慢呼吸
        } else {
          sy = 1 + Math.sin(t * 2.4 + R) * 0.03;   // 站著時輕輕呼吸
          // 偶爾左右張望
          if (w.face !== 'F' && Math.random() < dt * 0.35) w.dir = -w.dir;
        }
        if (G.float) hop = (closed ? -R * 0.04 : -R * 0.12) + Math.sin(t * 2.2 + R) * R * 0.04;
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
        if (Math.hypot(w.tx - w.x, w.ty - w.y) < 0.6) w.wait = closed ? 4 + Math.random() * 6 : 1 + Math.random() * 3.5;
      }
    }
    // 跳得越高，地上的影子越小越淡
    const lift = Math.max(0, Math.min(1, -hop / (R * 0.35)));
    w.shadow.setAttribute('transform', `scale(${(1 - lift * 0.35).toFixed(3)})`);
    w.shadow.style.opacity = (0.5 * (1 - lift * 0.5)).toFixed(2);
    w.mood.style.opacity = sleeping ? '0.9' : '0';   // 💤 只在睡著時出現
    w.wk.setAttribute('transform', `translate(${w.x.toFixed(2)},${w.y.toFixed(2)})`);
    w.body.setAttribute('transform', `translate(0,${hop.toFixed(2)}) rotate(${rot.toFixed(1)}) scale(${w.dir},${sy.toFixed(3)})`);
  }
  stepCritters(dt, t);
  drawClouds(dt);
  if (!document.hidden) walkRaf = requestAnimationFrame(walkStep);
}
document.addEventListener('visibilitychange', () => { if (!document.hidden) startWalk(); });

/* ---------- 小角色：海洋生物、船、各地人物 ---------- */
const critters = [];
const faceDir = (c, dx) => (c.face === 'F' ? 1 : (dx > 0) === (c.face === 'L') ? -1 : 1);
function buildCritters() {
  for (const d of CRITTERS) {
    const g = gDecor.append('g').attr('class', 'cr').style('display', 'none');
    const wk = g.append('g');
    const shadow = wk.append('ellipse').attr('class', d.sea ? 'wake' : 'shadow').attr('filter', 'url(#soft)');
    const body = wk.append('g');
    const img = body.append('image').attr('href', 'assets/' + d.src).attr('preserveAspectRatio', 'xMidYMax meet').attr('filter', 'url(#cast)');
    if (d.alt) new Image().src = 'assets/' + d.alt; // 先載入另一張（鯨魚噴水 / 不噴水）
    critters.push({
      d, g: g.node(), wk: wk.node(), body: body.node(), shadow: shadow.node(), img: img.node(),
      face: d.face || 'L', gait: d.gait || 'walk', x: 0, y: 0, tx: 0, ty: 0, wait: Math.random() * 3,
      dir: 1, ph: Math.random() * 6, size: 20, base: 20, vis: false, spout: true
    });
  }
}
// 在自己附近隨機選點走過去，到了就停一下；回傳是否正在移動
function wander(c, dt, speed, span, sq = 0.42) {
  const dx = c.tx - c.x, dy = c.ty - c.y, d = Math.hypot(dx, dy);
  if (d < 0.6) {
    c.wait -= dt;
    if (c.wait <= 0) {
      const a = Math.random() * Math.PI * 2, r = 0.35 + Math.sqrt(Math.random()) * 0.65;
      c.tx = Math.cos(a) * r * c.base * span;
      c.ty = Math.sin(a) * r * c.base * span * sq;
      c.wait = 1 + Math.random() * 3;
    }
    return false;
  }
  const sp = Math.min(d, speed * dt);
  c.x += (dx / d) * sp; c.y += (dy / d) * sp;
  if (Math.abs(dx) > 0.3) c.dir = faceDir(c, dx);
  return true;
}
function stepCritters(dt, t) {
  const still = !state.anim || reduceMotion.matches;
  for (const c of critters) {
    if (!c.vis) continue;
    const R = c.size, B = c.base, m = c.d.mode;
    let hop = 0, rot = 0, sy = 1, op = 1, wake = 1;
    if (m === 'chase') {
      // 斑馬和獵人用同一個時鐘繞橢圓跑，獵人落後一段角度
      const a = (still ? 0 : t * 0.75) - c.d.lag;
      c.x = Math.cos(a) * B * 1.9; c.y = Math.sin(a) * B * 0.6;
      c.dir = faceDir(c, -Math.sin(a));
      if (!still) {
        c.ph += dt * 13;
        const s = Math.abs(Math.sin(c.ph));
        hop = -s * R * 0.13; rot = Math.sin(c.ph) * 4;
      }
    } else if (still || m === 'still') {
      c.x = c.y = 0;
    } else if (m === 'wander') {
      const G = GAITS[c.gait] || GAITS.walk;
      if (wander(c, dt, R * G.speed, 1.4)) {
        c.ph += dt * G.step;
        const s = Math.abs(Math.sin(c.ph));
        hop = -s * R * G.bob; rot = Math.sin(c.ph) * G.rock;
      } else {
        sy = 1 + Math.sin(t * 2.4 + c.ph) * 0.03;
        if (c.face !== 'F' && Math.random() < dt * 0.3) c.dir = -c.dir;
      }
    } else if (m === 'swim' || m === 'whale') {
      wander(c, dt, R * (m === 'whale' ? 0.22 : 0.38), 2.2, 0.5);
      hop = Math.sin(t * 1.6 + c.ph) * R * 0.05; rot = Math.sin(t * 1.1 + c.ph) * 3;
      if (m === 'whale') {
        // 每 8 秒噴一次水
        const sp = (t + c.ph) % 8 < 2.4;
        if (sp !== c.spout) { c.spout = sp; c.img.setAttribute('href', 'assets/' + (sp ? c.d.src : c.d.alt)); }
      }
    } else if (m === 'bob') {
      hop = Math.sin(t * 1.3 + c.ph) * R * 0.06; rot = Math.sin(t * 0.9 + c.ph) * 4;
      if (c.face !== 'F' && Math.random() < dt * 0.08) c.dir = -c.dir;
    } else if (m === 'boat') {
      wander(c, dt, R * 0.2, 2.4, 0.4);
      hop = Math.sin(t * 1.4 + c.ph) * R * 0.04; rot = Math.sin(t * 1.1 + c.ph) * 4.5;
    } else if (m === 'dolphin') {
      // 來回游，每 3.6 秒跳出水面畫一道弧線，其餘時間在水面下
      const w = (t + c.ph) * 0.22, vx = Math.cos(w);
      c.x = Math.sin(w) * B * 2; c.y = 0;
      c.dir = faceDir(c, vx);
      const u = ((t + c.ph) % 3.6) / 3.6;
      if (u < 0.5) {
        const v = u / 0.5;
        hop = -Math.sin(Math.PI * v) * R * 0.9;
        rot = (0.5 - v) * 70 * (vx < 0 ? 1 : -1); // 上升時抬頭、落下時低頭
        op = Math.min(1, v * 8, (1 - v) * 8);
        wake = 1 - Math.sin(Math.PI * v);
      } else { op = 0; wake = 0.5; }
    } else if (m === 'surf') {
      const w = (t + c.ph) * 0.5;
      c.x = Math.sin(w) * B * 1.6; c.y = 0;
      c.dir = faceDir(c, Math.cos(w));
      hop = -Math.abs(Math.sin((t + c.ph) * 2.2)) * R * 0.12; rot = Math.sin((t + c.ph) * 1.5) * 8;
    } else if (m === 'ski') {
      // 之字形滑下山坡，滑到底淡出再從上面出現
      const u = ((t + c.ph) % 7) / 7, z = Math.PI * 6;
      c.x = (u - 0.5) * B * 2.4 + Math.sin(u * z) * B * 0.35;
      c.y = (u - 0.5) * B * 1.1;
      c.dir = faceDir(c, 2.4 + Math.cos(u * z) * 0.35 * z);
      rot = Math.cos(u * z) * 10;
      op = Math.min(1, u / 0.08, (1 - u) / 0.1);
    }
    const lift = Math.max(0, Math.min(1, -hop / (R * 0.35)));
    c.shadow.setAttribute('transform', `scale(${(1 - lift * 0.4).toFixed(3)})`);
    c.shadow.style.opacity = (c.d.sea ? 0.42 * wake : 0.45 * (1 - lift * 0.5) * op).toFixed(2);
    c.body.style.opacity = op.toFixed(2);
    c.wk.setAttribute('transform', `translate(${c.x.toFixed(2)},${c.y.toFixed(2)})`);
    c.body.setAttribute('transform', `translate(0,${hop.toFixed(2)}) rotate(${rot.toFixed(1)}) scale(${c.dir},${sy.toFixed(3)})`);
  }
}

/* ---------- 雲：固定在地球上的卡通雲 + 地面上的雲影 ---------- */
let cctx = null, cloudT = 0;
const clouds = [];
const rng = (seed) => { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); };
// 用幾顆圓疊出蓬鬆的雲：底色偏藍灰，每顆圓往上偏一點蓋白色漸層，底部切平，最後輕微模糊讓邊緣柔和
function makeCloudSprite(seed) {
  const r = rng(seed), w = 320, h = 200, base = h * 0.74;
  const puffs = [];
  const nb = 4 + Math.floor(r() * 2);
  for (let i = 0; i < nb; i++) puffs.push([w * (0.2 + (0.6 * i) / (nb - 1)) + (r() - 0.5) * 14, h * 0.62, w * (0.11 + r() * 0.05)]);
  const nt = 2 + Math.floor(r() * 2);
  for (let i = 0; i < nt; i++) puffs.push([w * (0.36 + (0.28 * i) / Math.max(1, nt - 1)) + (r() - 0.5) * 20, h * (0.42 + r() * 0.06), w * (0.14 + r() * 0.06)]);
  const canvas = () => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  const blob = (g, fill) => {
    g.fillStyle = fill; g.beginPath();
    for (const [x, y, rr] of puffs) { g.moveTo(x + rr, y); g.arc(x, y, rr, 0, Math.PI * 2); }
    g.fill();
  };
  const raw = canvas(), g = raw.getContext('2d');
  blob(g, '#a7b9d2');
  for (const [x, y, rr] of puffs) {
    const gr = g.createRadialGradient(x - rr * 0.35, y - rr * 0.5, rr * 0.1, x, y - rr * 0.12, rr);
    gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.65, '#f4f8fd'); gr.addColorStop(1, '#d3dfee');
    g.fillStyle = gr; g.beginPath(); g.arc(x, y - rr * 0.13, rr * 0.93, 0, Math.PI * 2); g.fill();
  }
  // 底部漸漸變透明（不要一刀切平，否則像貼紙）
  g.globalCompositeOperation = 'destination-out';
  const cut = g.createLinearGradient(0, base - 18, 0, base + 14);
  cut.addColorStop(0, 'rgba(0,0,0,0)'); cut.addColorStop(1, 'rgba(0,0,0,1)');
  g.fillStyle = cut; g.fillRect(0, base - 18, w, h - base + 18);
  g.globalCompositeOperation = 'source-atop';
  const band = g.createLinearGradient(0, base - 34, 0, base);
  band.addColorStop(0, 'rgba(150,172,204,0)'); band.addColorStop(1, 'rgba(150,172,204,.75)');
  g.fillStyle = band; g.fillRect(0, base - 34, w, 34);
  const body = canvas(), b = body.getContext('2d');
  b.filter = 'blur(1.2px)'; b.drawImage(raw, 0, 0);
  // 地上的雲影：同樣的外形塗深色，再大幅模糊
  const sil = canvas(), s = sil.getContext('2d');
  s.drawImage(raw, 0, 0); s.globalCompositeOperation = 'source-in'; s.fillStyle = '#0a1a2c'; s.fillRect(0, 0, w, h);
  const shadow = canvas(), sh = shadow.getContext('2d');
  sh.filter = 'blur(9px)'; sh.drawImage(sil, 0, 0);
  return { body, shadow };
}
function buildClouds() {
  cctx = $('#clouds').getContext('2d');
  const sprites = [0, 1, 2, 3].map((i) => makeCloudSprite(1234 + i * 777));
  const r = rng(42);
  for (let i = 0; i < CLOUD_N; i++) {
    clouds.push({
      lon: -180 + 360 * ((i + r() * 0.8) / CLOUD_N), lat: -42 + r() * 104,
      w: 48 + r() * 60, sp: sprites[i % 4], a: 0.6 + r() * 0.2, v: 0.7 + r() * 0.6
    });
  }
}
function drawClouds(dt) {
  if (!cctx || !W || !projection) return;
  const ctx = cctx, t = state.t, k = t.k, ww = S0 * k;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  const fade = Math.max(0, Math.min(1, (4.5 - k) / 2.5)); // 放大到 4.5 倍以上就看不到雲
  if (!fade) return;
  if (state.anim && !reduceMotion.matches) cloudT += dt;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const sc = Math.pow(k, 0.6); // 位置完全跟著地圖；大小只略微放大，免得近看時整片白
  const list = [];
  for (const c of clouds) {
    const lon = c.lon + cloudT * CLOUD_WIND * c.v;
    const fx = ((((lon + 180) / 360) % 1) + 1) % 1;
    const w = c.w * sc, h = w * 0.625;
    const y = t.applyY(projection([0, c.lat])[1]) - h * 0.6;
    if (y > H || y + h < 0) continue;
    for (const x0 of [t.x + fx * ww - ww, t.x + fx * ww, t.x + fx * ww + ww]) {
      const x = x0 - w / 2;
      if (x < W + w * 0.3 && x + w * 1.3 > 0) list.push([c, x, y, w, h]);
    }
  }
  // 先畫全部雲影（往右下偏，光從左上來），再畫雲
  ctx.globalAlpha = 0.2 * fade;
  for (const [c, x, y, w, h] of list) ctx.drawImage(c.sp.shadow, x + w * 0.16, y + w * 0.3, w, h);
  for (const [c, x, y, w, h] of list) { ctx.globalAlpha = c.a * fade; ctx.drawImage(c.sp.body, x, y, w, h); }
  ctx.globalAlpha = 1;
}

function buildSvg() {
  svg = d3.select('#map');
  const cv = $('#terrain');
  tctx = cv.getContext('2d', { alpha: false });
  Terrain.init({ dem: DEM_URL, img: IMG_URL, maxZ: MAX_TILE_Z, onUpdate: scheduleTerrain });
  // 透明的觸控層，讓空白處也能拖曳 / 縮放
  svg.append('rect').attr('class', 'hit').attr('fill', 'transparent');

  gZoom = svg.append('g');
  // 東西向無限循環：國界畫兩份真的路徑（本體 + 右邊副本），平移時接在一起。
  // 不用 SVG <use> 複製，因為 Chrome 重建 <use> 副本時半透明填色會掉成預設的黑色。
  // gLand / gLine / gEdge 各是「兩個群組」的選取，資料綁定和上色會同時套到兩份。
  for (let i = 0; i < 2; i++) {
    const w = gZoom.append('g').attr('class', 'world');
    // 文明帝國式國界三層：寬而淡的漲跌色光暈（land）→ 清楚的漲跌色主線（line）→ 中央白色細線（edge）
    w.append('g').attr('class', 'land');
    w.append('g').attr('class', 'line');
    w.append('g').attr('class', 'edge');
  }
  gWorlds = gZoom.selectAll('g.world');
  gLand = gZoom.selectAll('g.land');
  gLine = gZoom.selectAll('g.line');
  gEdge = gZoom.selectAll('g.edge');
  gDecor = svg.append('g').attr('class', 'decor').style('pointer-events', 'none');
  gMk = svg.append('g').attr('class', 'markers');

  buildCritters();
  buildClouds();

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
    const mood = wk.append('text').attr('class', 'mood');
    walkers.set(d.s, {
      wk: wk.node(), body: body.node(), shadow: shadow.node(), mood: mood.node(), face: info ? info.face : 'L', gait: info ? info.gait : 'walk',
      x: 0, y: 0, tx: 0, ty: 0, wait: hash(d.s) % 30 / 10, dir: 1, ph: 0
    });
    // 文明帝國式城市旗幟：深色外框 + 金色細邊 + 內側淡金線，左上角放國旗
    const b = s.append('g').attr('class', 'bubble');
    b.append('path').attr('class', 'tail-o');   // 尖角的深色外框（畫在底板下面）
    b.append('rect').attr('class', 'bg').attr('rx', 7);
    b.append('rect').attr('class', 'band').attr('rx', 4.5);
    b.append('line').attr('class', 'sep');
    b.append('rect').attr('class', 'inner').attr('rx', 5);
    b.append('rect').attr('class', 'rim').attr('rx', 7);
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
    t2.append('tspan').attr('class', 'lb');
    t2.append('tspan').attr('class', 'va');
    t2.append('tspan').attr('class', 'pc').attr('dx', 5);
    // 同一國家有多個指數（例如美國：標普 / 那斯達克 / 道瓊 / 費半）
    if (d.group.length > 1) {
      const rows = b.append('g').attr('class', 'rows');
      d.group.forEach((x) => {
        const r = rows.append('g').attr('class', 'row');
        r.append('rect').attr('class', 'rbg');
        r.append('text').attr('class', 'rn').text(x.abbr || x.zh);
        r.append('text').attr('class', 'rv');
        r.append('text').attr('class', 'rp');
      });
      const dots = b.append('g').attr('class', 'dots');
      d.group.forEach(() => dots.append('circle').attr('r', 1.9));
    }
  });

  // d3 zoom 內部的 x 可以一直往左右累加；畫面上只用「繞回一圈內」的版本（state.t），世界就能無限循環
  zoomB = d3.zoom().scaleExtent([1, 16]).on('zoom', (e) => { state.t = wrapT(e.transform); onTransform(); });
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
  for (const cv of [tctx.canvas, cctx.canvas]) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }

  // Web Mercator：世界是邊長 S0 的正方形，與圖磚座標完全對齊
  const unit = d3.geoMercator().scale(1 / (2 * Math.PI)).translate([0.5, 0.5]);
  const yN = unit([0, VIEW_N])[1], yS = unit([0, VIEW_S])[1];
  S0 = Math.max(W, H / (yS - yN)); // 讓可視範圍在最小縮放時也能填滿畫面
  projection = d3.geoMercator().scale(S0 / (2 * Math.PI)).translate([S0 / 2, S0 / 2]);
  path = d3.geoPath(projection);
  viewBox = [[0, yN * S0], [S0, yS * S0]];

  gLand.selectAll('path').data(state.countries).join('path').attr('d', path);
  const hot = state.countries.filter((d) => state.byId[pad3(d.id)]);
  gLine.selectAll('path').data(hot).join('path').attr('d', path);
  gEdge.selectAll('path').data(hot).join('path').attr('d', path);
  gWorlds.attr('transform', (_, i) => (i ? `translate(${S0},0)` : null)); // 第二份接在世界右邊
  const maxK = (Math.pow(2, MAX_TILE_Z + 1) * 256) / (S0 * dpr); // 最高層級再多放大 2 倍
  zoomB.extent([[0, 0], [W, H]]).translateExtent(panExtent()).scaleExtent([1, maxK]);
  paintLand();
}
// 東西向不限制（無限循環），南北仍限制在可視緯度內
const panExtent = () => [[-Infinity, viewBox[0][1]], [Infinity, viewBox[1][1]]];
// 把 x 繞回 (-世界寬, 0]，讓世界本體從畫面左緣（或更左）開始，右邊接一份副本
function wrapT(t) {
  const ww = S0 * t.k;
  let x = t.x % ww;
  if (x > 0) x -= ww;
  return x === t.x ? t : d3.zoomIdentity.translate(x, t.y).scale(t.k);
}
// 地理座標 → 螢幕座標；世界有兩份（本體 + 右邊副本），回傳在畫面內的那一份
function screenXY(lon, lat) {
  const p = projection([lon, lat]), t = state.t;
  let x = t.applyX(p[0]);
  if (x < -40) x += S0 * t.k;
  return [x, t.applyY(p[1])];
}
function paintLand() {
  if (!gLand) return;
  gLand.selectAll('path').each(function (d) {
    const m = state.byId[pad3(d.id)];
    d3.select(this).classed('hot', !!m)
      .attr('fill', m ? fillFor(m) : 'none')
      .style('stroke', m ? borderFor(m) : null); // 用 style 才能蓋過 CSS 的預設白色國界
  });
  gLine.selectAll('path').style('stroke', (d) => borderFor(state.byId[pad3(d.id)]));
}

// 地圖上被浮動介面蓋住的邊距（篩選列、手機版概況卡、展開的其它指數面板）
function overlayInsets() {
  const sr = $('#stage').getBoundingClientRect();
  const box = (sel) => { const el = $(sel); return el && !el.hidden && el.offsetParent !== null ? el.getBoundingClientRect() : null; };
  const ins = { t: 0, r: 0, b: 0, l: 0 };
  const chips = box('#chips'), hud = box('#hud'), panel = box('#panel');
  if (chips) ins.t = chips.bottom - sr.top;
  if (desktopMQ.matches) {
    if (panel) ins.l = panel.right - sr.left;
  } else {
    if (hud) ins.t = Math.max(ins.t, hud.bottom - sr.top);
    if (panel) ins.b = sr.bottom - panel.top;
  }
  return ins;
}
// 區域縮放：用該區市場的位置算出範圍，按權重由大到小加入；
// 若再加入某個市場會讓放大倍率低於 REGION_MIN_K，就跳過它（例如手機直式畫面的紐西蘭）。
// 舊版用涵蓋整片海洋的經緯度框，加上上下兩條欄位吃掉高度，亞太、美洲幾乎沒有放大。
function regionTransform(key) {
  const world = () => zoomB.constrain()(d3.zoomIdentity, [[0, 0], [W, H]], panExtent());
  const ms = state.maps.filter((m) => m.r === key).sort((a, b) => b.w - a.w);
  if (!ms.length) return world();
  const ins = overlayInsets();
  // 預留旗幟的空間：旗幟通常在動物上方，所以上方留比較多
  const px = desktopMQ.matches ? 70 : 46, pt = 72, pb = 34, minK = REGION_MIN_K;
  const aw = Math.max(80, W - ins.l - ins.r - px * 2), ah = Math.max(80, H - ins.t - ins.b - pt - pb);
  const fitK = (b) => Math.min(aw / Math.max(1, b[2] - b[0]), ah / Math.max(1, b[3] - b[1]));
  let bb = null;
  for (const m of ms) {
    const p = projection([m.lon, m.lat]);
    const nb = bb ? [Math.min(bb[0], p[0]), Math.min(bb[1], p[1]), Math.max(bb[2], p[0]), Math.max(bb[3], p[1])] : [p[0], p[1], p[0], p[1]];
    if (!bb || fitK(nb) >= minK) bb = nb;
  }
  const k = Math.max(1, Math.min(REGION_MAX_K, fitK(bb)));
  const cx = (bb[0] + bb[2]) / 2, cy = (bb[1] + bb[3]) / 2;
  // 對齊可用區域的中心（扣掉被介面蓋住的部分）
  const sx = ins.l + px + aw / 2, sy = ins.t + pt + ah / 2;
  const tr = d3.zoomIdentity.translate(sx - k * cx, sy - k * cy).scale(k);
  return zoomB.constrain()(tr, [[0, 0], [W, H]], panExtent());
}
// 世界會循環，同一個區域在左右各有一份；挑離目前畫面最近的那份，動畫才不會繞地球好幾圈
function nearestCopy(tr) {
  const t0 = d3.zoomTransform(svg.node());
  const c0 = (W / 2 - t0.x) / t0.k, c1 = (W / 2 - tr.x) / tr.k;
  const m = Math.round((c0 - c1) / S0);
  return m ? d3.zoomIdentity.translate(tr.x - tr.k * m * S0, tr.y).scale(tr.k) : tr;
}
function applyRegion(animate) {
  if (!projection) return;
  const tr = nearestCopy(regionTransform(state.activeRegion));
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
    const [x, y] = screenXY(m.lon, m.lat);
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
    // 多指數的國家：空間夠就整張列出（multi），不夠就輪播（full），再不夠只顯示主指數（mini）
    const n = m.group.length;
    const modes = n > 1
      ? [{ w: 166, h: 24 + n * 16 + 4, mode: 'multi' }, { w: 136, h: 40, mode: 'full' }, { w: 80, h: 22, mode: 'mini' }]
      : [{ w: 118, h: 40, mode: 'full' }, { w: 80, h: 22, mode: 'mini' }];
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
    const { w, h } = o.b.r, mode = o.b.mode, mini = mode === 'mini', multi = mode === 'multi';
    const n = m.group.length;
    // 輪播：多指數國家在 full 模式下，每隔幾秒換下一個指數
    const cur = mode === 'full' && n > 1 ? m.group[state.rot % n] : m;
    const cq = state.quotes[cur.s], cp = cq ? cq.pct : 0;
    const col = pctColor(pct);
    // 對齊整數像素，細線才會銳利
    const bx = Math.round(o.b.r.x), by = Math.round(o.b.r.y);
    b.style('display', null).attr('transform', `translate(${bx - o.x},${by - o.y})`);
    b.select('.bg').attr('x', 0.5).attr('y', 0.5).attr('width', w - 1).attr('height', h - 1)
      .attr('fill', st === 'closed' ? 'url(#bannerOff)' : 'url(#bannerBg)');
    b.select('.rim').attr('x', 0.5).attr('y', 0.5).attr('width', w - 1).attr('height', h - 1);
    b.select('.inner').attr('x', 3).attr('y', 3).attr('width', w - 6).attr('height', h - 6);
    // 旗幟上半部的名稱色帶（漲跌色；休市時變灰），底下一條淡金分隔線
    const bandH = 18;
    b.select('.band').style('display', mini ? 'none' : null).attr('x', 3).attr('y', 3).attr('width', w - 6).attr('height', bandH)
      .attr('fill', st === 'closed' ? '#4a5466' : bandColor(pct));
    b.select('.sep').style('display', mini ? 'none' : null)
      .attr('x1', 4).attr('x2', w - 4).attr('y1', 3 + bandH + 0.5).attr('y2', 3 + bandH + 0.5);
    const tail = `M${w / 2 - 6},${h - 1} L${w / 2},${h + 6} L${w / 2 + 6},${h - 1}`;
    b.selectAll('.tail,.tail-o').style('display', o.b.pos === 'up' ? null : 'none').attr('d', tail);
    // 國旗：完整版放在名稱色帶左側，迷你版放在漲跌幅左邊
    const hasFlag = !b.select('.flag').empty();
    const fw = mini ? 18 : 24, fh = mini ? 12 : 16, fx = mini ? 5 : 6, fy = mini ? 5 : 4;
    b.select('.flag').attr('x', fx).attr('y', fy).attr('width', fw).attr('height', fh)
      .style('opacity', st === 'closed' ? 0.75 : 1);
    b.select('.flag-b').attr('x', fx - 0.5).attr('y', fy - 0.5).attr('width', fw + 1).attr('height', fh + 1);
    // 輪播頁碼小圓點（色帶右側）
    const dotW = mode === 'full' && n > 1 ? n * 6 + 4 : 0;
    b.select('.dots').style('display', dotW ? null : 'none').selectAll('circle')
      .attr('cx', (_, i) => w - 9 - (n - 1 - i) * 6).attr('cy', 12)
      .attr('class', (_, i) => (i === state.rot % n ? 'on' : null));
    const tx0 = hasFlag ? fx + fw + 2 : 0, tx1 = w - dotW; // 文字置中在國旗和圓點之間
    const t1 = b.select('.t1').attr('x', (tx0 + tx1) / 2).attr('y', mini ? h / 2 + 0.5 : 12.5);
    const t2 = b.select('.t2').attr('x', w / 2).attr('y', 30).style('display', mode === 'full' ? null : 'none');
    b.select('.rows').style('display', multi ? null : 'none');
    if (!mini) {
      t1.select('.a').text(hasFlag ? m.short : `${m.flag} ${m.short}`);
      t1.select('.m').text('');
    }
    if (mode === 'full') {
      t2.select('.lb').text(n > 1 ? (cur.abbr || cur.zh) + ' ' : '');
      t2.select('.va').text(cq ? fmtN(cq.p, 'short') : '--');
      t2.select('.pc').attr('fill', pctColor(cp)).text(cq ? `${arrow(cp)}${Math.abs(cp).toFixed(2)}%` : '');
    } else if (multi) {
      b.selectAll('.row').each(function (_, i) {
        // 注意：d3 append 的子元素會繼承父層資料，所以要用序號去 group 裡拿對應的指數
        const x = m.group[i], r = d3.select(this), rq = state.quotes[x.s], y = 24 + i * 16;
        r.select('.rbg').attr('x', 4).attr('y', y).attr('width', w - 8).attr('height', 16).classed('odd', i % 2 === 1);
        r.select('.rn').attr('x', 9).attr('y', y + 8.5);
        r.select('.rv').attr('x', w - 56).attr('y', y + 8.5).text(rq ? fmtN(rq.p, 'short') : '--');
        r.select('.rp').attr('x', w - 8).attr('y', y + 8.5)
          .attr('fill', rq ? pctColor(rq.pct) : null).text(rq ? `${arrow(rq.pct)}${Math.abs(rq.pct).toFixed(2)}%` : '');
      });
    } else {
      t1.select('.a').text(hasFlag ? '' : m.flag);
      t1.select('.m').attr('fill', col).attr('dx', hasFlag ? 0 : 3).text(fmtPct(pct, 1));
    }
  });

  // 小角色：活動範圍不壓住市場標記才顯示；放大到街道等級就收起來
  // 小角色比市場動物大一點，世界視角也看得出在做什麼
  const csz = Math.max(24, Math.min(44, 16 + k * 5));
  for (const c of critters) {
    const [x, y] = screenXY(c.d.lon, c.d.lat);
    const size = csz, z = size * c.d.s, reach = { chase: 2.4, dolphin: 2.4, surf: 2, ski: 1.6 }[c.d.mode] || 1.1;
    const r = { x: x - size * reach, y: y - size * 1.1, w: size * reach * 2, h: size * 1.4 };
    const hide = k > 6 || x < -size * 3 || x > W + size * 3 || y < -size * 2 || y > H + size * 2 ||
      rects.some((q) => inter(r, q) / (r.w * r.h) > 0.15);
    c.vis = !hide; c.size = z; c.base = size;
    c.g.style.display = hide ? 'none' : null;
    if (hide) continue;
    c.g.setAttribute('transform', `translate(${x.toFixed(1)},${y.toFixed(1)})`);
    c.img.setAttribute('x', -z / 2); c.img.setAttribute('y', -z);
    c.img.setAttribute('width', z); c.img.setAttribute('height', z);
    c.shadow.setAttribute('rx', z * (c.d.sea ? 0.46 : 0.36)); c.shadow.setAttribute('ry', z * (c.d.sea ? 0.12 : 0.1));
    c.shadow.setAttribute('cy', -z * 0.03);
  }
}

/* ================= 圖層列 / 篩選列 / 其它指數面板 ================= */
function buildRail() {
  $('#layers').innerHTML = LAYERS.map((l) =>
    `<button class="rl${l.k === state.layer ? ' on' : ''}" data-k="${l.k}" title="${l.title}${l.ready ? '' : '（即將推出）'}"` +
    ` aria-pressed="${l.k === state.layer}"${l.ready ? '' : ' aria-disabled="true"'}>` +
    `<span class="ri">${l.icon}</span><span class="rt">${l.label}</span>${l.ready ? '' : '<i class="soon">即將</i>'}</button>`).join('');
  $('#layers').onclick = (e) => {
    const b = e.target.closest('.rl');
    if (!b) return;
    const l = LAYERS.find((x) => x.k === b.dataset.k);
    if (!l.ready) { toast(`🚧 ${l.title}地圖即將推出`); return; }
    state.layer = l.k;
    document.querySelectorAll('#layers .rl').forEach((x) => {
      x.classList.toggle('on', x.dataset.k === l.k);
      x.setAttribute('aria-pressed', x.dataset.k === l.k);
    });
  };
}
let toastT = 0;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastT);
  toastT = setTimeout(() => t.classList.remove('show'), 2200);
}

function buildChips() {
  const defs = [['auto', '🧭', '自動'], ['all', '🌍', '全球'], ['asia', '🌏', '亞太'], ['europe', '🏰', '歐洲'], ['americas', '🗽', '美洲'], ['mea', '🐪', '中東非洲']];
  const chip = (k, i, t) => `<button class="chip gbtn" data-k="${k}" aria-pressed="false"><span class="ci">${i}</span>${t}</button>`;
  const nav = $('#chips');
  // 區域是單選；「其它指數」是獨立的開關，用分隔線隔開
  nav.innerHTML = defs.map((d) => chip(...d)).join('') + '<span class="csep" aria-hidden="true"></span>' + chip('more', '📊', '其它指數');
  nav.onclick = (e) => {
    const b = e.target.closest('.chip');
    if (!b) return;
    const k = b.dataset.k;
    if (k === 'more') { setPanel(!state.panel); return; }
    if (k === 'auto') { state.auto = true; state.activeRegion = pickAutoRegion(); }
    else { state.auto = false; state.activeRegion = k; }
    updateChips(); applyRegion(true); renderPanel();
  };
}
function updateChips() {
  document.querySelectorAll('.chip').forEach((b) => {
    const k = b.dataset.k;
    const on = k === 'more' ? state.panel : k === 'auto' ? state.auto : !state.auto && k === state.activeRegion;
    b.classList.toggle('on', on);
    b.setAttribute('aria-pressed', on);
  });
}
function setPanel(open) {
  state.panel = open;
  const p = $('#panel');
  p.hidden = !open;
  document.body.classList.toggle('panel-open', open);
  updateChips();
  if (open) { renderPanel(); p.scrollTop = 0; }
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

// 面板以目前區域為主（全球檢視時用自動判斷的區域）
function panelRegion() {
  return state.activeRegion === 'all' ? pickAutoRegion() : state.activeRegion;
}
// 其它指數面板：目前區域 → 全球行情 → 其他區域，每列點一下開詳情卡
function renderPanel() {
  const p = $('#panel');
  if (!state.panel) return;
  const cur = panelRegion();
  const row = (i) => {
    const q = state.quotes[i.s];
    const pc = q ? `<small style="color:${pctColor(q.pct)}">${arrow(q.pct)}${Math.abs(q.pct).toFixed(2)}%</small>` : '<small>--</small>';
    return `<li><button class="li" data-s="${i.s}"><span class="li-i">${flagHtml(i.e)}</span>` +
      `<span class="li-n"><b>${i.zh}</b><small>${i.s}</small></span>` +
      `<span class="li-v"><b>${q ? fmtN(q.p) : '--'}</b>${pc}</span></button></li>`;
  };
  const sec = (title, list) => (list.length ? `<h4>${title}</h4><ul>${list.map(row).join('')}</ul>` : '');
  const by = (r) => state.bars.filter((i) => i.r === r);
  const others = REGION_ORDER.filter((r) => r !== cur).map((r) => sec(`${REGIONS[r].label} 其它指數`, by(r))).join('');
  const st = p.scrollTop;
  p.innerHTML = `<div class="ph"><span class="grip" aria-hidden="true"></span><h3>📊 其它指數</h3>` +
    `<button class="x gbtn" data-act="close-panel" aria-label="關閉其它指數">✕</button></div>` +
    `<div class="pb">${sec(`${REGIONS[cur].label} 其它指數`, by(cur))}${sec('🌐 全球行情', by('global'))}${others}</div>`;
  p.scrollTop = st;
}

/* ================= 彈窗 ================= */
function showSheet(html) {
  const s = $('#sheet');
  const still = !s.hidden; // 已經打開時（例如切換分頁）就不要再播放滑入動畫
  s.innerHTML = `<div class="back"></div><div class="box${still ? ' still' : ''}"><button class="x gbtn" aria-label="關閉">✕</button>${html}</div>`;
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
  // 同國其他指數（sub）沿用主指數的國家、時區與交易時段
  const host = isMap ? m : m.type === 'sub' ? state.bySym[m.of] : null;
  const col = q ? pctColor(q.pct) : '#888';
  let meta = '';
  if (host) {
    const st = marketStatus(host);
    const label = { open: '🟢 開盤中', break: '🍱 午休中', closed: '😴 休市' }[st];
    const local = new Intl.DateTimeFormat('zh-TW', { timeZone: host.tz, weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date());
    meta += `<div><b>狀態</b>　${label}</div><div><b>當地時間</b>　${local}（${host.tz}）</div>`;
    if (st !== 'open') {
      const n = nextOpen(host);
      if (n) meta += `<div><b>下次開盤</b>　${new Date(n).toLocaleString('zh-TW', { weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false })}（你的時區）</div>`;
    }
  }
  if (q && q.t) meta += `<div><b>最後成交</b>　${new Date(q.t * 1000).toLocaleString('zh-TW', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })}${q.stale ? '　⚠️ 本輪抓取失敗，沿用舊資料' : ''}</div>`;
  const beast = isMap ? animalOf(m.a) : null;
  const bigIcon = beast ? `<img class="beast3d" src="${beast.src}" alt="${m.a}">` : flagHtml(isMap ? m.a : m.e, 'flg big-flg');
  const chg = q ? `${arrow(q.pct)} ${q.c >= 0 ? '+' : '−'}${fmtN(Math.abs(q.c))}（${fmtPct(q.pct)}）` : '暫無資料';
  // 多指數國家：卡片上方一排分頁，點一下切換到該指數
  const grp = host && host.group && host.group.length > 1 ? host.group : null;
  const tabs = grp ? `<div class="gtabs" role="tablist">${grp.map((x) => {
    const xq = state.quotes[x.s];
    const xp = xq ? `<span style="color:${pctColor(xq.pct)}">${arrow(xq.pct)}${Math.abs(xq.pct).toFixed(2)}%</span>` : '<span>--</span>';
    return `<button class="gtab gbtn${x === m ? ' on' : ''}" role="tab" aria-selected="${x === m}" data-s="${x.s}"><b>${x.abbr || x.zh}</b>${xp}</button>`;
  }).join('')}</div>` : '';
  showSheet(`
    <div class="hd"><span class="big">${bigIcon}</span>
      <div><div class="nm">${host ? flagHtml(host.flag) + ' ' : ''}${m.zh}</div><div class="sym">${m.s}</div></div></div>
    ${tabs}
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
  const tab = e.target.closest('.gtab');
  if (tab && state.bySym[tab.dataset.s]) { openCard(state.bySym[tab.dataset.s]); return; }
  const a = e.target.closest('[data-act]');
  if (!a) return;
  if (a.dataset.act === 'color') { state.redUp = !state.redUp; store.set('redUp', state.redUp); refreshView(); }
  if (a.dataset.act === 'anim') { state.anim = !state.anim; store.set('anim', state.anim); document.body.classList.toggle('noanim', !state.anim); }
  openSettings();
}

/* ================= 重新整理 / 啟動 ================= */
function refreshView() {
  paintLand(); scheduleLayout(); renderPanel(); renderHud();
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
  // 同國其他指數（type "sub"，of 指向主指數）併成一組，主指數排第一個
  state.maps.forEach((m) => (m.group = [m, ...cfg.items.filter((i) => i.type === 'sub' && i.of === m.s)]));
  state.maps.forEach((m) => (state.byId[pad3(m.id)] = m));
  state.countries = topojson.feature(topo, topo.objects.countries).features;
  await loadQuotes();

  state.auto = !desktopMQ.matches;
  state.activeRegion = state.auto ? pickAutoRegion() : 'all';

  buildSvg();
  buildRail();
  buildChips();
  layoutGeometry();
  updateChips();
  applyRegion(false);
  renderHud();
  scheduleLayout();
  $('#loading').classList.add('gone');
  startWalk();

  $('#panel').addEventListener('click', (e) => {
    if (e.target.closest('[data-act="close-panel"]')) { setPanel(false); return; }
    const b = e.target.closest('.li');
    if (b && state.bySym[b.dataset.s]) openCard(state.bySym[b.dataset.s]);
  });
  $('#sheet').addEventListener('click', onSheetClick);
  $('#btnSet').addEventListener('click', openSettings);
  // Esc：先關詳情卡，再關其它指數面板
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (!$('#sheet').hidden) $('#sheet').hidden = true;
    else if (state.panel) setPanel(false);
  });

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
  // 多指數旗幟每 4 秒換下一個指數（只在有輪播的旗幟時才重排）
  setInterval(() => {
    if (document.hidden) return;
    state.rot++;
    if (!gMk.select('.dots:not([style*="none"])').empty()) scheduleLayout();
  }, 4000);
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
