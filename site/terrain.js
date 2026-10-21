/* 遊戲風（文明帝國式）地形：用 DEM + 衛星影像即時「畫」出卡通地形
 *
 * 每張 256×256 圖磚的處理流程：
 *   1. DEM（高度 / 海深）→ 陸海分界、海水深淺色、誇張化的山體光影
 *   2. 衛星影像（先柔化）→ 只用來判斷地貌：沙漠 / 平原 / 草原 / 森林 / 凍原 / 雪地 / 湖泊
 *   3. 依地貌套用遊戲調色盤，海岸加白色浪花、沙灘
 *   4. 山脈直接畫在地表上（岩石色 + 雪線 + 加強稜線光影），不另外貼山的圖示
 *   5. 程序化擺放手繪精靈：針葉林、闊葉林、雨林、沙丘
 * 精靈另外畫在一張四周留邊的透明圖層，跨圖磚邊界也不會被切掉。
 */
(function () {
'use strict';

const TS = 256;          // 圖磚邊長（像素）
const PAD = 26;          // 精靈圖層四周留白，讓山和樹可以超出圖磚邊界
const CACHE_MAX = 220;   // 快取圖磚數（每張約 0.6 MB）
const OCEAN_BG = '#2378b8';

const cache = new Map();
const pending = [];
let opt = null, procRaf = 0, frame = 0;
let wctx = null, sctx64 = null, sctx128 = null;

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
function rnd(a, b, c) {
  let h = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263) ^ Math.imul(c | 0, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

// 平滑的值雜訊（以全域像素座標計算，相鄰圖磚接得起來），用來做草地的深淺色塊
function vnoise(px, py, cell, seed) {
  const gx = Math.floor(px / cell), gy = Math.floor(py / cell);
  let fx = px / cell - gx, fy = py / cell - gy;
  fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
  const a = rnd(gx, gy, seed), b = rnd(gx + 1, gy, seed), c = rnd(gx, gy + 1, seed), d = rnd(gx + 1, gy + 1, seed);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}

/* ================= 調色盤 ================= */
const P = {
  desert: [238, 210, 132],
  plains: [204, 196, 98],
  grass: [138, 196, 76],
  lush: [96, 168, 62],
  forest: [66, 134, 56],
  tundra: [172, 176, 136],
  rock: [156, 140, 120],
  snow: [244, 248, 253],
  beach: [246, 228, 164],
  lake: [86, 196, 220],
  foam: [226, 252, 246]
};
// 海水依深度漸層：淺海松石綠 → 深海藍
const WATER = [[0, [126, 228, 222]], [-30, [74, 202, 216]], [-180, [46, 162, 208]], [-1500, [35, 120, 184]], [-5000, [26, 84, 158]]];
function waterColor(h, out) {
  if (h >= 0) { out[0] = WATER[0][1][0]; out[1] = WATER[0][1][1]; out[2] = WATER[0][1][2]; return; }
  for (let k = 1; k < WATER.length; k++) {
    const [d1, c1] = WATER[k], [d0, c0] = WATER[k - 1];
    if (h >= d1 || k === WATER.length - 1) {
      const t = clamp((h - d0) / (d1 - d0), 0, 1);
      out[0] = c0[0] + (c1[0] - c0[0]) * t; out[1] = c0[1] + (c1[1] - c0[1]) * t; out[2] = c0[2] + (c1[2] - c0[2]) * t;
      return;
    }
  }
}
function mixInto(o, c, t) { o[0] += (c[0] - o[0]) * t; o[1] += (c[1] - o[1]) * t; o[2] += (c[2] - o[2]) * t; }

/* ================= 手繪精靈 ================= */
const SPR = {};
function mk(w, h, fn) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.lineJoin = 'round'; g.lineCap = 'round';
  fn(g, w, h);
  return c;
}
function shadow(g, cx, cy, rx, ry) {
  g.fillStyle = 'rgba(28,40,18,.28)';
  g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); g.fill();
}
function pine(g, w, h) {
  shadow(g, w * 0.56, h * 0.93, w * 0.34, h * 0.05);
  g.fillStyle = '#6b4a2b'; g.fillRect(w * 0.45, h * 0.78, w * 0.1, h * 0.16);
  const tiers = [[0.82, 0.42, 0.44], [0.62, 0.34, 0.24], [0.42, 0.24, 0.04]];
  for (const [b, hw, tp] of tiers) {
    g.fillStyle = '#2f7240';
    g.beginPath(); g.moveTo(w * (0.5 - hw), h * b); g.lineTo(w * 0.5, h * tp); g.lineTo(w * (0.5 + hw), h * b); g.closePath(); g.fill();
    g.fillStyle = '#46934f';
    g.beginPath(); g.moveTo(w * (0.5 - hw), h * b); g.lineTo(w * 0.5, h * tp); g.lineTo(w * 0.47, h * b); g.closePath(); g.fill();
  }
  g.strokeStyle = 'rgba(20,50,25,.55)'; g.lineWidth = w * 0.04;
  g.beginPath(); g.moveTo(w * 0.08, h * 0.82); g.lineTo(w * 0.5, h * 0.04); g.lineTo(w * 0.92, h * 0.82); g.stroke();
}
function broadleaf(g, w, h, dark, light, hi) {
  shadow(g, w * 0.56, h * 0.92, w * 0.36, h * 0.06);
  g.fillStyle = '#6b4a2b'; g.fillRect(w * 0.45, h * 0.6, w * 0.1, h * 0.32);
  g.fillStyle = dark; g.beginPath(); g.arc(w * 0.5, h * 0.42, w * 0.4, 0, Math.PI * 2); g.fill();
  g.fillStyle = light; g.beginPath(); g.arc(w * 0.44, h * 0.37, w * 0.31, 0, Math.PI * 2); g.fill();
  g.fillStyle = hi; g.beginPath(); g.arc(w * 0.36, h * 0.28, w * 0.13, 0, Math.PI * 2); g.fill();
  g.strokeStyle = 'rgba(20,50,25,.5)'; g.lineWidth = w * 0.04;
  g.beginPath(); g.arc(w * 0.5, h * 0.42, w * 0.4, 0, Math.PI * 2); g.stroke();
}
function jungle(g, w, h) {
  shadow(g, w * 0.55, h * 0.9, w * 0.42, h * 0.07);
  const blobs = [[0.3, 0.55, 0.26], [0.7, 0.55, 0.26], [0.5, 0.36, 0.3]];
  for (const [x, y, r] of blobs) {
    g.fillStyle = '#226b34'; g.beginPath(); g.arc(w * x, h * y, w * r, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#34914a'; g.beginPath(); g.arc(w * (x - 0.05), h * (y - 0.05), w * r * 0.72, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#5cb85a'; g.beginPath(); g.arc(w * (x - 0.1), h * (y - 0.1), w * r * 0.28, 0, Math.PI * 2); g.fill();
  }
}
function dune(g, w, h) {
  g.fillStyle = 'rgba(190,140,70,.55)';
  g.beginPath(); g.moveTo(w * 0.05, h * 0.8); g.quadraticCurveTo(w * 0.5, h * 0.05, w * 0.95, h * 0.8);
  g.quadraticCurveTo(w * 0.55, h * 0.45, w * 0.05, h * 0.8); g.fill();
  g.strokeStyle = 'rgba(255,240,200,.9)'; g.lineWidth = h * 0.08;
  g.beginPath(); g.moveTo(w * 0.08, h * 0.78); g.quadraticCurveTo(w * 0.5, h * 0.08, w * 0.92, h * 0.78); g.stroke();
}
function buildSprites() {
  // [畫布, 錨點高度比例]（錨點 = 精靈貼在地圖上的位置）
  SPR.pine = [mk(44, 64, pine), 0.9];
  SPR.tree = [mk(48, 56, (g, w, h) => broadleaf(g, w, h, '#2f7e38', '#4aa046', '#7fcb5e')), 0.9];
  SPR.treeY = [mk(48, 56, (g, w, h) => broadleaf(g, w, h, '#6f8a2a', '#9bb43c', '#cfd86a')), 0.9];
  SPR.jungle = [mk(60, 56, jungle), 0.86];
  SPR.dune = [mk(84, 34, dune), 0.6];
}

/* ================= 圖磚載入 / 快取 ================= */
function loadImg(url, done) {
  const im = new Image();
  im.crossOrigin = 'anonymous'; // 需要讀取像素，必須走 CORS
  im.decoding = 'async';
  im.onload = done;
  im.onerror = () => { im.bad = true; done(); };
  im.src = url;
  return im;
}
function get(z, x, y, request) {
  const key = z + '/' + x + '/' + y;
  let e = cache.get(key);
  if (e) { cache.delete(key); cache.set(key, e); return e; } // LRU
  if (!request) return null;
  e = { z, x, y, ready: false, seen: frame, left: 2 };
  const done = () => { if (--e.left === 0) { pending.push(e); kick(); } };
  e.dem = loadImg(opt.dem(z, x, y), done);
  e.img = loadImg(opt.img(z, x, y), done);
  cache.set(key, e);
  if (cache.size > CACHE_MAX) {
    for (const [k, v] of cache) {
      if (cache.size <= CACHE_MAX) break;
      if (v.z <= 2) continue; // 低層級全球圖磚永遠保留，當作放大時的替身
      v.dead = true; v.base = v.spr = null;
      cache.delete(k);
    }
  }
  return e;
}
function kick() { if (!procRaf) procRaf = requestAnimationFrame(pump); }
function pump() {
  procRaf = 0;
  const t0 = performance.now();
  pending.sort((a, b) => b.seen - a.seen); // 畫面上最近需要的先處理
  let did = false;
  while (pending.length && performance.now() - t0 < 12) {
    const e = pending.shift();
    if (e.dead) continue;
    try { render(e); e.ready = true; } catch (err) { console.warn('地形圖磚處理失敗', e.z, e.x, e.y, err); e.failed = true; }
    e.dem = e.img = null;
    did = true;
  }
  if (pending.length) kick();
  if (did) opt.onUpdate();
}

/* ================= 單張圖磚的繪製 ================= */
function render(e) {
  const { z, x, y } = e;
  const N = TS * TS, zs = Math.pow(2, z);

  // ---- 1. 高度（Terrarium 編碼：R*256 + G + B/256 - 32768 公尺）----
  const Hh = new Float32Array(N);
  if (!e.dem.bad) {
    wctx.clearRect(0, 0, TS, TS);
    wctx.drawImage(e.dem, 0, 0, TS, TS);
    const d = wctx.getImageData(0, 0, TS, TS).data;
    for (let i = 0, j = 0; i < N; i++, j += 4) Hh[i] = d[j] * 256 + d[j + 1] + d[j + 2] / 256 - 32768;
  }
  // ---- 2. 影像：先縮小再放大 = 柔化，去掉道路、建築等雜訊，只留大片地貌 ----
  let I = null;
  if (!e.img.bad) {
    // 小畫布尺寸剛好等於縮小後的大小，放大時邊緣才不會取樣到透明像素（否則圖磚邊會出現亮線）
    const sc = z < 6 ? sctx128 : sctx64, s = sc.canvas.width;
    sc.clearRect(0, 0, s, s);
    sc.drawImage(e.img, 0, 0, s, s);
    wctx.clearRect(0, 0, TS, TS);
    wctx.drawImage(sc.canvas, 0, 0, TS, TS);
    I = wctx.getImageData(0, 0, TS, TS).data;
  }

  const lat = new Float32Array(TS), mpp = new Float32Array(TS);
  for (let r = 0; r < TS; r++) {
    const n = Math.PI - (2 * Math.PI * (y * TS + r + 0.5)) / (TS * zs);
    const la = Math.atan(Math.sinh(n));
    lat[r] = (la * 180) / Math.PI;
    mpp[r] = (156543.034 * Math.cos(la)) / zs;
  }
  const gradX = (i, c) => (c === 0 ? Hh[i + 1] - Hh[i] : c === TS - 1 ? Hh[i] - Hh[i - 1] : (Hh[i + 1] - Hh[i - 1]) / 2);
  const gradY = (i, r) => (r === 0 ? Hh[i + TS] - Hh[i] : r === TS - 1 ? Hh[i] - Hh[i - TS] : (Hh[i + TS] - Hh[i - TS]) / 2);

  // 光影誇張倍率（低縮放時誇張更多，否則看不出起伏）
  const ex = clamp(1.3 * Math.pow(2, (12 - z) * 0.38), 1.3, 18);

  // ---- 3. 陸海判斷 + 地貌分類 + 底色 ----
  const water = new Uint8Array(N);
  const rock = new Float32Array(N); // 0~1：山地程度（陡 + 高），用來加強稜線光影、不種樹
  const bio = new Uint8Array(N); // 0 草原 1 森林 2 沙漠 3 雪地 4 凍原 5 疏林
  const R = new Float32Array(N), G = new Float32Array(N), B = new Float32Array(N);
  const col = [0, 0, 0];
  for (let r = 0, i = 0; r < TS; r++) {
    const ar = Math.abs(lat[r]), m = mpp[r];
    for (let c = 0; c < TS; c++, i++) {
      const h = Hh[i];
      let ir = 120, ig = 150, ib = 80, L = 110, sat = 60;
      if (I) {
        ir = I[i * 4]; ig = I[i * 4 + 1]; ib = I[i * 4 + 2];
        L = (ir + ig + ib) / 3;
        sat = Math.max(ir, ig, ib) - Math.min(ir, ig, ib);
      }
      let w;
      if (!I) w = h <= 0;
      else {
        const blue = ib > ir + 8 && ib + 6 >= ig;
        if (h <= -120) w = true;
        else if (h <= 3) w = blue || L < 26;
        else {
          // 內陸湖泊：影像偏藍且地面平坦
          const sl = (Math.abs(gradX(i, c)) + Math.abs(gradY(i, r))) / m;
          w = blue && L < 125 && sl < 0.01;
        }
      }
      if (w) {
        water[i] = 1;
        if (h < 0) waterColor(h, col); else { col[0] = P.lake[0]; col[1] = P.lake[1]; col[2] = P.lake[2]; }
      } else {
        // t：0 = 乾燥（沙漠）→ 1 = 茂盛（綠地）
        const t = clamp((ig - ir + 38) / 70, 0, 1);
        if (t < 0.45) { col[0] = P.desert[0]; col[1] = P.desert[1]; col[2] = P.desert[2]; mixInto(col, P.plains, t / 0.45); }
        else if (t < 0.75) { col[0] = P.plains[0]; col[1] = P.plains[1]; col[2] = P.plains[2]; mixInto(col, P.grass, (t - 0.45) / 0.3); }
        else { col[0] = P.grass[0]; col[1] = P.grass[1]; col[2] = P.grass[2]; mixInto(col, P.lush, (t - 0.75) / 0.25); }
        // 深色植被 → 森林
        const fw = clamp((t - 0.5) * 2.5, 0, 1) * clamp((100 - L) / 45, 0, 1);
        mixInto(col, P.forest, fw);
        // 灰色、低彩度 → 凍原 / 岩地
        const gw = clamp((30 - sat) / 30, 0, 1) * clamp((L - 55) / 60, 0, 1) * (1 - fw);
        mixInto(col, ar > 45 ? P.tundra : P.rock, gw * 0.75);
        // 山地：不畫山的圖示，改用「陡峭 + 高海拔 → 岩石色」讓山脈自然長在地表上
        const gxv = gradX(i, c) / m, gyv = gradY(i, r) / m;
        const sl = Math.sqrt(gxv * gxv + gyv * gyv) * ex;
        const rk = clamp((sl - 0.22) / 0.5, 0, 1) * clamp((h - 500) / 1300, 0, 1);
        rock[i] = rk;
        mixInto(col, P.rock, rk * 0.75);
        // 雪線依緯度下降：赤道約 5200 m，45° 約 3500 m，60° 約 2200 m
        const snowline = 5200 - Math.max(0, ar - 25) * 85;
        const hs = clamp((h - snowline) / 700, 0, 1) * clamp(0.35 + rk, 0, 1);
        // 影像白色、低彩度 → 雪
        const sw = Math.max(hs, clamp((L - 172) / 45, 0, 1) * clamp((48 - sat) / 30, 0, 1));
        mixInto(col, P.snow, sw);
        bio[i] = sw > 0.5 ? 3 : fw > 0.45 ? 1 : t < 0.18 ? 2 : gw > 0.5 ? 4 : fw > 0.2 ? 5 : 0;
      }
      R[i] = col[0]; G[i] = col[1]; B[i] = col[2];
    }
  }

  // ---- 4. 海岸：附近陸地比例（可分離的方框模糊）→ 浪花 / 沙灘 ----
  const rad = z >= 5 ? 3 : 2;
  const tmp = new Float32Array(N), lb = new Float32Array(N);
  // 超出圖磚的部分沿用邊緣像素（不能當成海，否則圖磚邊會冒出一圈沙灘）
  const E = TS - 1;
  for (let r = 0; r < TS; r++) {
    let s = 0;
    const o = r * TS;
    for (let c = -rad; c <= rad; c++) s += 1 - water[o + clamp(c, 0, E)];
    for (let c = 0; c < TS; c++) {
      tmp[o + c] = s;
      s += (1 - water[o + Math.min(E, c + rad + 1)]) - (1 - water[o + Math.max(0, c - rad)]);
    }
  }
  const win = (2 * rad + 1) * (2 * rad + 1);
  for (let c = 0; c < TS; c++) {
    let s = 0;
    for (let r = -rad; r <= rad; r++) s += tmp[clamp(r, 0, E) * TS + c];
    for (let r = 0; r < TS; r++) {
      lb[r * TS + c] = s / win;
      s += tmp[Math.min(E, r + rad + 1) * TS + c] - tmp[Math.max(0, r - rad) * TS + c];
    }
  }

  // ---- 5. 光影：誇張化的山體陰影，山地的稜線再加強對比 ----
  const lx = -0.62, ly = -0.62, lz = 0.48; // 西北方的光
  const flat = lz;
  const out = new ImageData(TS, TS);
  const o = out.data;
  for (let r = 0, i = 0; r < TS; r++) {
    const m = mpp[r];
    for (let c = 0; c < TS; c++, i++) {
      let cr = R[i], cg = G[i], cb = B[i];
      const nb = (Math.imul((x * TS + c) | 0, 73856093) ^ Math.imul((y * TS + r) | 0, 19349663)) >>> 0;
      const noise = ((nb >>> 7) & 7) - 3.5;
      if (water[i]) {
        const f = clamp(lb[i] * 2.4, 0, 1); // 越靠岸越白
        cr += (P.foam[0] - cr) * f * 0.85; cg += (P.foam[1] - cg) * f * 0.85; cb += (P.foam[2] - cb) * f * 0.85;
        cr += noise * 0.6; cg += noise * 0.6; cb += noise * 0.6;
      } else {
        const wb = 1 - lb[i];
        if (z >= 6 && wb > 0.25 && Hh[i] < 30 && bio[i] !== 1 && bio[i] !== 3) {
          const f = clamp((wb - 0.25) * 2.5, 0, 1) * 0.8;
          cr += (P.beach[0] - cr) * f; cg += (P.beach[1] - cg) * f; cb += (P.beach[2] - cb) * f;
        }
        const nx = (-gradX(i, c) / m) * ex, ny = (-gradY(i, r) / m) * ex;
        const len = Math.sqrt(nx * nx + ny * ny + 1);
        const sh = (nx * lx + ny * ly + lz) / len;
        let f = 0.32 + (0.68 * sh) / flat;
        f = clamp(1 + (f - 1) * (1 + rock[i] * 0.9), 0.38, 1.45);
        if (f >= 1) {
          // 受光面：偏暖的提亮
          const k = (f - 1) * 0.9;
          cr += (255 - cr) * k; cg += (248 - cg) * k; cb += (215 - cb) * k * 0.8;
        } else {
          // 背光面：偏藍紫的陰影
          cr *= f; cg *= f; cb *= f * 0.92 + 0.1;
        }
        // 手繪感的深淺色塊（大塊 + 小塊兩層）
        const gpx = x * TS + c, gpy = y * TS + r;
        const vn = vnoise(gpx, gpy, 24, 1) * 0.62 + vnoise(gpx, gpy, 7, 2) * 0.38 - 0.5;
        const k = 1 + vn * 0.16;
        cr = cr * k + noise; cg = cg * (k + vn * 0.04) + noise; cb = cb * k + noise;
      }
      o[i * 4] = cr; o[i * 4 + 1] = cg; o[i * 4 + 2] = cb; o[i * 4 + 3] = 255;
    }
  }
  const base = document.createElement('canvas');
  base.width = base.height = TS;
  base.getContext('2d').putImageData(out, 0, 0);
  e.base = base;

  // ---- 6. 精靈擺放 ----
  const list = [];
  // 樹林
  const TC = 12;
  for (let cy = 0; cy * TC < TS; cy++) {
    for (let cx = 0; cx * TC < TS; cx++) {
      const gx = x * 22 + cx, gy = y * 22 + cy;
      const px = cx * TC + rnd(gx, gy, z + 1) * TC, py = cy * TC + rnd(gx, gy, z + 2) * TC;
      const ci = clamp(py | 0, 0, TS - 1), cj = clamp(px | 0, 0, TS - 1), i = ci * TS + cj;
      if (water[i] || lb[i] < 0.9) continue;
      if (rock[i] > 0.35) continue; // 陡峭山地不種樹
      const b = bio[i], p = rnd(gx, gy, z + 3);
      if (!(b === 1 ? p < 0.92 : b === 5 ? p < 0.35 : b === 0 ? p < 0.04 : false)) continue;
      const al = Math.abs(lat[ci]), q = rnd(gx, gy, z + 4);
      const type = al < 20 ? (q < 0.8 ? 'jungle' : 'tree') : al > 50 ? 'pine' : q < 0.45 ? 'pine' : b === 5 ? 'treeY' : 'tree';
      const size = (type === 'jungle' ? 13 : type === 'pine' ? 9 : 10.5) * (0.85 + q * 0.3);
      list.push([px, py, type, size]);
    }
  }
  // 沙丘
  const DC = 34;
  for (let cy = 0; cy * DC < TS; cy++) {
    for (let cx = 0; cx * DC < TS; cx++) {
      const gx = x * 8 + cx, gy = y * 8 + cy;
      if (rnd(gx, gy, z + 11) > 0.5) continue;
      const px = cx * DC + rnd(gx, gy, z + 12) * DC, py = cy * DC + rnd(gx, gy, z + 13) * DC;
      const ci = clamp(py | 0, 0, TS - 1), cj = clamp(px | 0, 0, TS - 1), i = ci * TS + cj;
      if (water[i] || bio[i] !== 2 || Hh[i] > 1300) continue;
      if (rock[i] > 0.2) continue;
      list.push([px, py, 'dune', 22]);
    }
  }
  list.sort((a, b) => a[1] - b[1]); // 由上往下畫，下方的精靈蓋住上方
  const sp = document.createElement('canvas');
  sp.width = sp.height = TS + PAD * 2;
  const g = sp.getContext('2d');
  for (const [u, v, type, size] of list) {
    const [img, anchor] = SPR[type];
    const w = size, h = (size * img.height) / img.width;
    g.drawImage(img, PAD + u - w / 2, PAD + v - h * anchor, w, h);
  }
  e.spr = sp;
}

/* ================= 對外介面 ================= */
function init(o) {
  opt = o;
  const wc = document.createElement('canvas');
  wc.width = wc.height = TS;
  wctx = wc.getContext('2d', { willReadFrequently: true });
  const small = (n) => {
    const c = document.createElement('canvas');
    c.width = c.height = n;
    const g = c.getContext('2d');
    g.imageSmoothingQuality = 'high';
    return g;
  };
  sctx64 = small(64); sctx128 = small(128);
  buildSprites();
  for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) get(2, x, y, true);
}

// t：d3 zoom transform；S0：k=1 時世界正方形的邊長（CSS 像素）
function draw(ctx, t, S0, W, H, dpr) {
  frame++;
  const world = S0 * t.k;
  const cv = ctx.canvas;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.fillStyle = OCEAN_BG;
  ctx.fillRect(0, 0, cv.width, cv.height);

  // 依「裝置像素」挑層級，Retina / 手機螢幕也清晰
  const zf = Math.log2((world * dpr) / TS);
  const z = clamp(Math.ceil(zf - 0.2), 0, opt.maxZ);
  const n = 1 << z, ts = world / n;
  // 東西向無限循環（像 Google 地圖）：x 不設上下限，取圖磚時再對 n 取餘數
  const x0 = Math.floor(-t.x / ts), x1 = Math.floor((W - t.x) / ts);
  const y0 = Math.max(0, Math.floor(-t.y / ts)), y1 = Math.min(n - 1, Math.floor((H - t.y) / ts));
  const sprites = [];
  for (let y = y0; y <= y1; y++) {
    const Y0 = Math.round((t.y + y * ts) * dpr), Y1 = Math.round((t.y + (y + 1) * ts) * dpr);
    for (let x = x0; x <= x1; x++) {
      const X0 = Math.round((t.x + x * ts) * dpr), X1 = Math.round((t.x + (x + 1) * ts) * dpr);
      const xi = ((x % n) + n) % n; // 繞回世界範圍內的實際圖磚編號
      const e = get(z, xi, y, true);
      e.seen = frame;
      if (e.ready) {
        ctx.drawImage(e.base, X0, Y0, X1 - X0, Y1 - Y0);
        sprites.push(e, X0, Y0, X1 - X0);
        continue;
      }
      // 還沒處理好：先用已完成的上層圖磚放大頂替
      for (let d = 1; d <= Math.min(z, 12); d++) {
        const p = get(z - d, xi >> d, y >> d, false);
        if (!p || !p.ready) continue;
        const s = TS / (1 << d);
        ctx.drawImage(p.base, (xi - ((xi >> d) << d)) * s, (y - ((y >> d) << d)) * s, s, s, X0, Y0, X1 - X0, Y1 - Y0);
        break;
      }
    }
  }
  // 精靈圖層最後畫（四周有留白，可以蓋過相鄰圖磚）
  for (let i = 0; i < sprites.length; i += 4) {
    const e = sprites[i], X0 = sprites[i + 1], Y0 = sprites[i + 2], w = sprites[i + 3];
    const s = w / TS;
    ctx.drawImage(e.spr, X0 - PAD * s, Y0 - PAD * s, (TS + PAD * 2) * s, (TS + PAD * 2) * s);
  }
}

window.Terrain = { init, draw };
})();
