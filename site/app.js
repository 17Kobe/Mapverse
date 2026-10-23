/* 地圖世界 */
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
  { k: 'stocks', icon: '📈', label: '股市', title: '股市', desc: '目前的指數地圖', ready: true },
  { k: 'travel', icon: '✈️', label: '旅遊', title: '旅遊', desc: '美食、慶典、活動、景點、花季', ready: true },
  { k: 'living', icon: '🏠', label: '民生', title: '民生', desc: '電力供需、水庫蓄水、油價、菜價、空氣品質' },
  { k: 'weather', icon: '🌦️', label: '天氣災防', title: '天氣災防', desc: '颱風路徑、地震、雨量' }
];
const desktopMQ = window.matchMedia('(min-width:900px)');
// 手機版城市旗幟的放大倍率（數字太小看不清楚）
const BUBBLE_SCALE_MOBILE = 1.25;
// 手機版區域檢視上方額外預留的高度（px），讓 pin 的國家旗幟放得下
const PIN_EXTRA_TOP = 95;
// 旅遊地圖的道路級別：國道 / 快速公路 / 省道（tw-roads.json 的級別編號 0 / 1 / 2）
const ROAD_CLS = ['fwy', 'exp', 'prov'];

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
  { src: 'critters/shark.png', lon: 62, lat: -36, mode: 'dolphin', s: 0.9, sea: true },
  { src: 'critters/fish.png', lon: -74, lat: 16, mode: 'swim', s: 0.6, sea: true },
  { src: 'critters/seal.png', lon: -27, lat: 66, mode: 'bob', s: 0.75, sea: true },
  { src: 'critters/sailboat.png', lon: -140, lat: 22, mode: 'boat', face: 'F', s: 1, sea: true },
  { src: 'critters/sailboat.png', lon: 162, lat: 12, mode: 'boat', face: 'F', s: 1, sea: true },
  // 北海小英雄：維京長船在北海巡航
  { src: 'people/viking.svg', lon: 3.5, lat: 59.5, mode: 'boat', face: 'R', s: 1.35, sea: true },
  // 非洲莽原：獵人追斑馬，旁邊有長頸鹿散步
  { src: 'critters/zebra.png', lon: 33.5, lat: -6, mode: 'chase', lag: 0, s: 0.95 },
  { src: 'critters/hunter.png', lon: 33.5, lat: -6, mode: 'chase', lag: 1.05, s: 0.85 },
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
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad3 = (id) => String(id == null ? '' : id).padStart(3, '0');
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
};

