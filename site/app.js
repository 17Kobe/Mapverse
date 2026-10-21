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
const NEUTRAL = ['#d7f0ae', '#c6e9a0', '#f4e9b8', '#e3efb4'];

// 裝飾用的地形 / 動物 / 海洋小物件 [emoji, lon, lat]
const DECOR = [
  ['🏔️', 86, 28], ['🏔️', 10, 46.6], ['🏔️', -110, 45], ['🏔️', -70, -18], ['🏔️', 37, -3],
  ['🌲', 95, 61], ['🌲', -105, 62], ['🌲', 30, 62], ['🌴', -62, -4], ['🌴', 20, 2],
  ['🏜️', 10, 24], ['🌵', -112, 32], ['🔺', 31, 27], ['🧊', -40, 73],
  ['🐧', 10, -78], ['🐧', 110, -77], ['🐻‍❄️', -60, 84],
  ['🏝️', -150, -15], ['🏝️', 172, -9], ['🐋', -35, 36], ['🐬', 72, -14],
  ['⛵', -140, 25], ['⛵', 160, 15], ['🐙', -20, -30], ['🦈', 60, -35],
  ['🪸', 147, -17], ['🌋', -155, 19.5], ['🦭', -30, 65]
];

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
const pctColor = (pct) => `hsl(${hue(pct)},72%,38%)`;
function fillFor(m) {
  const q = state.quotes[m.s];
  if (!q) return '#e6e1d2';
  const mag = Math.min(Math.abs(q.pct), 3) / 3;
  const st = marketStatus(m);
  const sat = st === 'open' ? 72 : 34;
  const light = (st === 'open' ? 86 : 90) - mag * (st === 'open' ? 32 : 18);
  return `hsl(${hue(q.pct)},${sat}%,${light}%)`;
}
function landFill(d) {
  const id = pad3(d.id);
  const m = state.byId[id];
  if (m) return fillFor(m);
  if (id === '010') return '#f4faff';
  return NEUTRAL[hash(id) % 4];
}
const fmtN = (p, mode) => {
  if (p == null || isNaN(p)) return '--';
  const a = Math.abs(p);
  const d = mode === 'short' ? (a >= 1000 ? 0 : 2) : (a >= 10000 ? 0 : 2);
  return p.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
};
const fmtPct = (p, d = 2) => (p >= 0 ? '+' : '') + p.toFixed(d) + '%';
const arrow = (p) => (p > 0 ? '▲' : p < 0 ? '▼' : '–');
const mood = (p) => (p > 1.5 ? '🤩' : p > 0.05 ? '😊' : p > -0.05 ? '😐' : p > -1.5 ? '😟' : '😱');

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
let svg, gZoom, gShadow, gLand, gDecor, gMk, zoomB, projection, path, W = 0, H = 0;