const state = {
  cfg: null, maps: [], bars: [], bySym: {}, byId: {}, countries: [],
  quotes: {}, generated: null, demo: false,
  activeRegion: 'all', layer: 'stocks', panel: false,
  travel: null, tArea: 'all', // 旅遊地圖的資料（第一次切過去才載入）與目前選的區域
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
// 開啟網頁時只在這三個主要區域之間挑（中東非洲市場少，需要時手動點）
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
// 數字格式器先建好重複使用（toLocaleString 每次呼叫都會重建一個，拖曳時每幀都要格式化好幾十個數字）
const NUM_FMT = [0, 2].map((d) => new Intl.NumberFormat('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }));
const fmtN = (p, mode) => {
  if (p == null || isNaN(p)) return '--';
  const a = Math.abs(p);
  const d = mode === 'short' ? (a >= 1000 ? 0 : 2) : (a >= 10000 ? 0 : 2);
  return NUM_FMT[d ? 1 : 0].format(p);
};
// 只在值真的改變時才寫進 DOM。d3 的 attr / style / text 每次都會寫入，值一樣也會讓瀏覽器
// 重新計算樣式、重新排版 SVG 文字；旗幟在拖曳時每一幀都會重排，內容卻幾乎沒變
function setQ(el, name, x) {
  if (x == null) { if (el.hasAttribute(name)) el.removeAttribute(name); return; }
  const s = String(x);
  if (el.getAttribute(name) !== s) el.setAttribute(name, s);
}
d3.selection.prototype.attrQ = function (name, v) {
  return this.each(function (d, i, g) { setQ(this, name, typeof v === 'function' ? v.call(this, d, i, g) : v); });
};
d3.selection.prototype.styleQ = function (name, v) {
  return this.each(function (d, i, g) {
    const x = typeof v === 'function' ? v.call(this, d, i, g) : v, cur = this.style.getPropertyValue(name);
    if (x == null) { if (cur) this.style.removeProperty(name); return; }
    const s = String(x);
    if (cur !== s) this.style.setProperty(name, s);
  });
};
d3.selection.prototype.textQ = function (v) {
  return this.each(function (d, i, g) {
    const x = typeof v === 'function' ? v.call(this, d, i, g) : v, s = x == null ? '' : String(x);
    if (this.textContent !== s) this.textContent = s;
  });
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
let svg, gZoom, gWorlds, gLand, gLine, gEdge, gDecor, gMk, gTw, gRoadTag, gPoi, zoomB, projection, W = 0, H = 0;
let S0 = 1, viewBox = [[0, 0], [1, 1]], maxK = 16;

/* ---------- 遊戲風地形（實作在 terrain.js） ---------- */
let tctx = null, dpr = 1, terrainRaf = 0;
function scheduleTerrain() {
  if (!terrainRaf) terrainRaf = requestAnimationFrame(drawTerrain);
}
function drawTerrain() {
  terrainRaf = 0;
  if (tctx && W) { Terrain.draw(tctx, state.t, S0, W, H, dpr); drawFog(); }
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
  // 公路編號牌：省道藍、快速公路紅（上亮下暗的立體感），國道梅花白
  grad('rtBlue', '#2a64c4', '#0a3479');
  grad('rtRed', '#ff3d43', '#e0141d'); // 快速公路：亮紅（真的標誌是很正的紅）
  grad('rtWhite', '#ffffff', '#e4ebe6');
  const gl = defs.append('linearGradient').attr('id', 'rtGloss').attr('x1', 0).attr('y1', 0).attr('x2', 0).attr('y2', 1);
  gl.append('stop').attr('offset', '0%').attr('stop-color', '#fff').attr('stop-opacity', 0.42);
  gl.append('stop').attr('offset', '48%').attr('stop-color', '#fff').attr('stop-opacity', 0.06);
  gl.append('stop').attr('offset', '52%').attr('stop-color', '#fff').attr('stop-opacity', 0);
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
      // 橢圓的大小不超過約 3° x 1.4°（中心在內陸），再小也不低於一個最小值免得兩隻重疊
      const rx = Math.max(B * 0.7, Math.min(B * 1.9, 3 * (c.ppd || 99))), ry = Math.max(B * 0.25, Math.min(B * 0.6, 1.4 * (c.ppd || 99)));
      c.x = Math.cos(a) * rx; c.y = Math.sin(a) * ry;
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
  const fade = state.layer === 'travel' ? 0 : Math.max(0, Math.min(1, (4.5 - k) / 2.5)); // 旅遊地圖不放雲；放大到 4.5 倍以上就看不到雲
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
  // 旅遊地圖：台灣的海岸線（同樣是光暈 + 主線 + 白芯三層）與縣市界
  gTw = svg.append('g').attr('class', 'tw').style('display', 'none');
  // fill 直接寫在屬性上：就算瀏覽器還在用舊的 style.css，台灣也不會被填成一團黑
  for (const c of ['tw-glow', 'tw-county', 'tw-line', 'tw-edge']) gTw.append('path').attr('class', c).attr('fill', 'none');
  // 主要道路畫進地形圖磚（terrain.js，拖曳時不用每一幀重畫），SVG 這邊只放路線編號牌
  gRoadTag = svg.append('g').attr('class', 'rd-tags').style('display', 'none'); // 路線編號牌（螢幕座標，在海岸線上面）
  gDecor = svg.append('g').attr('class', 'decor').style('pointer-events', 'none');
  gMk = svg.append('g').attr('class', 'markers');
  gPoi = svg.append('g').attr('class', 'pois').style('display', 'none');

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
    const b = buildBanner(s);
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
    // 同一國家有多個指數（例如美國：標普 / 那斯達克 / 道瓊 / 費城半導體）
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
  // 股市地圖的雙擊不放大：左鍵是用來降下災難的，連點時地圖才不會一直縮放（旅遊地圖照舊）
  zoomB.filter((e) => (!e.ctrlKey || e.type === 'wheel') && !e.button && !(e.type === 'dblclick' && state.layer === 'stocks'));
  svg.call(zoomB);

  // 上帝視角的災難（disasters.js，目前只在股市地圖）：左鍵點空白處（不是動物 / 旗幟）降下災難，右鍵選災難。
  // 拖曳地圖後放開不算點擊（d3-zoom 會吃掉那一下 click）。
  svg.on('click.dz', (e) => {
    if (state.layer !== 'stocks' || !window.Disasters || e.target.closest('.mk')) return;
    Disasters.handleClick(e.clientX, e.clientY);
  });
  svg.on('contextmenu.dz', (e) => {
    if (state.layer !== 'stocks' || !window.Disasters) return;
    e.preventDefault();
    Disasters.openMenu(e.clientX, e.clientY);
  });
}
// 螢幕座標 → 經緯度（經度繞回 -180～180）
function geoAt(x, y) {
  const t = state.t, p = projection.invert([(x - t.x) / t.k, (y - t.y) / t.k]);
  return [((p[0] % 360) + 540) % 360 - 180, p[1]];
}
function initDisasters() {
  if (!window.Disasters) return;
  Disasters.init({
    stage: $('#stage'),
    canvas: $('#fx'),
    shakeEls: ['#terrain', '#clouds', '#map', '#fx'].map((s) => $(s)),
    enabled: () => state.layer === 'stocks',
    toScreen: screenXY,
    toGeo: geoAt,
    zoom: () => state.t.k,
    worldW: () => S0 * state.t.k,
    size: () => [W, H, dpr],
    reduce: () => !state.anim || reduceMotion.matches, // 關閉動畫或減少動態時，地震不搖晃畫面
    toast
  });
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
  viewBox = [[0, yN * S0], [S0, yS * S0]];

  gLand.selectAll('path').data(state.countries).join('path');
  const hot = state.countries.filter((d) => state.byId[pad3(d.id)]);
  gLine.selectAll('path').data(hot).join('path');
  gEdge.selectAll('path').data(hot).join('path');
  worldLod.reset();
  worldLod.update(state.t.k);
  textWCache.clear(); // 換尺寸可能跨過手機 / 桌機的字級設定
  gWorlds.attr('transform', (_, i) => (i ? `translate(${S0},0)` : null)); // 第二份接在世界右邊
  maxK = (Math.pow(2, MAX_TILE_Z + 1) * 256) / (S0 * dpr); // 最高層級再多放大 2 倍
  zoomB.extent([[0, 0], [W, H]]);
  setZoomLimits();
  drawTw();
  paintLand();
}
/* ---------- 邊界線的細緻度分級（LOD，股市的國界、旅遊的海岸線與縣市界共用） ----------
 * 邊界線有大量折點，拖曳 / 縮放時瀏覽器每一幀都要重畫全部，是最主要的卡頓來源。
 * 依縮放倍率（每 2 倍一級）用 Douglas–Peucker 拿掉「螢幕上偏差小於 LOD_TOL 像素」的折點：
 * 畫出來的形狀肉眼看不出差別，但每幀要畫的頂點少很多。各級的路徑字串算一次就快取起來。 */
const LOD_TOL = 0.5; // 允許的最大偏差（CSS 像素）
// Douglas–Peucker：p 是 [x0, y0, x1, y1, ...]，標記 a..b 之間要保留的點
function dpKeep(p, a, b, e2, keep) {
  const st = [a, b];
  while (st.length) {
    const j = st.pop(), i = st.pop();
    const ax = p[2 * i], ay = p[2 * i + 1], dx = p[2 * j] - ax, dy = p[2 * j + 1] - ay, L = dx * dx + dy * dy;
    let md = e2, mi = -1;
    for (let k = i + 1; k < j; k++) {
      let px = p[2 * k] - ax, py = p[2 * k + 1] - ay;
      if (L > 0) {
        const t = Math.max(0, Math.min(1, (px * dx + py * dy) / L));
        px -= t * dx; py -= t * dy;
      }
      const d = px * px + py * py;
      if (d > md) { md = d; mi = k; }
    }
    if (mi >= 0) { keep[mi] = 1; st.push(i, mi, mi, j); }
  }
}
// 接在投影後面的串流：每條線 / 每個環先收集投影後的點，簡化完再送出
function simplifier(eps) {
  const e2 = eps * eps;
  return (out) => {
    let pts = null, poly = false;
    return {
      point(x, y) { if (pts) pts.push(x, y); else out.point(x, y); },
      lineStart() { pts = []; out.lineStart(); },
      lineEnd() {
        const p = pts, n = p.length / 2;
        pts = null;
        if (n <= 3) { for (let i = 0; i < n; i++) out.point(p[2 * i], p[2 * i + 1]); out.lineEnd(); return; }
        const keep = new Uint8Array(n + 1);
        keep[0] = 1;
        if (poly) {
          // 環：先找離起點最遠的點當第二個錨點，小島縮到一個像素以下也還留得住
          let f = 1, fd = -1;
          for (let i = 1; i < n; i++) { const dx = p[2 * i] - p[0], dy = p[2 * i + 1] - p[1], d = dx * dx + dy * dy; if (d > fd) { fd = d; f = i; } }
          keep[f] = 1;
          p.push(p[0], p[1]); // 補上閉合點，讓最後一段也一起簡化
          dpKeep(p, 0, f, e2, keep);
          dpKeep(p, f, n, e2, keep);
        } else {
          keep[n - 1] = 1;
          dpKeep(p, 0, n - 1, e2, keep);
        }
        for (let i = 0; i < n; i++) if (keep[i]) out.point(p[2 * i], p[2 * i + 1]);
        out.lineEnd();
      },
      polygonStart() { poly = true; out.polygonStart(); },
      polygonEnd() { poly = false; out.polygonEnd(); },
      sphere() { out.sphere(); }
    };
  };
}
/* 分級路徑（各地圖共用）：
 *   items()  目前要畫的 GeoJSON 陣列（資料還沒好就回傳 null）
 *   maxLv()  最細的一級（再放大就沿用這一級）
 *   digits   路徑座標的小數位數（放大到街道等級要多留幾位，否則看得出鋸齒）
 *   apply(a) 把這一級的路徑字串（和 items() 同順序）寫進 SVG
 * 地圖換尺寸、投影改變時呼叫 reset()；每次縮放呼叫 update(k)，跨級時才會重寫路徑。 */
const idleCb = window.requestIdleCallback || ((f) => setTimeout(f, 200));
const idleCancel = window.cancelIdleCallback || clearTimeout;
function makeLod({ items, maxLv, digits, apply }) {
  const cache = new Map();
  let cur = null, idle = 0;
  const paths = (lv, list) => {
    let a = cache.get(lv);
    if (a) return a;
    // 這一級涵蓋倍率 2^lv ~ 2^(lv+1)，最大倍率時偏差也要小於 LOD_TOL
    const simp = simplifier(LOD_TOL / Math.pow(2, lv + 1));
    const p = d3.geoPath({ stream: (s) => projection.stream(simp(s)) });
    if (digits && p.digits) p.digits(digits);
    a = list.map((d) => p(d) || '');
    cache.set(lv, a);
    return a;
  };
  return {
    reset() { cache.clear(); cur = null; if (idle) { idleCancel(idle); idle = 0; } },
    update(k) {
      const list = projection && items();
      if (!list || !list.length) return;
      const top = maxLv();
      const lv = Math.max(0, Math.min(top, Math.floor(Math.log2(k))));
      if (lv === cur) return;
      cur = lv;
      apply(paths(lv, list));
      // 閒置時先把相鄰兩級算好，縮放跨級時就不用當場計算
      if (idle) idleCancel(idle);
      idle = idleCb(() => { idle = 0; for (const l of [lv - 1, lv + 1]) if (l >= 0 && l <= top) paths(l, list); });
    }
  };
}
// 股市：世界國界（放大到 2^7 倍以上國界已經淡出不畫，不用再分更細）
const worldLod = makeLod({
  items: () => (gLand && state.countries.length ? state.countries : null),
  maxLv: () => 7,
  apply(a) {
    const idx = new Map(state.countries.map((d, i) => [d, i]));
    const set = function (d) { this.setAttribute('d', a[idx.get(d)]); };
    gLand.selectAll('path').each(set);
    gLine.selectAll('path').each(set);
    gEdge.selectAll('path').each(set);
  }
});
// 旅遊：台灣海岸線與縣市界（內政部資料很細，可以一路放大到街道等級）
// 線寬自己除以縮放倍率：放大到街道等級時 iOS Safari 的 non-scaling-stroke 會失效，
// 小島周圍就變成一大圈黃色（金色光暈被放大了上百倍）
const TW_STROKE = { 'tw-glow': 9, 'tw-line': 2.4, 'tw-edge': 0.9, 'tw-county': 1 };
function sizeTwStroke(k) {
  for (const [c, w] of Object.entries(TW_STROKE)) gTw.select('.' + c).style('stroke-width', `${w / k}px`);
  gTw.select('.tw-county').style('stroke-dasharray', `${4 / k}px ${3 / k}px`);
}
const twLod = makeLod({
  items: () => (gTw && state.travel ? [state.travel.coast, state.travel.county] : null),
  maxLv: () => Math.max(0, Math.ceil(Math.log2(maxK))),
  digits: 6,
  apply([coast, county]) {
    gTw.selectAll('.tw-glow,.tw-line,.tw-edge').attr('d', coast);
    gTw.select('.tw-county').attr('d', county);
  }
});

// 縮放 / 拖曳範圍：股市是整個世界（東西向無限循環）；旅遊只在台灣附近
function setZoomLimits() {
  if (state.layer === 'travel' && state.travel) {
    const home = fitBox(state.travel.areas[0].box);
    const minK = home.k * 0.8;
    const a = projection([TW_PAN[0], TW_PAN[3]]), b = projection([TW_PAN[2], TW_PAN[1]]);
    const cx = (a[0] + b[0]) / 2, cy = (a[1] + b[1]) / 2;
    // 縮到最小時畫面也要在範圍內，寬螢幕就把範圍往外擴
    const hw = Math.max((b[0] - a[0]) / 2, W / minK / 2), hh = Math.max((b[1] - a[1]) / 2, H / minK / 2);
    zoomB.translateExtent([[cx - hw, cy - hh], [cx + hw, cy + hh]]).scaleExtent([minK, maxK]);
  } else {
    zoomB.translateExtent(panExtent()).scaleExtent([1, maxK]);
  }
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
  // 上方還要放得下多指數的整張旗幟（3 個以上指數的國家會多佔一些高度）
  const bs = desktopMQ.matches ? 1 : BUBBLE_SCALE_MOBILE; // 手機版旗幟放大了，預留的空間也要跟著放大
  const px = desktopMQ.matches ? 70 : 46, pb = 34, minK = REGION_MIN_K;
  // 手機版：有 pin 的國家（上證、韓國）要整張旗幟列在動物上方，上方多留一些空間
  const pt = (ms.some((m) => m.group.length >= 3) ? 100 : 72) * bs + (!desktopMQ.matches && ms.some((m) => m.pin) ? PIN_EXTRA_TOP : 0);
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
  const tr = state.layer === 'travel' ? areaTransform(state.tArea) : nearestCopy(regionTransform(state.activeRegion));
  const sel = animate && state.anim ? svg.transition().duration(900).ease(d3.easeCubicInOut) : svg;
  sel.call(zoomB.transform, tr);
}

function onTransform() {
  gZoom.attr('transform', state.t.toString());
  if (state.layer === 'travel') {
    // 旅遊地圖不畫世界國界，改畫台灣自己的海岸線與縣市界（內政部資料，放大到街道也對得齊）
    gZoom.style('display', 'none');
    gTw.attr('transform', state.t.toString());
    sizeTwStroke(state.t.k);
    twLod.update(state.t.k);
  } else {
    // 放大到城市 / 街道等級時，國界（50m 精度）會和真實海岸線對不齊，逐漸淡出
    const op = Math.max(0, Math.min(1, 1 - (Math.log2(state.t.k) - 5) / 2));
    gZoom.style('opacity', op).style('display', op > 0 ? null : 'none');
    if (op > 0) worldLod.update(state.t.k);
  }
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

/* ---------- 地圖標記的共用元件（股市的城市旗幟、旅遊的地點旗幟都用這一套） ----------
 * 畫的時候一律用 attrQ / styleQ / textQ：拖曳時每幀都會重排，只有真的改變的值才寫進 DOM。 */
// 文明帝國式旗幟的外框：深色底板 + 名稱色帶 + 淡金分隔線 + 金色細邊，下方可加指向圖示的尖角
function buildBanner(parent) {
  const b = parent.append('g').attr('class', 'bubble');
  b.append('path').attr('class', 'tail-o');   // 尖角的深色外框（畫在底板下面）
  b.append('rect').attr('class', 'bg').attr('rx', 7);
  b.append('rect').attr('class', 'band').attr('rx', 4.5);
  b.append('line').attr('class', 'sep');
  b.append('rect').attr('class', 'inner').attr('rx', 5);
  b.append('rect').attr('class', 'rim').attr('rx', 7);
  b.append('path').attr('class', 'tail');
  return b;
}
// bg：底板填色；band：色帶顏色（null = 不畫色帶，例如迷你旗幟）；tail：是否畫尖角；
// bandH：色帶高度（預設 18；等於 h - 6 時色帶填滿整面旗幟，就不畫分隔線）
function drawBanner(b, w, h, { bg, band, tail, bandH = 18 }) {
  const BAND_H = bandH, sep = band && BAND_H < h - 6;
  b.select('.bg').attrQ('x', 0.5).attrQ('y', 0.5).attrQ('width', w - 1).attrQ('height', h - 1).attrQ('fill', bg);
  b.select('.rim').attrQ('x', 0.5).attrQ('y', 0.5).attrQ('width', w - 1).attrQ('height', h - 1);
  b.select('.inner').attrQ('x', 3).attrQ('y', 3).attrQ('width', w - 6).attrQ('height', h - 6);
  b.select('.band').styleQ('display', band ? null : 'none')
    .attrQ('x', 3).attrQ('y', 3).attrQ('width', w - 6).attrQ('height', BAND_H).attrQ('fill', band || null);
  b.select('.sep').styleQ('display', sep ? null : 'none')
    .attrQ('x1', 4).attrQ('x2', w - 4).attrQ('y1', 3 + BAND_H + 0.5).attrQ('y2', 3 + BAND_H + 0.5);
  b.selectAll('.tail,.tail-o').styleQ('display', tail ? null : 'none')
    .attrQ('d', `M${w / 2 - 6},${h - 1} L${w / 2},${h + 6} L${w / 2 + 6},${h - 1}`);
}
// 站在地圖上的圖示（動物 / 地點圖示）：原點是腳下的地面，z 是身高；地上有光圈和柔和的影子
function sizeFigure(g, img, z) {
  g.select('.ring').attrQ('rx', z * 0.62).attrQ('ry', z * 0.22);
  g.select('.shadow').attrQ('rx', z * 0.36).attrQ('ry', z * 0.1).attrQ('cy', -z * 0.02);
  img.attrQ('x', -z / 2).attrQ('y', -z).attrQ('width', z).attrQ('height', z);
}
// 浮動介面在地圖上佔的範圍（四周多留 3px），旗幟不要放進去
function uiRects(sels) {
  const sr = $('#stage').getBoundingClientRect(), out = [];
  for (const sel of sels) {
    const el = $(sel);
    if (!el || el.hidden || el.offsetParent === null) continue;
    const b = el.getBoundingClientRect();
    out.push({ x: b.left - sr.left - 3, y: b.top - sr.top - 3, w: b.width + 6, h: b.height + 6 });
  }
  return out;
}
// SVG 文字寬度：同樣的字只量一次（拖曳時每幀量會強迫瀏覽器重新排版）；網頁字型載入後重新量
const textWCache = new Map();
if (document.fonts) document.fonts.addEventListener('loadingdone', () => { textWCache.clear(); scheduleLayout(); });
function textWidth(node) {
  const key = node.getAttribute('class') + '\n' + node.textContent;
  let w = textWCache.get(key);
  if (w === undefined) {
    w = node.getComputedTextLength();
    if (w > 0) textWCache.set(key, w); // 隱藏中量到的是 0，不要記下來
  }
  return w;
}
// 還沒建出旗幟就要知道寬度時用：拿一個看不見的 .bubble .t1 量（同一套快取）
let measT1 = null;
function textWidthOf(str) {
  if (!measT1) measT1 = svg.append('g').attr('class', 'bubble').style('visibility', 'hidden').attr('aria-hidden', 'true').append('text').attr('class', 't1');
  return textWidth(measT1.text(str).node());
}

function layoutMarkers() {
  if (!projection || !state.maps.length) return;
  if (state.layer === 'travel') { layoutTravel(); return; }
  const t = state.t, k = t.k;
  const size = Math.max(19, Math.min(30, 14 + k * 2.8)); // 動物身高（px），放大地圖時略微變大
  const rects = [], vis = new Map();
  // pin 的國家優先放動物，這樣不會因為鄰近的動物（例如新加坡和馬來西亞）重疊就被隱藏
  const arr = state.maps.slice().sort((a, b) => (!!b.pin - !!a.pin) || (b.w - a.w));

  // 第一輪：放動物，太擠的先隱藏（放大後會出現）
  for (const m of arr) {
    const [x, y] = screenXY(m.lon, m.lat);
    if (x < -20 || x > W + 20 || y < -20 || y > H + 20) continue;
    // 原點是腳下的地面，身體往上長；佔位框也包含牠走動的範圍
    const a = { x: x - size * 0.75, y: y - size * 1.05, w: size * 1.5, h: size * 1.35, an: true };
    const area = a.w * a.h;
    if (rects.some((r) => inter(a, r) / area > (m.pin ? 0.8 : 0.3))) continue;
    rects.push(a);
    vis.set(m.s, { m, x, y, a, size, b: null });
  }
  // 浮動介面（篩選列、概況卡、其它指數面板）蓋住的地方，氣泡不要放進去
  rects.push(...uiRects(['#chips', '#hud', '#panel']));
  // 第二輪：放氣泡，先試完整版，再試迷你版
  const baseRects = rects.slice();
  // 旗幟整體放大倍率：手機螢幕小，指數數字要放大才看得清楚（旗幟內部仍用原本的座標畫，最後再整個 scale）
  const U = desktopMQ.matches ? 1 : BUBBLE_SCALE_MOBILE;
  // 手機版：pin 的國家（中、港、日、韓、台、星、馬、印尼）改用左右兩欄排版。
  // 每張旗幟盡量放在自己動物的正上方，同一欄依動物由北到南往下疊，擠不下再整欄往上收，
  // 這樣每張都能完整列出，也不會被擠到離自己國家很遠的地方。排不下時回傳 null，改用一般的避讓排法。
  const layoutPinColumns = () => {
    const ps = [...vis.values()].filter((o) => o.m.pin && state.quotes[o.m.s]);
    if (ps.length < 2) return null;
    const GAP = 4;
    const colW = Math.floor((W - 8 - GAP) / 2); // 每一欄的寬度（左右各留 4px 邊）
    const multiW = Math.min(colW, Math.round(Math.min(166, Math.floor((W - 10) / 2 / U)) * U));
    const colR = [[4, 4 + colW], [W - 4 - colW, W - 4]];
    const ui = baseRects.filter((z) => !z.an);
    // 上緣：概況卡、篩選列的下方
    const top0 = Math.max(2, ...ui.filter((z) => z.y < H / 3).map((z) => z.y + z.h)) + GAP;
    const bot0 = H - 18; // 下緣：留出地圖資料來源那一行字
    const items = ps.map((o) => {
      const n = o.m.group.length;
      return {
        o, mode: n > 1 ? 'multi' : 'full',
        w: n > 1 ? multiW : Math.min(colW, Math.round(118 * U)),
        h: Math.round((n > 1 ? 24 + n * 16 + 4 : 40) * U)
      };
    });
    const byS = new Map(items.map((it) => [it.o.m.s, it]));
    for (const it of items) it.parent = (it.o.m.under && byS.get(it.o.m.under)) || null;
    // 分欄：markets.json 的 col（L / R）優先；under 的國家跟著依附的國家；其餘看動物在畫面左半或右半
    const colOf = (it) => it.parent ? colOf(it.parent)
      : it.o.m.col === 'L' ? 0 : it.o.m.col === 'R' ? 1 : it.o.x < W / 2 ? 0 : 1;
    for (const it of items) it.col = colOf(it);
    const overX = (it, a) => it.x < a.x + a.w && it.x + it.w > a.x;
    // 一整組（自己 + 接在下面的 under 國家）的總高度
    const blockH = (it) => it.h + items.filter((c) => c.parent === it).reduce((s, c) => s + GAP + blockH(c), 0);
    const stack = (col, jump) => {
      // 依動物由北到南排序；under 的國家緊接在依附的國家之後
      const seq = [];
      const add = (it) => { seq.push(it); items.filter((c) => c.parent === it).sort((a, b) => a.o.y - b.o.y).forEach(add); };
      items.filter((it) => it.col === col && !it.parent).sort((a, b) => a.o.y - b.o.y).forEach(add);
      const [x0, x1] = colR[col];
      let y = top0;
      for (const it of seq) {
        // 水平：對齊自己的動物，但不超出這一欄；under 的國家和依附的國家左緣對齊
        it.x = it.parent ? it.parent.x : Math.max(x0, Math.min(x1 - it.w, it.o.x - it.w / 2));
        // 動物正上方；有 under 的國家（上證 + 香港）要整組一起放在動物上方，下面那張才不會蓋住上面國家的動物
        const bh = blockH(it);
        it.want = it.o.a.y - bh - 5;
        it.y = it.parent ? y : Math.max(y, it.want);
        // 被上一張擠下來而蓋到自己的動物：改放到動物下方，讓動物露出來
        if (jump && !it.parent && it.y > it.want && it.y < it.o.a.y + it.o.a.h && overX(it, it.o.a)) it.y = it.o.a.y + it.o.a.h + 2;
        it.tail = bh === it.h; // 下面沒有接別張，才畫指向動物的小尾巴
        y = it.y + it.h + GAP;
      }
      // 超出畫面下緣：由下往上收（under 的國家會連同依附的國家一起往上推，維持緊貼）
      let lim = bot0;
      for (let i = seq.length - 1; i >= 0; i--) {
        if (seq[i].y + seq[i].h > lim) seq[i].y = lim - seq[i].h;
        lim = seq[i].y - GAP;
      }
      return !seq.length || seq[0].y >= top0;
    };
    for (const col of [0, 1]) if (!stack(col, true) && !stack(col, false)) return null;
    const out = new Map();
    for (const it of items) {
      const r = { x: it.x, y: it.y, w: it.w, h: it.h };
      // 被開著的面板之類的介面蓋到，就放棄兩欄排法
      if (ui.some((z) => inter(r, z) > 0)) return null;
      // 剛好在自己動物正上方才畫指向動物的小尾巴
      const up = it.tail && !it.parent && Math.abs(it.y - it.want) < 1 && Math.abs(it.x + it.w / 2 - it.o.x) < 6;
      out.set(it.o.m.s, { r, mode: it.mode, pos: up ? 'up' : 'col' });
    }
    return out;
  };
  const pinCols = desktopMQ.matches ? null : layoutPinColumns();
  const place = (order0) => {
    // under 的國家要排在它所依附的國家後面，才找得到對方的旗幟位置
    const order = order0.slice();
    for (const m of order0) {
      if (!m.under) continue;
      const pi = order.findIndex((x) => x.s === m.under), ci = order.indexOf(m);
      // 一律緊接在依附的國家之後放，避免中間被其他旗幟先佔走正下方的位置
      if (pi < 0) continue;
      order.splice(ci, 1);
      order.splice(order.findIndex((x) => x.s === m.under) + 1, 0, m);
    }
    const rs = baseRects.slice();
    for (const o of vis.values()) o.b = null;
    // 兩欄排好的 pin 國家先固定下來，其他國家再從剩下的空間找位置
    if (pinCols) for (const [s, b] of pinCols) { const r = { ...b.r }; vis.get(s).b = { ...b, r }; rs.push(r); }
    for (const m of order) {
      const o = vis.get(m.s);
      if (!o || !state.quotes[m.s] || (pinCols && pinCols.has(m.s))) continue;
      // 多指數的國家：空間夠就整張列出（multi），不夠就輪播（full），再不夠只顯示主指數（mini）
      const n = m.group.length;
      // 窄螢幕：整張列出的旗幟最多佔半個畫面寬，這樣左右可以並排兩張
      const multiW = Math.min(166, Math.floor((W - 10) / 2 / U));
      const modes = (n > 1
        ? [{ w: multiW, h: 24 + n * 16 + 4, mode: 'multi' }, { w: 136, h: 40, mode: 'full' }, { w: 80, h: 22, mode: 'mini' }]
        : [{ w: 118, h: 40, mode: 'full' }, { w: 80, h: 22, mode: 'mini' }]
      ).map((md) => ({ ...md, w: Math.round(md.w * U), h: Math.round(md.h * U) }));
      outer:
      for (const md of modes) {
        const cands = [
          { x: o.x - md.w / 2, y: o.a.y - md.h - 5, pos: 'up' },
          { x: o.x - md.w / 2, y: o.a.y + o.a.h + 2, pos: 'down' },
          { x: o.a.x + o.a.w + 2, y: o.y - md.h / 2, pos: 'right' },
          { x: o.a.x - md.w - 2, y: o.y - md.h / 2, pos: 'left' }
        ];
        // 四個基本方向被擠掉時，沿著邊緣滑動再試（滑動後的旗幟不畫指向動物的小尾巴）
        for (const f of [-0.25, 0.25, -0.5, 0.5, -0.75, 0.75, -1, 1]) {
          cands.push({ x: o.x - md.w / 2 + f * md.w, y: o.a.y - md.h - 5, pos: 'up~' });
          cands.push({ x: o.x - md.w / 2 + f * md.w, y: o.a.y + o.a.h + 2, pos: 'down~' });
          cands.push({ x: o.a.x + o.a.w + 2, y: o.y - md.h / 2 + f * md.h * 1.1, pos: 'right~' });
          cands.push({ x: o.a.x - md.w - 2, y: o.y - md.h / 2 + f * md.h * 1.1, pos: 'left~' });
        }
        // pin 的國家（上證、韓國）寧可離動物遠一點也要整張列出：沿著整個畫面用格點再找一輪空位
        if (m.pin && md.mode !== 'mini') {
          for (let gy = 2; gy + md.h <= H - 2; gy += 8) for (let gx = 2; gx + md.w <= W - 2; gx += 8) cands.push({ x: gx, y: gy, pos: 'grid' });
        }
        // markets.json 的 under：緊接在指定國家的旗幟正下方（例如香港放在上證下面），左緣對齊
        const po = m.under && vis.get(m.under);
        if (po && po.b && po.b.mode !== 'mini') cands.push({ x: po.b.r.x, y: po.b.r.y + po.b.r.h + 4, pos: 'under' });
        // 離動物越近越優先（距離相同時維持 上、下、右、左 的順序）
        const d2 = (c) => (c.x + md.w / 2 - o.x) ** 2 + (c.y + md.h / 2 - (o.y - o.size / 2)) ** 2;
        cands.forEach((c, i) => (c.i = i, c.d = c.pos === 'under' ? -1 : d2(c)));
        cands.sort((p, q) => (p.d - q.d) || (p.i - q.i));
        for (const c of cands) {
          const r = { x: c.x, y: c.y, w: md.w, h: md.h };
          if (r.x < 2 || r.y < 2 || r.x + r.w > W - 2 || r.y + r.h > H - 2) continue;
          // under 的旗幟是刻意貼在指定國家下面，就算蓋到別人的動物佔位框也沒關係
          if (rs.some((z) => !(c.pos === 'under' && z.an) && inter(r, z) > 0)) continue;
          // markets.json 的 nx：選好位置後，旗幟再往右（正）或往左（負）微調 px；擠不下就少挪一點
          if (m.nx && c.pos !== 'under') {
            for (const k of [1, 0.75, 0.5, 0.25]) {
              const r2 = { ...r, x: r.x + m.nx * k };
              if (r2.x < 2 || r2.x + r2.w > W - 2) continue;
              if (inter(r2, o.a) > 0 || rs.some((z) => inter(r2, z) > 0)) continue;
              r.x = r2.x;
              break;
            }
          }
          rs.push(r);
          o.b = { r, mode: md.mode, pos: c.pos };
          break outer;
        }
      }
    }
    // markets.json 的 swap：這個國家的旗幟和指定國家的旗幟互換位置（各自保持自己的大小，以對方的中心點為中心）
    for (const m of order) {
      const a = vis.get(m.s), b = m.swap && vis.get(m.swap);
      if (!a || !b || !a.b || !b.b || (pinCols && (pinCols.has(m.s) || pinCols.has(m.swap)))) continue;
      const ca = { x: a.b.r.x + a.b.r.w / 2, y: a.b.r.y + a.b.r.h / 2 }, cb = { x: b.b.r.x + b.b.r.w / 2, y: b.b.r.y + b.b.r.h / 2 };
      const ra = { ...a.b.r, x: cb.x - a.b.r.w / 2, y: cb.y - a.b.r.h / 2 }, rb = { ...b.b.r, x: ca.x - b.b.r.w / 2, y: ca.y - b.b.r.h / 2 };
      const others = rs.filter((z) => z !== a.b.r && z !== b.b.r);
      const ok = (r) => r.x >= 2 && r.y >= 2 && r.x + r.w <= W - 2 && r.y + r.h <= H - 2 && !others.some((z) => inter(r, z) > 0);
      if (!ok(ra) || !ok(rb) || inter(ra, rb) > 0) continue;
      const pa = a.b.pos;
      a.b = { ...a.b, r: ra, pos: b.b.pos };
      b.b = { ...b.b, r: rb, pos: pa };
    }
    // 評分：整張列出的多指數國家越多越好，其次是沒被縮成迷你版
    let sc = 0;
    // markets.json 的 pin：一定要整張列出的國家（例如上證、韓國），分數特別高，其他國家只好讓位
    for (const o of vis.values()) {
      if (!o.b) continue;
      sc += (o.b.mode === 'multi' ? 100 : o.b.mode === 'full' ? 10 : 1) * (o.m.group.length > 1 ? 3 : 1) * (o.m.pin ? 20 : 1);
      // pin 的旗幟離自己的動物越遠越扣分（扣不到讓它變成非整張列出，只是讓位置盡量靠近）
      if (o.m.pin && o.b.mode !== 'mini' && o.b.pos !== 'under') {
        const dist = Math.hypot(o.b.r.x + o.b.r.w / 2 - o.x, o.b.r.y + o.b.r.h / 2 - o.y);
        sc -= o.b.mode === 'multi' ? Math.min(2500, dist * 8) : Math.min(150, dist * 0.8);
      }
      // 有 under 的國家如果真的貼在指定國家下面，加一點分，讓排列整齊
      if (o.b.pos === 'under') sc += 1500;
    }
    return sc;
  };
  // 先依權重由大到小放；如果有多指數的國家沒能整張列出，就讓它優先再排一次（最多重排幾次，取最好的）
  let order = arr.slice().sort((a, b) => (!!b.pin - !!a.pin) || ((b.group.length > 1) - (a.group.length > 1)));
  let best = null;
  // pin 的國家誰先放會影響彼此的位置，所以正序、反序各排一輪，取分數最高的
  const pins = order.filter((m) => m.pin);
  const starts = [order];
  if (pins.length > 1) {
    const rest = order.filter((m) => !m.pin);
    starts.push([...pins.slice().reverse(), ...rest]);
    // 由北到南（畫面上方到下方）依序放，旗幟才會一層一層往下排整齊
    starts.push([...pins.slice().sort((a, b) => (vis.get(a.s)?.y ?? 0) - (vis.get(b.s)?.y ?? 0)), ...rest]);
  }
  for (const start of starts) {
    order = start;
    const tried = new Set();
    for (let it = 0; it < 6; it++) {
      const sc = place(order);
      if (!best || sc > best.sc) best = { sc, snap: [...vis.values()].map((o) => [o, o.b]) };
      // 沒能整張列出的多指數國家，或沒能以完整版（非迷你）列出的 pin 國家，下一輪優先排
      const missing = (m) => (m.group.length > 1 || m.pin) && !tried.has(m.s) && vis.get(m.s) && state.quotes[m.s]
        && !(vis.get(m.s).b && (vis.get(m.s).b.mode === 'multi' || (m.group.length === 1 && vis.get(m.s).b.mode === 'full')));
      const miss = order.find((m) => m.pin && missing(m)) || order.find(missing);
      if (!miss) break;
      tried.add(miss.s);
      order = [miss, ...order.filter((m) => m !== miss)];
    }
  }
  for (const [o, bb] of best.snap) o.b = bb;

  gMk.selectAll('g.mk').each(function (m) {
    const s = d3.select(this), o = vis.get(m.s), wk = walkers.get(m.s);
    if (!o) { s.styleQ('display', 'none'); if (wk) wk.vis = false; return; }
    s.styleQ('display', null).attrQ('transform', `translate(${o.x},${o.y})`);
    const st = marketStatus(m), q = state.quotes[m.s];
    const pct = q ? q.pct : 0;
    if (wk) { wk.vis = true; wk.st = st; wk.size = o.size; }
    const an = s.select('.an').attrQ('class', 'an ' + st);
    const z = o.size;
    sizeFigure(an, an.select('.beast'), z);
    an.select('.emoji').attrQ('y', -z * 0.45).attrQ('font-size', z * 0.9);
    an.select('.mood').attrQ('x', z * 0.42).attrQ('y', -z * 0.95).attrQ('font-size', Math.max(10, z * 0.42))
      .textQ(st === 'closed' ? '💤' : '');

    const b = s.select('.bubble');
    if (!o.b || !q) { b.styleQ('display', 'none'); return; }
    // 旗幟內部用「未放大」的座標畫，所以寬高要除回倍率，最後在 transform 再 scale(U)
    const w = o.b.r.w / U, h = o.b.r.h / U, mode = o.b.mode, mini = mode === 'mini', multi = mode === 'multi';
    const n = m.group.length;
    // 輪播：多指數國家在 full 模式下，每隔幾秒換下一個指數
    const cur = mode === 'full' && n > 1 ? m.group[state.rot % n] : m;
    const cq = state.quotes[cur.s], cp = cq ? cq.pct : 0;
    const col = pctColor(pct);
    // 對齊整數像素，細線才會銳利
    const bx = Math.round(o.b.r.x), by = Math.round(o.b.r.y);
    b.styleQ('display', null).attrQ('transform', `translate(${bx - o.x},${by - o.y}) scale(${U})`);
    // 旗幟上半部的名稱色帶（漲跌色；休市時變灰），迷你版不畫色帶
    drawBanner(b, w, h, {
      bg: st === 'closed' ? 'url(#bannerOff)' : 'url(#bannerBg)',
      band: mini ? null : st === 'closed' ? '#4a5466' : bandColor(pct),
      tail: o.b.pos === 'up'
    });
    // 國旗：完整版放在名稱色帶左側，迷你版放在漲跌幅左邊
    const hasFlag = !b.select('.flag').empty();
    const fw = mini ? 18 : 24, fh = mini ? 12 : 16, fx = mini ? 5 : 6, fy = mini ? 5 : 4;
    b.select('.flag').attrQ('x', fx).attrQ('y', fy).attrQ('width', fw).attrQ('height', fh)
      .styleQ('opacity', st === 'closed' ? 0.75 : 1);
    b.select('.flag-b').attrQ('x', fx - 0.5).attrQ('y', fy - 0.5).attrQ('width', fw + 1).attrQ('height', fh + 1);
    // 輪播頁碼小圓點（色帶右側）
    const dotW = mode === 'full' && n > 1 ? n * 6 + 4 : 0;
    b.select('.dots').styleQ('display', dotW ? null : 'none').selectAll('circle')
      .attrQ('cx', (_, i) => w - 9 - (n - 1 - i) * 6).attrQ('cy', 12)
      .attrQ('class', (_, i) => (i === state.rot % n ? 'on' : null));
    const tx0 = hasFlag ? fx + fw + 2 : 0, tx1 = w - dotW; // 文字置中在國旗和圓點之間
    const t1 = b.select('.t1').attrQ('x', (tx0 + tx1) / 2).attrQ('y', mini ? h / 2 + 0.5 : 12.5);
    const t2 = b.select('.t2').attrQ('x', w / 2).attrQ('y', 30).styleQ('display', mode === 'full' ? null : 'none');
    b.select('.rows').styleQ('display', multi ? null : 'none');
    if (!mini) {
      t1.select('.a').textQ(hasFlag ? m.short : `${m.flag} ${m.short}`);
      t1.select('.m').textQ('');
    }
    if (mode === 'full') {
      t2.select('.lb').textQ(n > 1 ? (cur.abbr || cur.zh) + ' ' : '');
      t2.select('.va').textQ(cq ? fmtN(cq.p, 'short') : '--');
      t2.select('.pc').attrQ('fill', pctColor(cp)).textQ(cq ? `${arrow(cp)}${Math.abs(cp).toFixed(2)}%` : '');
    } else if (multi) {
      b.selectAll('.row').each(function (_, i) {
        // 注意：d3 append 的子元素會繼承父層資料，所以要用序號去 group 裡拿對應的指數
        const x = m.group[i], r = d3.select(this), rq = state.quotes[x.s], y = 24 + i * 16;
        r.select('.rbg').attrQ('x', 4).attrQ('y', y).attrQ('width', w - 8).attrQ('height', 16).classed('odd', i % 2 === 1);
        r.select('.rn').attrQ('x', 9).attrQ('y', y + 8.5);
        r.select('.rv').attrQ('x', w - (w >= 155 ? 56 : 50)).attrQ('y', y + 8.5).textQ(rq ? fmtN(rq.p, 'short') : '--');
        r.select('.rp').attrQ('x', w - 8).attrQ('y', y + 8.5)
          .attrQ('fill', rq ? pctColor(rq.pct) : null).textQ(rq ? `${arrow(rq.pct)}${Math.abs(rq.pct).toFixed(2)}%` : '');
      });
    } else {
      t1.select('.a').textQ(hasFlag ? '' : m.flag);
      t1.select('.m').attrQ('fill', col).attrQ('dx', hasFlag ? 0 : 3).textQ(fmtPct(pct, 1));
    }
  });
  // 疊放順序：旗幟要蓋在別人的動物上面（SVG 後畫的在上層）。
  // 誰的旗幟蓋到別國的動物，就排到那個國家的後面；用 DFS 做拓撲排序，遇到循環就略過
  {
    const nodes = gMk.selectAll('g.mk').nodes();
    const info = nodes.map((n) => ({ n, o: vis.get(d3.select(n).datum().s) }));
    const after = new Map(info.map((p) => [p, info.filter((q) => q !== p && p.o && p.o.b && q.o && inter(p.o.b.r, q.o.a) > 0)]));
    const done = new Set(), path = new Set(), seq = [];
    const visit = (p) => {
      if (done.has(p) || path.has(p)) return;
      path.add(p);
      for (const q of after.get(p)) visit(q);
      path.delete(p); done.add(p); seq.push(p);
    };
    info.forEach(visit);
    if (seq.some((p, i) => p.n !== nodes[i])) for (const p of seq) gMk.node().appendChild(p.n);
  }

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
    // 每度經度在螢幕上有幾 px：追逐的繞圈範圍要用「地理距離」限制，才不會縮小地圖時跑出海岸線
    if (c.d.mode === 'chase') c.ppd = Math.max(0.5, screenXY(c.d.lon + 1, c.d.lat)[0] - x);
    const disp = hide ? 'none' : '';
    if (c.g.style.display !== disp) c.g.style.display = disp;
    if (hide) continue;
    setQ(c.g, 'transform', `translate(${x.toFixed(1)},${y.toFixed(1)})`);
    setQ(c.img, 'x', -z / 2); setQ(c.img, 'y', -z);
    setQ(c.img, 'width', z); setQ(c.img, 'height', z);
    setQ(c.shadow, 'rx', z * (c.d.sea ? 0.46 : 0.36)); setQ(c.shadow, 'ry', z * (c.d.sea ? 0.12 : 0.1));
    setQ(c.shadow, 'cy', -z * 0.03);
  }
}

/* ================= 旅遊地圖（台灣、澎湖、金門、馬祖與各離島） ================= */
// 地點分類：旗幟色帶的顏色與狀態列的圖示
const TRAVEL_CATS = {
  // 色帶要亮：地圖上是深綠山林，太暗的底色會和地形混在一起
  sight: { label: '景點', emoji: '📸', band: 'hsl(172,78%,37%)' },
  food: { label: '餐廳', emoji: '🍽️', band: 'hsl(24,92%,49%)' },
  hotel: { label: '飯店', emoji: '🏨', band: 'hsl(268,62%,56%)' },
  event: { label: '活動', emoji: '🎉', band: 'hsl(338,80%,55%)' }
};
// 地點的顯示等級（travel.json 的 tier）：第 1 級一直顯示，第 2、3 級要放大到這個圖磚層級才出現
const TIER_Z = [0, 9.3, 10.5];
// 放大到這個層級（街道等級）還疊在一起的地點，往旁邊挪開一個圖示寬；依序試右、左、右下、左下、右上、左上、下、上
const SPREAD_Z = 13;
const SPREAD_DIRS = [[1, 0], [-1, 0], [0.75, 0.75], [-0.75, 0.75], [0.75, -0.75], [-0.75, -0.75], [0, 1], [0, -1]];
const TW_PAN = [116.8, 20.9, 123.6, 27.3]; // 可拖曳的基本範圍（西、南、東、北），寬螢幕會再往外擴

async function loadTravel() {
  if (state.travel) return state.travel;
  const [cfg, topo, fog, roads] = await Promise.all([
    fetchJSON('travel.json'), fetchJSON('assets/geo/tw-counties.json'), fetchJSON('assets/geo/tw-fog.json'),
    // 道路只是裝飾：載入失敗照樣能用旅遊地圖
    fetchJSON('assets/geo/tw-roads.json').catch((e) => { console.warn('道路資料載入失敗', e); return null; })
  ]);
  // 迷霧多邊形：整數差分 → 單位 Mercator 座標（0~1），順便記下外框，畫的時候跳過畫面外的
  const unpack = (rings, q) => rings.map((r) => {
    const p = new Float64Array(r.length);
    let x = 0, y = 0, x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (let i = 0; i < r.length; i += 2) {
      x += r[i]; y += r[i + 1];
      p[i] = x / q; p[i + 1] = y / q;
      if (p[i] < x0) x0 = p[i]; if (p[i] > x1) x1 = p[i];
      if (p[i + 1] < y0) y0 = p[i + 1]; if (p[i + 1] > y1) y1 = p[i + 1];
    }
    return { p, bb: [x0, y0, x1, y1] };
  });
  const tv = {
    areas: cfg.areas, spots: cfg.spots,
    coast: topojson.mesh(topo, topo.objects.nation),
    county: topojson.mesh(topo, topo.objects.counties, (a, b) => a !== b), // 只要縣市之間的界線，不重複畫海岸
    fog: unpack(fog.fog, fog.q.fog), tw: unpack(fog.tw, fog.q.tw), box: fog.box,
    roads: roads ? unpackRoads(roads) : null
  };
  state.travel = tv;
  drawTw();
  // 地形的海岸改用這些多邊形判斷（原本靠衛星影像，金門、廈門一帶的混濁淺海會被畫成陸地）
  if (tv.roads && Terrain.setRoads) Terrain.setRoads({ box: tv.roads.box, lines: tv.roads.lines, styles: ROAD_STYLE });
  if (Terrain.setLandMask) Terrain.setLandMask(landMaskFor, fog.box);
  else console.warn('terrain.js 是舊版（瀏覽器快取），請按 Ctrl+F5 重新整理');
  return tv;
}
// 把一張圖磚範圍內的陸地多邊形畫成 256×256 的遮罩：0 海、1 陸、2 不在資料範圍內（照舊用影像判斷）、
// 3 台灣本身的陸地（地形會在山區森林種樹，海拔越高松樹越多）
let maskCtx = null;
function landMaskFor(z, x, y) {
  const tv = state.travel, bx = tv && tv.box;
  if (!bx) return null;
  const n = 1 << z, u0 = x / n, v0 = y / n, s = 1 / n, S = 256 * n;
  if (u0 > bx[2] || u0 + s < bx[0] || v0 > bx[3] || v0 + s < bx[1]) return null;
  if (!maskCtx) {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    maskCtx = c.getContext('2d', { willReadFrequently: true });
  }
  const g = maskCtx;
  g.fillStyle = '#0000ff'; g.fillRect(0, 0, 256, 256);           // 範圍外
  g.fillStyle = '#000000'; g.fillRect((bx[0] - u0) * S, (bx[1] - v0) * S, (bx[2] - bx[0]) * S, (bx[3] - bx[1]) * S); // 範圍內先當海
  // 周邊陸地紅色、台灣洋紅色（紅 + 藍）
  for (const [rings, c] of [[tv.fog, '#ff0000'], [tv.tw, '#ff00ff']]) {
    g.fillStyle = c;
    g.beginPath();
    for (const { p, bb } of rings) {
      if (bb[2] < u0 || bb[0] > u0 + s || bb[3] < v0 || bb[1] > v0 + s) continue;
      for (let i = 0; i < p.length; i += 2) {
        const px = (p[i] - u0) * S, py = (p[i + 1] - v0) * S;
        if (i) g.lineTo(px, py); else g.moveTo(px, py);
      }
      g.closePath();
    }
    g.fill();
  }
  const d = g.getImageData(0, 0, 256, 256).data, M = new Uint8Array(65536);
  for (let i = 0; i < 65536; i++) {
    const r = d[i * 4] > 127, b = d[i * 4 + 2] > 127;
    M[i] = r ? (b ? 3 : 1) : b ? 2 : 0;
  }
  return M;
}
/* ---------- 主要道路（遊戲風：深色外框 + 亮色路面，國道加白色分隔虛線，路線編號牌） ----------
 * 道路本身畫進地形圖磚（Terrain.setRoads，在 Worker 裡畫一次就快取），拖曳 / 縮放時不用每一幀重畫；
 * 圖磚會依縮放換層級，線寬也跟著層級變粗。路線編號牌是 SVG（數量少，要保持文字清楚）。 */
// 各級別的樣式（寬度單位是圖磚像素：[層級0, 寬0, 層級1, 寬1] 線性內插；minZ 以下的層級不畫）
const ROAD_STYLE = [
  { minZ: 6, w: [7, 2.2, 13, 8.5], rim: [7, 1.1, 13, 2.4], rimColor: '#5a3412', fill: '#ffa62b',
    dash: { minZ: 11, color: '#fffbea', w: 0.16, seg: [7, 7] } },                           // 國道：橘金色 + 白色分隔虛線
  { minZ: 7, w: [7, 1.8, 13, 7.2], rim: [7, 1, 13, 2.2], rimColor: '#5e4214', fill: '#ffd84d' }, // 快速公路：黃色
  { minZ: 8, w: [8, 1.6, 13, 6], rim: [8, 0.9, 13, 2], rimColor: '#6b5232', fill: '#fff3d9' }     // 省道：奶油白
];
// tw-roads.json（scripts/build_tw_roads.py 產生）：lines 是 [級別, x0, y0, dx, dy, ...]（經緯度 × q 的整數差分），
// tags 是路線編號牌的候選位置 [級別, 編號, x, y]
function unpackRoads(rd) {
  const q = rd.q, R = Math.PI / 180;
  // 經緯度 → 單位 Mercator（0~1），和地形圖磚同一套座標
  const mu = (lon) => lon / 360 + 0.5, mv = (lat) => 0.5 - Math.log(Math.tan(Math.PI / 4 + (lat * R) / 2)) / (2 * Math.PI);
  const box = [Infinity, Infinity, -Infinity, -Infinity];
  const lines = rd.lines.map((l) => {
    const p = new Float64Array(l.length - 1), bb = [Infinity, Infinity, -Infinity, -Infinity];
    let x = 0, y = 0;
    for (let i = 1; i < l.length; i += 2) {
      x += l[i]; y += l[i + 1];
      const u = mu(x / q), v = mv(y / q);
      p[i - 1] = u; p[i] = v;
      if (u < bb[0]) bb[0] = u; if (u > bb[2]) bb[2] = u; if (v < bb[1]) bb[1] = v; if (v > bb[3]) bb[3] = v;
    }
    for (let k = 0; k < 2; k++) { box[k] = Math.min(box[k], bb[k]); box[k + 2] = Math.max(box[k + 2], bb[k + 2]); }
    return { c: l[0], p, bb };
  });
  const tags = rd.tags.map(([c, t, x, y], id) => {
    const u = mu(x / q), v = mv(y / q);
    // 跟真的標誌一樣：數字大字置中，「甲、乙、丙…」小字放在數字下面
    const m = /^(\d+)(\D*)$/.exec(t) || [t, t, ''], num = m[1], suf = m[2];
    let w, h;
    if (c === 0) { w = h = suf ? 29 : num.length > 1 ? 27 : 25; }              // 國道梅花（圓形，寬 = 高）
    else { w = Math.max(suf ? 25 : 22, num.length * 6.4 + 11); h = suf ? 29 : num.length > 1 ? 25 : 23; } // 省道 / 快速公路盾牌（接近正方，跟真的一樣）
    return { id, c, t, num, suf, u, v, w, h, key: c + ':' + t };
  }).sort((a, b) => a.c - b.c || a.id - b.id); // 國道優先
  return { box, lines, tags };
}
const ROAD_TAG_Z = [7.8, 8.4, 8.9];        // 各級別開始顯示編號牌的層級（相當於圖磚層級）
// 目前的縮放相當於第幾層圖磚（台灣全圖約 7~8，街道約 14）
const tileZoom = () => Math.log2((S0 * state.t.k) / 256);
const lerpC = (z, z0, a, z1, b) => a + (b - a) * Math.max(0, Math.min(1, (z - z0) / (z1 - z0)));
// 編號牌照真的台灣公路標誌畫（交通部標誌規則）：
//   國道 = 白色梅花 + 綠色內框 + 黑字；省道 = 藍色盾牌 + 白色內框 + 白字；快速公路（台61~88）= 同樣的盾牌但是紅色。
// 遊戲感只加在外面：深色描邊、立體漸層、底下的影子，形狀和配色不改。
// 梅花外形：五片花瓣（圓）的聯集外框，取樣成一條封閉折線，這樣內框才能只描外緣、不會畫出花瓣重疊的線
const PLUM_UNIT = (() => {
  const d = 0.55, p = 0.47, n = 90, pts = [];                  // 花瓣中心距、花瓣半徑（外緣半徑 = d + p ≈ 1）
  for (let i = 0; i < n; i++) {
    const th = (i / n) * 2 * Math.PI;
    let best = 0;
    for (let k = 0; k < 5; k++) {
      const dl = th - (-Math.PI / 2 + (k * 2 * Math.PI) / 5), s = d * Math.sin(dl);
      if (Math.abs(s) < p && Math.cos(dl) > 0) best = Math.max(best, d * Math.cos(dl) + Math.sqrt(p * p - s * s)); // 射線碰得到這片花瓣才算
    }
    pts.push([Math.cos(th) * best / (d + p), Math.sin(th) * best / (d + p)]);
  }
  return pts;
})();
function plumPath(r) {
  return 'M' + PLUM_UNIT.map(([x, y]) => (x * r).toFixed(2) + ',' + (y * r).toFixed(2)).join('L') + 'Z';
}
// 盾牌外形（a、b 是半寬、半高）：上緣微微拱起、上角圓、兩側往下收成圓尖底
function shieldPath(a, b) {
  const P = (x, y) => (x * a).toFixed(2) + ',' + (y * b).toFixed(2);
  return `M${P(-0.84, -0.9)}Q${P(0, -1.04)} ${P(0.84, -0.9)}Q${P(1, -0.86)} ${P(1, -0.58)}` +
    `C${P(1, 0.08)} ${P(0.46, 0.72)} ${P(0.13, 0.96)}Q${P(0, 1.05)} ${P(-0.13, 0.96)}` +
    `C${P(-0.46, 0.72)} ${P(-1, 0.08)} ${P(-1, -0.58)}Q${P(-1, -0.86)} ${P(-0.84, -0.9)}Z`;
}
// 編號牌：沿路線預先算好的候選位置，依序挑不和介面、地點旗幟、其他編號牌重疊的；
// 同一條路的編號牌之間至少隔 gap 像素（縮小時隔更開，全島圖才不會滿滿都是牌子）
function layoutRoadTags(rs) {
  const rd = state.travel && state.travel.roads;
  if (!rd || !gRoadTag) return;
  const t = state.t, ww = S0 * t.k, z = tileZoom(), out = [], placed = new Map();
  const gap = lerpC(z, 8, 340, 10, 230);
  for (const g of rd.tags) {
    if (z < ROAD_TAG_Z[g.c]) continue;
    const x = t.x + g.u * ww, y = t.y + g.v * ww;
    if (x < 14 || x > W - 14 || y < 14 || y > H - 14) continue;
    const h = g.h, r = { x: x - g.w / 2 - 4, y: y - h / 2 - 4, w: g.w + 8, h: h + 8 };
    const same = placed.get(g.key);
    if (same && same.some((p) => Math.hypot(p[0] - x, p[1] - y) < gap)) continue;
    if (rs.some((q) => inter(r, q) > 0)) continue;
    rs.push(r);
    if (same) same.push([x, y]); else placed.set(g.key, [[x, y]]);
    out.push({ g, x, y, h });
    if (out.length >= 48) break;
  }
  const sel = gRoadTag.selectAll('g.rtag').data(out, (d) => d.g.id);
  sel.exit().remove();
  const en = sel.enter().append('g').attr('class', (d) => 'rtag rtag-' + ROAD_CLS[d.g.c]);
  en.each(function (d) {
    const s = d3.select(this), g = d.g, a = g.w / 2, b = g.h / 2;
    const shape = g.c ? shieldPath(a, b) : plumPath(a);
    // 內框：國道離外緣約 2.2px 的綠色細框；盾牌離外緣約 2px 的白色細框（和真的標誌一樣有一圈留白）
    const inner = g.c ? shieldPath(a - 2.1, b - 2.1) : plumPath(a - 2.4);
    s.append('path').attr('class', 'sd').attr('d', shape).attr('transform', 'translate(0,1.8)'); // 底下的影子
    s.append('path').attr('class', 'sh').attr('d', shape);
    s.append('path').attr('class', 'in').attr('d', inner);
    s.append('path').attr('class', 'gl').attr('d', inner);                                       // 上半部的反光
    // 數字（盾牌的視覺重心偏上，字也往上放一點；有甲乙丙時數字再往上、小字放下面）
    const ny = g.suf ? (g.c ? -4.4 : -3.4) : g.c ? -1.4 : 0.4;
    s.append('text').attr('class', 'n' + (g.num.length > 1 ? ' n2' : '')).attr('y', ny).text(g.num);
    if (g.suf) s.append('text').attr('class', 'sf').attr('y', g.c ? 5.2 : 6.4).text(g.suf);
  });
  en.merge(sel).each(function (d) {
    d3.select(this).attrQ('transform', `translate(${d.x.toFixed(1)},${d.y.toFixed(1)})`);
  });
}

// 台灣海岸線與縣市界（投影座標，跟著 gTw 的 transform 縮放）
function drawTw() {
  // 和股市的國界共用分級簡化：依縮放倍率挑一級，螢幕上看不出差別的折點不畫
  twLod.reset();
  sizeTwStroke(state.t.k);
  twLod.update(state.t.k);
}

// 戰爭迷霧：台灣以外的陸地（大陸沿海、琉球、菲律賓）褪色並蓋上一層霧，地圖只突顯台灣
let fogCv = null;
function drawFog() {
  const tv = state.travel;
  if (state.layer !== 'travel' || !tv) return;
  const t = state.t, ww = S0 * t.k, cw = tctx.canvas.width, ch = tctx.canvas.height;
  if (!fogCv) fogCv = document.createElement('canvas');
  if (fogCv.width !== cw || fogCv.height !== ch) { fogCv.width = cw; fogCv.height = ch; }
  const f = fogCv.getContext('2d');
  f.setTransform(1, 0, 0, 1, 0, 0);
  f.globalCompositeOperation = 'source-over';
  f.filter = 'none';
  f.clearRect(0, 0, cw, ch);
  f.setTransform(dpr, 0, 0, dpr, 0, 0);
  // 周邊陸地的資料精度約 400 公尺：迷霧往外多蓋約 0.8 公里，大陸海岸才不會從霧邊露出來
  const pxKm = ww / (2 * Math.PI * 6371) / Math.cos((24 * Math.PI) / 180);
  const grow = Math.max(5, Math.min(140, pxKm * 0.8));
  const trace = (rings, m) => {
    f.beginPath();
    for (const { p, bb } of rings) {
      if (t.x + bb[2] * ww < -m || t.x + bb[0] * ww > W + m || t.y + bb[3] * ww < -m || t.y + bb[1] * ww > H + m) continue;
      for (let i = 0; i < p.length; i += 2) {
        const x = t.x + p[i] * ww, y = t.y + p[i + 1] * ww;
        if (i) f.lineTo(x, y); else f.moveTo(x, y);
      }
      f.closePath();
    }
  };
  f.lineJoin = 'round';
  f.fillStyle = f.strokeStyle = '#000';
  f.filter = `blur(${(grow * 0.5).toFixed(1)}px)`;
  f.lineWidth = grow * 2;
  trace(tv.fog, grow * 3);
  f.fill(); f.stroke();
  // 台灣本身（含金門、馬祖）從霧裡挖掉
  f.globalCompositeOperation = 'destination-out';
  f.filter = `blur(${Math.max(1, grow * 0.15).toFixed(1)}px)`;
  f.lineWidth = Math.max(2, grow * 0.4);
  trace(tv.tw, grow * 3);
  f.fill(); f.stroke();
  f.filter = 'none';
  f.setTransform(1, 0, 0, 1, 0, 0);
  f.globalCompositeOperation = 'source-in';
  // 先用灰色以 saturation 混合 → 底下的地形褪成灰階；再蓋一層半透明的深藍霧
  f.fillStyle = '#808080'; f.fillRect(0, 0, cw, ch);
  tctx.setTransform(1, 0, 0, 1, 0, 0);
  tctx.globalCompositeOperation = 'saturation';
  tctx.drawImage(fogCv, 0, 0);
  f.fillStyle = '#18294a'; f.fillRect(0, 0, cw, ch);
  tctx.globalCompositeOperation = 'source-over';
  tctx.globalAlpha = 0.6;
  tctx.drawImage(fogCv, 0, 0);
  tctx.globalAlpha = 1;
}

// 把經緯度框放進可用區域（扣掉被介面蓋住的地方，上方多留給地點旗幟）
function fitBox(box, kMax = maxK * 0.5) {
  const ins = overlayInsets();
  const px = desktopMQ.matches ? 50 : 30, pt = 64, pb = 26;
  const aw = Math.max(80, W - ins.l - ins.r - px * 2), ah = Math.max(80, H - ins.t - ins.b - pt - pb);
  const a = projection([box[0], box[3]]), b = projection([box[2], box[1]]);
  const k = Math.min(kMax, aw / Math.max(1e-9, b[0] - a[0]), ah / Math.max(1e-9, b[1] - a[1]));
  const cx = (a[0] + b[0]) / 2, cy = (a[1] + b[1]) / 2;
  const sx = ins.l + px + aw / 2, sy = ins.t + pt + ah / 2;
  return d3.zoomIdentity.translate(sx - k * cx, sy - k * cy).scale(k);
}
const constrainT = (tr) => zoomB.constrain()(tr, [[0, 0], [W, H]], zoomB.translateExtent());
function areaTransform(key) {
  const areas = state.travel.areas, a = areas.find((x) => x.k === key) || areas[0];
  return constrainT(fitBox(a.box));
}
function flyTo(tr) {
  (state.anim ? svg.transition().duration(900).ease(d3.easeCubicInOut) : svg).call(zoomB.transform, constrainT(tr));
}
// 放大到這幾個地點（詳情卡的「放大到這裡」）
function zoomToSpots(list) {
  const lons = list.map((s) => s.lon), lats = list.map((s) => s.lat);
  const cx = (Math.min(...lons) + Math.max(...lons)) / 2, cy = (Math.min(...lats) + Math.max(...lats)) / 2;
  const r = Math.max(0.006, (Math.max(...lons) - Math.min(...lons)) * 1.2, (Math.max(...lats) - Math.min(...lats)) * 1.2);
  const tr = fitBox([cx - r, cy - r, cx + r, cy + r]);
  // 至少放大一倍，點了才有感覺
  if (tr.k < state.t.k * 2 && state.t.k * 2 <= maxK * 0.5) {
    const k = state.t.k * 2, c = projection([cx, cy]), ins = overlayInsets();
    flyTo(d3.zoomIdentity.translate((W + ins.l - ins.r) / 2 - k * c[0], (H + ins.t - ins.b) / 2 - k * c[1]).scale(k));
  } else flyTo(tr);
}

// 活動的名稱前面加上通常月份（例如「7–8月 宜蘭童玩節」），其它分類只顯示名稱
function spotLabel(s) {
  return s.cat === 'event' && s.months ? `${s.months} ${s.name}` : s.name;
}

function openSpot(s) {
  const cat = TRAVEL_CATS[s.cat] || TRAVEL_CATS.sight;
  const q = encodeURIComponent(`${s.full || s.name} ${s.addr || ''}`.trim());
  showSheet(`
    <div class="hd"><span class="big"><img class="beast3d" src="assets/travel/${esc(s.icon)}.png" alt=""></span>
      <div><div class="nm">${esc(spotLabel(s))}</div><div class="sym">${cat.emoji} ${cat.label} · ${esc(s.county)}${esc(s.town)}</div></div></div>
    <p class="desc">${esc(s.desc)}</p>
    <div class="meta">${s.full ? `<div><b>名稱</b>　${esc(s.full)}</div>` : ''}${s.months ? `<div><b>通常月份</b>　${esc(s.months)}</div>` : ''}${s.note ? `<div><b>備註</b>　${esc(s.note)}</div>` : ''}${s.addr ? `<div><b>地址</b>　${esc(s.addr)}</div>` : ''}</div>
    <a class="big-btn gbtn" href="https://www.google.com/maps/search/?api=1&amp;query=${q}" target="_blank" rel="noopener noreferrer">🗺️ 在 Google 地圖開啟</a>
    <button class="big-btn gbtn" data-act="zoom-spot" data-id="${esc(s.id)}">🔍 放大到這裡</button>`);
}

// 地點標記：一顆小水滴圖釘（顏色依分類，不會動）+ 文明帝國式旗幟（和股市的城市旗幟同款）
function buildPoi(g) {
  const pin = g.append('g').attr('class', 'pin');
  pin.append('circle').attr('class', 'tap').attr('fill', 'transparent');
  pin.append('ellipse').attr('class', 'shadow').attr('filter', 'url(#soft)');
  const dot = pin.append('g').attr('class', 'dot');
  dot.append('path').attr('class', 'drop').attr('d', 'M0,0C-0.12,-0.26 -0.4,-0.42 -0.4,-0.66A0.4,0.4 0 1 1 0.4,-0.66C0.4,-0.42 0.12,-0.26 0,0Z');
  dot.append('circle').attr('class', 'eye').attr('cy', -0.66).attr('r', 0.15);
  const b = buildBanner(g);
  b.append('text').attr('class', 't1');
}
function sizePin(g, z, color) {
  g.select('.shadow').attrQ('rx', z * 0.26).attrQ('ry', z * 0.08).attrQ('cy', -z * 0.01);
  g.select('.tap').attrQ('r', Math.max(z * 0.6, 14)).attrQ('cy', -z * 0.5);
  g.select('.dot').attrQ('transform', `scale(${z.toFixed(2)})`);
  g.select('.drop').attrQ('fill', color);
}
function layoutTravel() {
  const tv = state.travel;
  if (!tv) return;
  // 圖示大小，放大時略大（地點圖示是一顆小水滴，不佔空間）
  const z = 18 + (Math.max(28, Math.min(42, 14 + Math.log2(state.t.k) * 2.4)) - 28) * 0.57;
  // 介面蓋住的地方不放旗幟
  const rs = uiRects(['#chips', '#hud']);
  // 顯示等級：縮小時只出現第 1 級（必去），放大到 TIER_Z 才陸續出現第 2、3 級（像遊戲地圖的地標分級）。
  // 先放等級高的（同級照 travel.json 的順序），圖示和已放的地點疊在一起就先不畫，放大後自然會分開。
  const tz = tileZoom(), list = [];
  for (const s of tv.spots) {
    const t = s.tier || 3;
    if (tz < TIER_Z[t - 1]) continue;
    const [x, y] = screenXY(s.lon, s.lat);
    if (x < -60 || x > W + 60 || y < -60 || y > H + 60) continue;
    list.push({ s, t, x, y });
  }
  list.sort((a, b) => a.t - b.t);
  // 1) 照優先順序放圖示：和已放的圖示疊在一起就先不畫（放大後自然會分開）。
  //    但放大到街道等級（SPREAD_Z）還疊在一起，代表兩個地點本來就在同一處（例如傳藝中心和園區裡的飯店），
  //    再放大也分不開，這時把後面那個往旁邊挪一個圖示寬（約百公尺），兩個都顯示。
  //    第 1 級（必去）不管縮放多小都一定要出現，所以任何層級疊到都直接挪開。
  const cand = [], icoR = (x, y) => ({ x: x - z * 0.48, y: y - z * 0.95, w: z * 0.96, h: z * 1.05 });
  const hitIco = (r) => cand.some((q) => inter(r, q.ri) > 0);
  for (const d of list) {
    d.ri = icoR(d.x, d.y);
    if (hitIco(d.ri)) {
      if (tz < SPREAD_Z && d.t > 1) continue;
      // 第 1 級一定要出現：一圈挪不開就繼續往外找（最多 3 圈）
      let spot = null;
      for (let ring = 1; ring <= (d.t === 1 ? 3 : 1) && !spot; ring++) {
        spot = SPREAD_DIRS.map(([dx, dy]) => [d.x + dx * z * 1.05 * ring, d.y + dy * z * 1.05 * ring]).find(([x, y]) => !hitIco(icoR(x, y)));
      }
      if (!spot) continue;
      [d.x, d.y] = spot; d.ri = icoR(d.x, d.y);
    }
    cand.push(d);
  }
  // 2) 照優先順序找旗幟位置：不能壓到介面、別的旗幟、比自己優先的圖示；
  //    優先挑不會蓋到低等級圖示的那一邊，真的沒有才蓋上去（被蓋到的低等級地點這次就不畫）。
  //    所以等級高的旗幟一定先拿到位置，等級低的地點只要旁邊有空位就會留著。
  const tags = [], drop = new Set();
  cand.forEach((d, i) => {
    if (drop.has(d)) return;
    d.w = Math.ceil(Math.max(56, textWidthOf(spotLabel(d.s)) + 22)); d.h = 26;
    const cands = [
      { x: d.x - d.w / 2, y: d.y - z * 1.05 - d.h - 6, pos: 'up' },
      { x: d.x + z * 0.6 + 4, y: d.y - z * 0.5 - d.h / 2, pos: 'right' },
      { x: d.x - z * 0.6 - 4 - d.w, y: d.y - z * 0.5 - d.h / 2, pos: 'left' },
      { x: d.x - d.w / 2, y: d.y + z * 0.25 + 4, pos: 'down' },
      // 擠在一起時再往斜上、斜下、更上方找位置（沒有尾巴指向，但旗幟貼著圖示）
      { x: d.x - d.w + z * 0.3, y: d.y - z * 1.05 - d.h - 6, pos: 'upL' },
      { x: d.x - z * 0.3, y: d.y - z * 1.05 - d.h - 6, pos: 'upR' },
      { x: d.x - d.w / 2, y: d.y - z * 1.05 - d.h * 2 - 10, pos: 'up2' },
      { x: d.x + z * 0.6 + 4, y: d.y - z * 0.5 - d.h * 1.5 - 2, pos: 'right2' },
      { x: d.x - z * 0.6 - 4 - d.w, y: d.y - z * 0.5 - d.h * 1.5 - 2, pos: 'left2' },
      { x: d.x + z * 0.6 + 4, y: d.y - z * 0.5 + d.h * 0.5 + 2, pos: 'right3' },
      { x: d.x - z * 0.6 - 4 - d.w, y: d.y - z * 0.5 + d.h * 0.5 + 2, pos: 'left3' }
    ];
    let best = null, bestHit = null;
    for (const c of cands) {
      const r = { x: c.x, y: c.y, w: d.w, h: d.h };
      if (r.x < 2 || r.y < 2 || r.x + d.w > W - 2 || r.y + d.h > H - 2) continue;
      if (rs.some((q) => inter(r, q) > 0) || tags.some((q) => inter(r, q) > 0)) continue;
      if (cand.some((q, j) => j <= i && !drop.has(q) && inter(r, q.ri) > 0)) continue;
      const hit = cand.filter((q, j) => j > i && !drop.has(q) && inter(r, q.ri) > 0);
      if (!hit.length) { best = c; bestHit = []; break; }
      // 第 1 級的圖示不能被別人的旗幟蓋掉
      if (!best && !hit.some((q) => q.t === 1)) { best = c; bestHit = hit; }
    }
    d.c = best;
    if (!best) return;
    tags.push({ x: best.x, y: best.y, w: d.w, h: d.h });
    for (const q of bestHit) drop.add(q);
  });
  const shown = cand.filter((d) => !drop.has(d));
  rs.push(...shown.map((d) => d.ri), ...tags);

  const sel = gPoi.selectAll('g.poi').data(shown, (d) => d.s.id);
  sel.exit().remove();
  const en = sel.enter().append('g').attr('class', 'poi mk').attr('role', 'button').attr('tabindex', 0)
    .on('click', (e, d) => openSpot(d.s))
    .on('keydown', (e, d) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openSpot(d.s); } });
  en.each(function () { buildPoi(d3.select(this)); });
  // 旗幟照優先順序（shown 的順序）搶位置，不照 DOM 順序（DOM 為了疊放順序是反過來排的）
  const node = new Map();
  en.merge(sel).each(function (d) { node.set(d.s.id, this); });
  for (const d of shown) {
    const s = d3.select(node.get(d.s.id)), sp = d.s, cat = TRAVEL_CATS[sp.cat] || TRAVEL_CATS.sight;
    // 旗幟只寫名稱，分類用色帶顏色分（景點青綠、餐廳橘、飯店紫）
    s.attrQ('transform', `translate(${d.x.toFixed(1)},${d.y.toFixed(1)})`).attrQ('aria-label', `${spotLabel(sp)}（${cat.label}）`);
    sizePin(s, z, cat.band);

    // 旗幟（位置上面已經算好；找不到空位就只畫圖示）
    const b = s.select('.bubble'), t1 = b.select('.t1').textQ(spotLabel(sp)), c = d.c, w = d.w, h = d.h;
    if (!c) { b.styleQ('display', 'none'); continue; }
    const bx = Math.round(c.x), by = Math.round(c.y);
    b.styleQ('display', null).attrQ('transform', `translate(${bx - d.x},${by - d.y})`);
    drawBanner(b, w, h, { bg: 'url(#bannerBg)', band: cat.band, tail: c.pos === 'up', bandH: h - 6 });
    t1.attrQ('x', w / 2).attrQ('y', h / 2);
  }
  // 等級高的畫在最上面（後畫的蓋前面）；順序沒變就不動 DOM（拖曳時每幀都會跑到這裡）
  const want = shown.map((d) => node.get(d.s.id)).reverse(), cur = gPoi.node().children;
  if (want.some((n, i) => cur[i] !== n)) for (const n of want) gPoi.node().appendChild(n);
  layoutRoadTags(rs); // 道路編號牌最後放，讓位給地點旗幟
}

/* ================= 圖層列 / 篩選列 / 其它指數面板 ================= */
function buildRail() {
  $('#layers').innerHTML = LAYERS.map((l) =>
    `<button class="rl${l.k === state.layer ? ' on' : ''}" data-k="${l.k}" title="${l.title}：${l.desc}${l.ready ? '' : '（即將推出）'}"` +
    ` aria-pressed="${l.k === state.layer}"${l.ready ? '' : ' aria-disabled="true"'}>` +
    `<span class="ri">${l.icon}</span><span class="rt">${l.label}</span>${l.ready ? '' : '<i class="soon">即將</i>'}</button>`).join('');
  $('#layers').onclick = (e) => {
    const b = e.target.closest('.rl');
    if (!b) return;
    const l = LAYERS.find((x) => x.k === b.dataset.k);
    if (!l.ready) { toast(`🚧 ${l.icon} ${l.title}（${l.desc}）即將推出`); return; }
    setLayer(l.k);
  };
}
// 切換圖層：股市（世界地圖）⇄ 旅遊（台灣地圖）
async function setLayer(k) {
  if (k === state.layer) return;
  if (k === 'travel') {
    try { await loadTravel(); } catch (e) { console.error(e); toast('😵 旅遊地圖載入失敗，請檢查網路後再試'); return; }
  }
  state.layer = k;
  const travel = k === 'travel';
  document.querySelectorAll('#layers .rl').forEach((x) => {
    x.classList.toggle('on', x.dataset.k === k);
    x.setAttribute('aria-pressed', x.dataset.k === k);
  });
  document.body.classList.toggle('travel', travel);
  if (travel && state.panel) setPanel(false);
  if (travel && window.Disasters) Disasters.clear(); // 災難目前只在股市地圖
  $('#sheet').hidden = true;
  gMk.style('display', travel ? 'none' : null);
  gDecor.style('display', travel ? 'none' : null);
  gTw.style('display', travel ? null : 'none');
  gRoadTag.style('display', travel ? null : 'none');
  gPoi.style('display', travel ? null : 'none');
  if (travel) { walkers.forEach((w) => (w.vis = false)); critters.forEach((c) => (c.vis = false)); }
  $('#map').setAttribute('aria-label', travel ? '台灣旅遊地圖' : '世界股市地圖');
  $('#attrib').textContent = '地形資料 © Mapzen/AWS Terrain Tiles · Esri, Maxar, Earthstar Geographics' +
    (travel ? ' · 行政界 © 內政部國土測繪中心 · Natural Earth' + (state.travel.roads ? ' · 道路 © OpenStreetMap 貢獻者' : '') : '');
  buildChips(); updateChips();
  setZoomLimits();
  // 先換成畫面上看到的那一份世界（世界左右循環），飛過去時才不會繞地球
  svg.interrupt().call(zoomB.transform, state.t);
  applyRegion(true);
  renderHud();
  scheduleTerrain();
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
  const defs = [['all', '🌍', '全球'], ['asia', '🌏', '亞太'], ['europe', '🏰', '歐洲'], ['americas', '🗽', '美洲'], ['mea', '🐪', '中東非洲']];
  const chip = (k, i, t) => `<button class="chip gbtn" data-k="${k}" aria-pressed="false"><span class="ci">${i}</span>${t}</button>`;
  const nav = $('#chips');
  // 旅遊地圖：本島與各離島（設定在 travel.json 的 areas）
  if (state.layer === 'travel') {
    nav.innerHTML = state.travel.areas.map((a) => chip(a.k, a.icon, a.label)).join('');
    nav.onclick = (e) => {
      const b = e.target.closest('.chip');
      if (!b) return;
      state.tArea = b.dataset.k;
      updateChips(); applyRegion(true);
    };
    return;
  }
  // 區域是單選；「其它指數」是獨立的開關，用分隔線隔開
  nav.innerHTML = defs.map((d) => chip(...d)).join('') + '<span class="csep" aria-hidden="true"></span>' + chip('more', '📊', '其它指數');
  nav.onclick = (e) => {
    const b = e.target.closest('.chip');
    if (!b) return;
    const k = b.dataset.k;
    if (k === 'more') { setPanel(!state.panel); return; }
    state.activeRegion = k;
    updateChips(); applyRegion(true); renderPanel();
  };
}
function updateChips() {
  document.querySelectorAll('.chip').forEach((b) => {
    const k = b.dataset.k;
    const on = state.layer === 'travel' ? k === state.tArea
      : k === 'more' ? state.panel : k === state.activeRegion;
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
  if (state.layer === 'travel' && state.travel) {
    // 旅遊地圖沒有情緒條（CSS 隱藏），狀態列改成各分類的地點數
    const n = (c) => state.travel.spots.filter((s) => s.cat === c).length;
    // 旗幟不寫分類了，狀態列附上色塊當圖例
    $('#statusLine').innerHTML = '✈️ ' + Object.entries(TRAVEL_CATS).map(([c, v]) =>
      `<i class="cat-sw" style="background:${v.band}" aria-hidden="true"></i>${v.label} ${n(c)}`).join(' · ');
    return;
  }
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
    <p class="small">遊戲風地形由程式即時繪製：高度資料來自 AWS Terrain Tiles（Mapzen / SRTM 等），地貌判斷參考 Esri World Imagery（Esri、Maxar、Earthstar Geographics）。3D 動物與旅遊圖示來自 Microsoft Fluent Emoji（MIT 授權），國旗圖來自 flagcdn.com。旅遊地圖的縣市界來自內政部國土測繪中心（政府資料開放授權，經 taiwan-atlas 轉檔），周邊陸地來自 Natural Earth，主要道路來自 OpenStreetMap（© OpenStreetMap 貢獻者，ODbL 授權）。</p>`);
}
function onSheetClick(e) {
  const s = $('#sheet');
  if (e.target.closest('.x') || e.target.classList.contains('back')) { s.hidden = true; return; }
  const tab = e.target.closest('.gtab');
  if (tab && state.bySym[tab.dataset.s]) { openCard(state.bySym[tab.dataset.s]); return; }
  const a = e.target.closest('[data-act]');
  if (!a) return;
  if (a.dataset.act === 'zoom-spot') {
    s.hidden = true;
    const sp = state.travel && state.travel.spots.find((x) => x.id === a.dataset.id);
    if (sp) zoomToSpots([sp]);
    return;
  }
  if (a.dataset.act === 'color') { state.redUp = !state.redUp; store.set('redUp', state.redUp); refreshView(); }
  if (a.dataset.act === 'anim') { state.anim = !state.anim; store.set('anim', state.anim); document.body.classList.toggle('noanim', !state.anim); }
  openSettings();
}

/* ================= 重新整理 / 啟動 ================= */
function refreshView() {
  paintLand(); scheduleLayout(); renderPanel(); renderHud();
}
function tick() {
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

  // 開啟網頁時選「現在正在開盤」的區域（都休市就選最快開盤的），之後由使用者自己切換
  state.activeRegion = pickAutoRegion();

  buildSvg();
  buildRail();
  buildChips();
  layoutGeometry();
  updateChips();
  applyRegion(false);
  renderHud();
  scheduleLayout();
  initDisasters();
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