function buildSvg() {
  svg = d3.select('#map');
  const defs = svg.append('defs');
  const og = defs.append('linearGradient').attr('id', 'ocean').attr('x1', 0).attr('y1', 0).attr('x2', 0).attr('y2', 1);
  og.append('stop').attr('offset', '0%').attr('stop-color', '#3aa8e0');
  og.append('stop').attr('offset', '100%').attr('stop-color', '#72d6ef');
  const pat = defs.append('pattern').attr('id', 'waves').attr('width', 48).attr('height', 26).attr('patternUnits', 'userSpaceOnUse');
  pat.append('path').attr('d', 'M0 13 q6 -6 12 0 t12 0 t12 0 t12 0').attr('fill', 'none')
    .attr('stroke', '#fff').attr('stroke-opacity', 0.22).attr('stroke-width', 1.6).attr('stroke-linecap', 'round');
  svg.append('rect').attr('class', 'sea').attr('fill', 'url(#ocean)');
  svg.append('rect').attr('class', 'sea').attr('fill', 'url(#waves)');

  gZoom = svg.append('g');
  gZoom.append('path').attr('class', 'sphere');
  gShadow = gZoom.append('g').attr('class', 'shadow');
  gLand = gZoom.append('g').attr('class', 'land');
  gDecor = svg.append('g').attr('class', 'decor').style('pointer-events', 'none');
  gMk = svg.append('g').attr('class', 'markers');

  gDecor.selectAll('text').data(DECOR).enter().append('text').attr('class', 'dc').text((d) => d[0]);

  const g = gMk.selectAll('g.mk').data(state.maps, (d) => d.s).enter().append('g').attr('class', 'mk')
    .on('click', (e, d) => openCard(d));
  g.each(function (d) {
    const s = d3.select(this);
    const an = s.append('g').attr('class', 'an');
    an.append('circle').attr('class', 'ring');
    an.append('text').attr('class', 'emoji').text(d.a);
    an.append('text').attr('class', 'mood');
    const b = s.append('g').attr('class', 'bubble');
    b.append('rect').attr('class', 'bg').attr('rx', 9);
    b.append('path').attr('class', 'tail');
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
  svg.selectAll('rect.sea').attr('width', W).attr('height', H);
  projection = d3.geoNaturalEarth1().fitExtent([[8, 8], [W - 8, H - 8]], { type: 'Sphere' });
  path = d3.geoPath(projection);
  gZoom.select('.sphere').attr('d', path({ type: 'Sphere' }));
  gShadow.selectAll('path').data(state.countries).join('path').attr('d', path).attr('transform', 'translate(0,2.2)');
  gLand.selectAll('path').data(state.countries).join('path').attr('d', path);
  zoomB.extent([[0, 0], [W, H]]).translateExtent([[0, 0], [W, H]]);
  paintLand();
}
function paintLand() {
  if (!gLand) return;
  gLand.selectAll('path').attr('fill', landFill).classed('hot', (d) => !!state.byId[pad3(d.id)]);
}

function regionTransform(key) {
  const R = REGIONS[key];
  if (!R || !R.bbox) return d3.zoomIdentity;
  const [lo0, la0, lo1, la1] = R.bbox;
  const mx = (lo0 + lo1) / 2, my = (la0 + la1) / 2;
  const pts = [[lo0, la0], [lo1, la0], [lo0, la1], [lo1, la1], [mx, la0], [mx, la1], [lo0, my], [lo1, my]].map((p) => projection(p));
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const k = Math.max(1, Math.min(16, Math.min(W / (x1 - x0), H / (y1 - y0)) * 0.9));
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  const tr = d3.zoomIdentity.translate(W / 2 - k * cx, H / 2 - k * cy).scale(k);
  return zoomB.constrain()(tr, [[0, 0], [W, H]], [[0, 0], [W, H]]);
}
function applyRegion(animate) {
  if (!projection) return;
  const tr = regionTransform(state.activeRegion);
  const sel = animate && state.anim ? svg.transition().duration(900).ease(d3.easeCubicInOut) : svg;
  sel.call(zoomB.transform, tr);
}

function onTransform() {
  gZoom.attr('transform', state.t.toString());
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
  const size = Math.max(22, Math.min(34, 18 + k * 3.2));
  const rects = [], vis = new Map();
  const arr = state.maps.slice().sort((a, b) => b.w - a.w);

  // 第一輪：放動物，太擠的先隱藏（放大後會出現）
  for (const m of arr) {
    const p = projection([m.lon, m.lat]);
    const x = t.applyX(p[0]), y = t.applyY(p[1]);
    if (x < -20 || x > W + 20 || y < -20 || y > H + 20) continue;
    const a = { x: x - size * 0.6, y: y - size * 0.6, w: size * 1.2, h: size * 1.2 };
    const area = a.w * a.h;
    if (rects.some((r) => inter(a, r) / area > 0.3)) continue;
    rects.push(a);
    vis.set(m.s, { m, x, y, a, size, b: null });
  }
  // 第二輪：放氣泡，先試完整版，再試迷你版
  for (const m of arr) {
    const o = vis.get(m.s);
    if (!o || !state.quotes[m.s]) continue;
    const modes = [{ w: 112, h: 38, mode: 'full' }, { w: 70, h: 21, mode: 'mini' }];
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
    const s = d3.select(this), o = vis.get(m.s);
    if (!o) { s.style('display', 'none'); return; }
    s.style('display', null).attr('transform', `translate(${o.x},${o.y})`);
    const st = marketStatus(m), q = state.quotes[m.s];
    const pct = q ? q.pct : 0;
    const an = s.select('.an').attr('class', 'an ' + st);
    an.select('.ring').attr('r', o.size * 0.62);
    an.select('.emoji').attr('font-size', o.size).style('animation-delay', (hash(m.s) % 10) / 10 + 's');
    an.select('.mood').attr('x', o.size * 0.5).attr('y', -o.size * 0.5).attr('font-size', o.size * 0.5)
      .text(st === 'closed' ? '💤' : q ? mood(pct) : '');

    const b = s.select('.bubble');
    if (!o.b || !q) { b.style('display', 'none'); return; }
    const { w, h } = o.b.r, full = o.b.mode === 'full', col = pctColor(pct);
    b.style('display', null).attr('transform', `translate(${o.b.r.x - o.x},${o.b.r.y - o.y})`);
    b.select('.bg').attr('width', w).attr('height', h).attr('fill', st === 'closed' ? '#eef1f6' : '#fff');
    b.select('.tail').style('display', o.b.pos === 'up' ? null : 'none')
      .attr('d', `M${w / 2 - 6},${h - 1} L${w / 2},${h + 6} L${w / 2 + 6},${h - 1}`);
    const t1 = b.select('.t1').attr('x', w / 2).attr('y', full ? 11 : h / 2 + 0.5);
    const t2 = b.select('.t2').attr('x', w / 2).attr('y', 27).style('display', full ? null : 'none');
    if (full) {
      t1.select('.a').text(`${m.flag} ${m.short}`);
      t1.select('.m').text('');
      t2.select('.va').text(fmtN(q.p, 'short'));
      t2.select('.pc').attr('fill', col).text(`${arrow(pct)}${Math.abs(pct).toFixed(2)}%`);
    } else {
      t1.select('.a').text(m.flag);
      t1.select('.m').attr('fill', col).attr('dx', 3).text(fmtPct(pct, 1));
    }
  });

  // 裝飾：不壓住任何標記才顯示
  const ds = Math.max(15, Math.min(24, 14 + k * 1.6));
  gDecor.selectAll('text').each(function (d) {
    const p = projection([d[1], d[2]]);
    const x = t.applyX(p[0]), y = t.applyY(p[1]);
    const r = { x: x - ds / 2, y: y - ds / 2, w: ds, h: ds };
    const hide = x < 0 || x > W || y < 0 || y > H || rects.some((z) => inter(r, z) > 0);
    d3.select(this).style('display', hide ? 'none' : null).attr('x', x).attr('y', y).attr('font-size', ds);
  });
}

/* ================= HUD / 篩選 / 道具欄 ================= */
function buildChips() {
  const defs = [['auto', '🧭 自動'], ['all', '🌍 全球'], ['asia', '🌏 亞太'], ['europe', '🏰 歐洲'], ['americas', '🗽 美洲'], ['mea', '🐪 中東非洲']];
  const nav = $('#chips');
  nav.innerHTML = defs.map((d) => `<button class="chip" data-k="${d[0]}">${d[1]}</button>`).join('');
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
    return `<button class="item${sep ? ' sep' : ''}" data-s="${i.s}"><div class="ie">${i.e}</div><div class="in">${i.zh}</div><div class="iv">${v}</div>${p}</button>`;
  };
  const box = $('#items');
  const sl = box.scrollLeft;
  box.innerHTML = extras.map((i) => card(i, false)).join('') + globals.map((i, n) => card(i, n === 0 && extras.length > 0)).join('');
  box.scrollLeft = sl;
}

/* ================= 彈窗 ================= */
function showSheet(html) {
  const s = $('#sheet');
  s.innerHTML = `<div class="back"></div><div class="box"><button class="x" aria-label="關閉">✕</button>${html}</div>`;
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
  const chg = q ? `${arrow(q.pct)} ${q.c >= 0 ? '+' : '−'}${fmtN(Math.abs(q.c))}（${fmtPct(q.pct)}）` : '暫無資料';
  showSheet(`
    <div class="hd"><span class="big">${isMap ? m.a : m.e}</span>
      <div><div class="nm">${isMap ? m.flag + ' ' : ''}${m.zh}</div><div class="sym">${m.s}</div></div></div>
    <div class="px">${q ? fmtN(q.p) : '--'}</div>
    <div class="chg" style="color:${col}">${chg}</div>
    ${q ? spark(q.spark, col) : ''}
    <div class="meta">${meta}</div>`);
}
function openSettings() {
  showSheet(`
    <h3>⚙️ 設定</h3>
    <button class="big-btn" data-act="color">${state.redUp ? '🔴 紅漲綠跌（點我切換）' : '🟢 綠漲紅跌（點我切換）'}</button>
    <button class="big-btn" data-act="anim">${state.anim ? '🎬 動畫：開（點我關閉）' : '⏸️ 動畫：關（點我開啟）'}</button>
    <p class="small">資料來自 Yahoo Finance，由 GitHub Actions 定時抓取，通常延遲 15 分鐘以上，僅供娛樂參考，不構成投資建議。開盤狀態按各交易所常規時段推算，遇到假日會在資料停止更新後自動變為休市。</p>`);
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
