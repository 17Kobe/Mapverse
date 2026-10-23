/* 上帝視角的災難（目前只在股市地圖）
   右鍵（手機長按，或右下角的按鈕）選災難，預設「下雨」；左鍵點地圖就在那裡降下災難。
   效果畫在 #fx canvas，錨定在經緯度上，會跟著地圖平移縮放；同時最多 MAX 個，舊的先消失。
   之後要讓原住民躲災難，可以用 Disasters.active() 取得目前的災難（種類、經緯度、剩餘秒數）。
   旅遊地圖之後也能共用：init 時 enabled() 改成也允許旅遊圖層即可。 */
(function () {
  'use strict';

  const TYPES = [
    { k: 'rain', icon: '🌧️', label: '下雨', dur: 6 },
    { k: 'hail', icon: '🧊', label: '冰雹', dur: 5 },
    { k: 'typhoon', icon: '🌀', label: '颱風', dur: 9 },
    { k: 'quake', icon: '💥', label: '地震', dur: 3.5 },
    { k: 'tsunami', icon: '🌊', label: '海嘯', dur: 6.5 },
    { k: 'tornado', icon: '🌪️', label: '龍捲風', dur: 8 },
    { k: 'volcano', icon: '🌋', label: '火山爆發', dur: 8 },
    { k: 'wave', icon: '💦', label: '瘋狗浪', dur: 4.5 },
    { k: 'fire', icon: '🔥', label: '森林大火', dur: 9 }
  ];
  const BY = {};
  TYPES.forEach((t) => (BY[t.k] = t));
  const MAX = 12;          // 同時存在的災難上限
  const TAU = Math.PI * 2;

  let o = null, ctx = null, list = [], raf = 0, last = 0, shaking = false;
  let cur = 'rain', menu = null, btn = null, closedAt = 0;

  // 可重現的亂數（每個災難各自一組，粒子位置固定，不會每幀亂跳）
  function rng(seed) {
    let s = seed >>> 0 || 1;
    return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
  }
  const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
  // 淡入淡出：開始 0.35 秒淡入，最後 0.9 秒淡出
  const env = (a, d) => clamp01(Math.min(a / 0.35, (d - a) / 0.9));

  /* ---------- 繪圖小工具 ---------- */
  function ell(x, y, rx, ry, fill) {
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), 0, 0, TAU);
    ctx.fill();
  }
  function dot(x, y, r, fill) {
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.arc(x, y, Math.max(0.1, r), 0, TAU);
    ctx.fill();
  }
  /* ---------- 預先畫好的圖（第一次用到才畫，之後每幀只貼圖，比較省） ---------- */
  const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  let SP = null;
  const sprites = () => SP || (SP = { storm: [11, 23, 37].map(makeStorm), volcano: makeVolcano(7) });

  // 烏雲：十幾團大小不一的雲疊成一整片（底部平、中間隆起，像積雨雲）。
  // 不幫每一團各自上明暗（那樣會像一顆顆球），而是整片一起由上往下變暗，
  // 每團只在左上加一點柔和的亮面、右下一點暗面，最後模糊，邊緣才自然。
  function makeStorm(seed) {
    const r = rng(seed), w = 360, h = 250, base = h * 0.76;
    const puffs = [];
    const row = (n, x0, x1, dy, r0, r1, jx) => {
      for (let i = 0; i < n; i++) {
        puffs.push([w * (x0 + ((x1 - x0) * i) / (n - 1)) + (r() - 0.5) * jx, base - h * (dy + r() * 0.04), w * (r0 + r() * (r1 - r0))]);
      }
    };
    row(7, 0.13, 0.87, 0.07, 0.065, 0.1, 14); // 底層：扁而平（高低稍微錯開，雲底才不會一條直線）
    row(5, 0.24, 0.76, 0.24, 0.09, 0.12, 16);  // 中層
    row(3, 0.37, 0.63, 0.38, 0.095, 0.125, 20); // 頂層：中間高起
    // 在上緣補一些小雲團，輪廓才不會太圓
    for (let i = 0; i < 20; i++) {
      const p = puffs[7 + Math.floor(r() * 8)], t = -Math.PI * (0.1 + r() * 0.8);
      const rr = p[2] * (0.32 + r() * 0.22), x = p[0] + Math.cos(t) * p[2] * 0.82, y = p[1] + Math.sin(t) * p[2] * 0.82;
      if (y - rr > 6 && x - rr > 4 && x + rr < w - 4) puffs.push([x, y, rr]);
    }
    const shape = (g) => { g.beginPath(); for (const [x, y, rr] of puffs) { g.moveTo(x + rr, y); g.arc(x, y, rr, 0, TAU); } };
    const raw = mk(w, h), g = raw.getContext('2d');
    const top = Math.min(...puffs.map((p) => p[1] - p[2]));
    const body = g.createLinearGradient(0, top, 0, base);
    body.addColorStop(0, '#e1e5ec'); body.addColorStop(0.5, '#9aa2b2'); body.addColorStop(1, '#4b5263');
    g.fillStyle = body; shape(g); g.fill();
    g.globalCompositeOperation = 'source-atop';
    for (const [x, y, rr] of puffs) {
      const hi = g.createRadialGradient(x - rr * 0.35, y - rr * 0.45, 0, x - rr * 0.2, y - rr * 0.3, rr * 0.95);
      hi.addColorStop(0, 'rgba(255,255,255,.22)'); hi.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = hi; g.fillRect(x - rr * 1.3, y - rr * 1.4, rr * 2.4, rr * 2.4);
      const lo = g.createRadialGradient(x + rr * 0.45, y + rr * 0.5, 0, x + rr * 0.45, y + rr * 0.5, rr * 0.9);
      lo.addColorStop(0, 'rgba(18,22,34,.15)'); lo.addColorStop(1, 'rgba(18,22,34,0)');
      g.fillStyle = lo; g.fillRect(x - rr * 0.5, y - rr * 0.4, rr * 1.9, rr * 1.9);
    }
    // 底部：暗灰的雲底，再慢慢變透明（範圍拉長，不要一刀切平）
    const band = g.createLinearGradient(0, base - h * 0.24, 0, base);
    band.addColorStop(0, 'rgba(40,44,56,0)'); band.addColorStop(1, 'rgba(40,44,56,.5)');
    g.fillStyle = band; g.fillRect(0, base - h * 0.24, w, h * 0.24);
    g.globalCompositeOperation = 'destination-out';
    const cut = g.createLinearGradient(0, base - 26, 0, base + 24);
    cut.addColorStop(0, 'rgba(0,0,0,0)'); cut.addColorStop(0.6, 'rgba(0,0,0,.55)'); cut.addColorStop(1, 'rgba(0,0,0,1)');
    g.fillStyle = cut; g.fillRect(0, base - 26, w, h - base + 26);
    // 先墊一層大幅模糊的薄霧，再疊上清楚一點的雲：邊緣會有自然的毛邊，不像剪紙
    const out = mk(w, h), b = out.getContext('2d');
    b.filter = 'blur(9px)'; b.globalAlpha = 0.55; b.drawImage(raw, 0, 0);
    b.filter = 'blur(2.6px)'; b.globalAlpha = 1; b.drawImage(raw, 0, 0);
    // 地上的雲影
    const sil = mk(w, h), s = sil.getContext('2d');
    s.drawImage(raw, 0, 0); s.globalCompositeOperation = 'source-in'; s.fillStyle = '#0a1424'; s.fillRect(0, 0, w, h);
    const shadow = mk(w, h), sh = shadow.getContext('2d');
    sh.filter = 'blur(10px)'; sh.drawImage(sil, 0, 0);
    // 被火光由下往上映橘的版本（火山、森林大火的煙）
    const warm = mk(w, h), wg = warm.getContext('2d');
    wg.drawImage(out, 0, 0); wg.globalCompositeOperation = 'source-atop';
    const wl = wg.createLinearGradient(0, top, 0, base);
    wl.addColorStop(0, 'rgba(255,120,40,.15)'); wl.addColorStop(1, 'rgba(255,110,30,.75)');
    wg.fillStyle = wl; wg.fillRect(0, 0, w, h);
    // 火山灰：偏棕的深灰
    const ash = mk(w, h), ag = ash.getContext('2d');
    ag.drawImage(out, 0, 0); ag.globalCompositeOperation = 'source-atop';
    ag.fillStyle = 'rgba(52,44,40,.55)'; ag.fillRect(0, 0, w, h);
    return { img: out, shadow, warm, ash, w, h, base: base / h };
  }

  // 烏雲投在地上（gy）的影子；要比雨滴先畫
  function cloudShadow(x, gy, R, e, v) {
    const sp = sprites().storm[v % 3], w = R * 2.4, hh = w * sp.h / sp.w;
    ctx.globalAlpha = 0.3 * e;
    ctx.drawImage(sp.shadow, x - w / 2 + R * 0.2, gy - hh * 0.62, w, hh * 0.7);
    ctx.globalAlpha = 1;
  }
  // 烏雲：雲底在 yb，寬約 2.5R，一開始從小長大、之後輕輕飄；v 選用哪一種外形
  function cloud(x, yb, R, a, e, v) {
    if (e <= 0) return;
    const S = sprites().storm, grow = 0.75 + 0.25 * clamp01(a / 0.8);
    const drift = Math.sin(a * 0.7 + v) * R * 0.05;
    // 後面一片小一點、偏右上，看起來比較有厚度
    for (const [k, sc, ox, oy, al] of [[v + 1, 0.78, 0.45, -0.22, 0.85], [v, 1, 0, 0, 1]]) {
      const sp = S[k % 3], w = R * 2.5 * sc * grow, hh = w * sp.h / sp.w;
      ctx.globalAlpha = al * e;
      ctx.drawImage(sp.img, x + drift * sc + ox * R - w / 2, yb + oy * R - hh * sp.base, w, hh);
    }
    ctx.globalAlpha = 1;
  }
  // 閃電：從雲底劈到地面的鋸齒線，同時雲裡亮一下
  function lightning(x, yb, gy, R, seed, e) {
    const r = rng(seed);
    const pts = [[x + (r() - 0.5) * R * 0.6, yb]];
    const n = 7;
    for (let i = 1; i <= n; i++) pts.push([pts[i - 1][0] + (r() - 0.5) * R * 0.28, yb + ((gy - yb) * i) / n]);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    for (const [lw, col] of [[R * 0.09, `rgba(170,200,255,${0.35 * e})`], [R * 0.025 + 1, `rgba(255,255,240,${e})`]]) {
      ctx.lineWidth = lw; ctx.strokeStyle = col;
      ctx.beginPath(); pts.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py))); ctx.stroke();
    }
    const g = ctx.createRadialGradient(pts[0][0], yb - R * 0.2, 0, pts[0][0], yb - R * 0.2, R * 1.2);
    g.addColorStop(0, `rgba(230,236,255,${0.45 * e})`); g.addColorStop(1, 'rgba(230,236,255,0)');
    ctx.globalCompositeOperation = 'lighter';
    dot(pts[0][0], yb - R * 0.2, R * 1.2, g);
    ctx.globalCompositeOperation = 'source-over';
  }

  // 火山：照地形圖的光源（左上）畫，左坡亮、右坡暗，有一條條沖蝕溝；
  // 山腳漸漸變透明，像從地面隆起，不會是一塊貼上去的三角形
  function makeVolcano(seed) {
    const r = rng(seed), w = 320, h = 210, cx = w / 2, base = h * 0.8, peak = h * 0.3, cw = w * 0.075, foot = w * 0.47;
    // 山的輪廓：火山是下緩上陡的凹形坡，邊緣帶一點凹凸
    const side = (dir) => {
      const pts = [];
      for (let i = 0; i <= 24; i++) {
        const u = i / 24, hx = cw + (foot - cw) * u;
        const y = peak + (base - peak) * Math.pow(u, 0.55) + (i && i < 24 ? (r() - 0.5) * 3.5 : 0);
        pts.push([cx + dir * hx, y]);
      }
      return pts;
    };
    const L = side(-1), Rr = side(1);
    const raw = mk(w, h), g = raw.getContext('2d');
    g.beginPath();
    Rr.slice().reverse().forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
    L.forEach(([x, y]) => g.lineTo(x, y)); // 右坡由下往上 → 跨過火口 → 左坡由上往下
    g.lineTo(cx - foot, h); g.lineTo(cx + foot, h); // 山腳往下收口（下面會漸漸變透明）
    g.closePath();
    g.save(); g.clip();
    const lit = g.createLinearGradient(cx - foot, 0, cx + foot, 0);
    lit.addColorStop(0, '#8d7a60'); lit.addColorStop(0.42, '#7a6650'); lit.addColorStop(0.58, '#5a4a3c'); lit.addColorStop(1, '#382c24');
    g.fillStyle = lit; g.fillRect(0, 0, w, h);
    // 越往上越是灰黑的火山灰與熔岩岩，山腳偏綠褐，和地面接起來
    const vt = g.createLinearGradient(0, peak, 0, base);
    vt.addColorStop(0, 'rgba(40,34,32,.55)'); vt.addColorStop(0.45, 'rgba(60,50,42,.15)'); vt.addColorStop(1, 'rgba(92,104,58,.45)');
    g.fillStyle = vt; g.fillRect(0, 0, w, h);
    // 沖蝕溝：從火口往山腳放射，暗線旁邊配一條亮線（左上光）
    const gullies = [];
    for (let i = 0; i < 11; i++) {
      const s = -0.92 + (1.84 * i) / 10 + (r() - 0.5) * 0.08, pts = [];
      for (let j = 0; j <= 10; j++) {
        const u = j / 10, hx = (cw * 0.9 + (foot * 0.92 - cw) * u) * s;
        pts.push([cx + hx + (r() - 0.5) * 2.5, peak + 4 + (base - peak) * Math.pow(u, 0.55) * (0.94 - Math.abs(s) * 0.12)]);
      }
      gullies.push(pts);
      const stroke = (dx, col, lw) => {
        g.strokeStyle = col; g.lineWidth = lw; g.beginPath();
        pts.forEach(([x, y], j) => (j ? g.lineTo(x + dx, y) : g.moveTo(x + dx, y))); g.stroke();
      };
      stroke(1.4, 'rgba(24,16,12,.4)', 2);
      stroke(-0.8, 'rgba(255,236,206,.14)', 1.2);
    }
    // 火口
    g.fillStyle = '#2a1c16';
    g.beginPath(); g.ellipse(cx, peak + 2, cw * 0.95, cw * 0.32, 0, 0, TAU); g.fill();
    g.restore();
    // 山腳由下往上漸漸透明，融進底下的地形
    g.globalCompositeOperation = 'destination-out';
    const cut = g.createLinearGradient(0, base - (base - peak) * 0.4, 0, base + 6);
    cut.addColorStop(0, 'rgba(0,0,0,0)'); cut.addColorStop(1, 'rgba(0,0,0,1)');
    g.fillStyle = cut; g.fillRect(0, peak, w, h);
    const img = mk(w, h), b = img.getContext('2d');
    b.filter = 'blur(0.8px)'; b.drawImage(raw, 0, 0);
    // 熔岩沿著幾條溝流下（取左右各幾條）
    const flows = [gullies[3], gullies[6], gullies[8]];
    return { img, w, h, cx: cx / w, peak: peak / h, base: base / h, cw: cw / w, flows };
  }
  // 往上翻滾、越來越大越淡的灰煙（用烏雲圖當煙團，比圓點自然）
  function smoke(list, x, y, R, a, e, life, warm) {
    const S = sprites().storm;
    for (const s of list) {
      const ts = a - s.t0;
      if (ts < 0 || ts > life) continue;
      const k = ts / life, sz = R * (0.5 + k * 1.15) * s.s, sp = S[s.v % 3];
      const px = x + s.dx * R + ts * R * 0.16, py = y - ts * R * 0.38 - ts * ts * R * 0.03;
      ctx.globalAlpha = Math.pow(1 - k, 1.2) * 0.9 * e;
      ctx.drawImage(warm ? sp.ash : sp.img, px - sz / 2, py - sz * (sp.h / sp.w) * 0.6, sz, sz * (sp.h / sp.w));
      // 剛冒出來的煙團被底下的火光映紅
      if (warm && k < 0.4) {
        ctx.globalAlpha = (1 - k / 0.4) * 0.8 * e;
        ctx.drawImage(sp.warm, px - sz / 2, py - sz * (sp.h / sp.w) * 0.6, sz, sz * (sp.h / sp.w));
      }
    }
    ctx.globalAlpha = 1;
  }
  // 火焰：外層橘紅、內層黃色的水滴形
  function tear(x, y, w, h) {
    ctx.beginPath();
    ctx.moveTo(x, y - h);
    ctx.bezierCurveTo(x + w * 0.35, y - h * 0.55, x + w, y - h * 0.3, x + w * 0.55, y - h * 0.05);
    ctx.quadraticCurveTo(x, y + h * 0.12, x - w * 0.55, y - h * 0.05);
    ctx.bezierCurveTo(x - w, y - h * 0.3, x - w * 0.35, y - h * 0.55, x, y - h);
    ctx.fill();
  }
  function flame(x, y, w, h, a) {
    ctx.fillStyle = `rgba(232,66,18,${0.85 * a})`; tear(x, y, w, h);
    ctx.fillStyle = `rgba(255,188,56,${0.95 * a})`; tear(x, y, w * 0.55, h * 0.62);
  }

  /* ---------- 各種災難：make 產生粒子（只做一次），draw 每幀畫 ---------- */
  // x, y：點擊處的螢幕座標；R：依縮放算出的大小；a：經過秒數；e：淡入淡出 0～1
  const FX = {
    rain: {
      make: (r) => Array.from({ length: 70 }, () => ({ x: r() * 2 - 1, ph: r(), g: 0.22 + r() * 0.2, v: 1.5 + r() * 0.8 })),
      draw(f, x, y, R, a, e) {
        const top = y - R * 0.8;
        ell(x, y + R * 0.3, R * 0.9, R * 0.3, `rgba(10,30,60,${0.2 * e})`); // 雨淋濕的地面
        cloudShadow(x, y + R * 0.3, R, e, f.v);
        ctx.lineCap = 'round';
        ctx.strokeStyle = `rgba(190,222,255,${0.85 * e})`;
        ctx.lineWidth = Math.max(1, R / 42);
        ctx.beginPath();
        for (const d of f.p) {
          const t = (a * d.v + d.ph) % 1, gy = y + R * d.g, len = R * 0.13;
          const px = x + d.x * R * 0.85 - t * R * 0.12, py = top + t * (gy - top);
          ctx.moveTo(px + len * 0.15, py - len); ctx.lineTo(px, py);
        }
        ctx.stroke();
        // 落地的水花
        ctx.strokeStyle = `rgba(225,242,255,${0.6 * e})`;
        ctx.lineWidth = Math.max(0.8, R / 64);
        ctx.beginPath();
        for (const d of f.p) {
          const t = (a * d.v + d.ph) % 1;
          if (t < 0.88) continue;
          const s = (t - 0.88) / 0.12, px = x + d.x * R * 0.85 - R * 0.12, py = y + R * d.g, rx = Math.max(0.1, R * 0.07 * s);
          ctx.moveTo(px + rx, py); ctx.ellipse(px, py, rx, rx * 0.35, 0, 0, TAU);
        }
        ctx.stroke();
        // 雷雨：偶爾劈一道閃電（每道亮 0.16 秒）
        for (const t0 of [1.3 + (f.v % 5) * 0.15, 3.4 + (f.v % 3) * 0.3]) {
          const ft = a - t0;
          if (ft > 0 && ft < 0.16) lightning(x, top + R * 0.05, y + R * 0.25, R, f.v + Math.round(t0 * 10), (1 - ft / 0.16) * e);
        }
        cloud(x, top, R, a, e, f.v);
      }
    },

    hail: {
      make: (r) => Array.from({ length: 46 }, () => ({ x: r() * 2 - 1, ph: r(), g: 0.2 + r() * 0.22, v: 1.9 + r(), s: 0.55 + r() * 0.6 })),
      draw(f, x, y, R, a, e) {
        const top = y - R * 0.8;
        cloudShadow(x, y + R * 0.3, R, e, f.v);
        // 地上越積越多的冰珠
        const pile = clamp01(a / f.dur * 1.6);
        f.p.forEach((d, i) => {
          if (i / f.p.length > pile) return;
          dot(x + d.x * R * 0.8 - R * 0.1, y + R * d.g, R * 0.02 * d.s, `rgba(240,248,255,${0.8 * e})`);
        });
        for (const d of f.p) {
          const t = (a * d.v + d.ph) % 1, gy = y + R * d.g;
          let py;
          if (t < 0.82) py = top + (t / 0.82) * (gy - top);
          else py = gy - Math.sin(((t - 0.82) / 0.18) * Math.PI) * R * 0.09; // 落地彈一下
          const px = x + d.x * R * 0.8 - Math.min(t, 0.82) * R * 0.12;
          const hr = R * 0.028 * d.s;
          dot(px, py, hr * 1.25, `rgba(120,160,205,${0.8 * e})`); // 冰珠的藍灰外圈
          dot(px - hr * 0.15, py - hr * 0.15, hr, `rgba(255,255,255,${0.95 * e})`);
        }
        cloud(x, top, R, a, e, f.v);
      }
    },

    typhoon: {
      draw(f, x, y, R, a, e) {
        const RR = R * 1.5, spin = f.lat >= 0 ? -1 : 1; // 北半球逆時針、南半球順時針
        const cx = x - a * R * 0.06, cy = y - a * R * 0.04, rot = spin * a * 1.7;
        const g = ctx.createRadialGradient(cx, cy, RR * 0.05, cx, cy, RR);
        g.addColorStop(0, 'rgba(255,255,255,0)');
        g.addColorStop(0.14, `rgba(255,255,255,${0.75 * e})`);
        g.addColorStop(0.55, `rgba(232,238,248,${0.4 * e})`);
        g.addColorStop(1, 'rgba(232,238,248,0)');
        dot(cx, cy, RR, g);
        ctx.lineCap = 'round';
        for (const [lw, col] of [[R * 0.2, `rgba(240,245,252,${0.55 * e})`], [R * 0.07, `rgba(255,255,255,${0.85 * e})`]]) {
          ctx.lineWidth = lw; ctx.strokeStyle = col;
          for (let arm = 0; arm < 3; arm++) {
            ctx.beginPath();
            for (let i = 0; i <= 36; i++) {
              const th = (i / 36) * Math.PI * 2.4;
              const rr = RR * 0.1 * Math.exp(0.24 * th);
              const ang = spin * -th + arm * (TAU / 3) + rot;
              const px = cx + Math.cos(ang) * rr, py = cy + Math.sin(ang) * rr * 0.85;
              if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
            }
            ctx.stroke();
          }
        }
        dot(cx, cy, RR * 0.07, `rgba(20,62,112,${0.6 * e})`); // 颱風眼
      }
    },

    quake: {
      make(r) {
        // 往外裂開的地縫
        return Array.from({ length: 6 }, (_, i) => {
          let ang = (i / 6) * TAU + r() * 0.7, px = 0, py = 0;
          const pts = [[0, 0]];
          for (let j = 0; j < 6; j++) {
            ang += (r() - 0.5) * 0.9;
            const step = 0.12 + r() * 0.1;
            px += Math.cos(ang) * step; py += Math.sin(ang) * step * 0.6;
            pts.push([px, py]);
          }
          return pts;
        });
      },
      draw(f, x, y, R, a, e) {
        // 一圈圈擴散的震波（壓扁成橢圓，像從斜上方看地面）
        for (let i = 0; i < 4; i++) {
          const t = a * 1.1 - i * 0.32;
          if (t <= 0 || t >= 1) continue;
          const rad = R * (0.15 + t * 1.6);
          ctx.strokeStyle = `rgba(255,186,84,${(1 - t) * 0.85 * e})`;
          ctx.lineWidth = R * 0.05 * (1 - t) + 1;
          ctx.beginPath(); ctx.ellipse(x, y, rad, rad * 0.6, 0, 0, TAU); ctx.stroke();
        }
        const grow = clamp01(a / 0.7);
        ctx.lineJoin = 'round'; ctx.lineCap = 'round';
        for (const [lw, col] of [[R * 0.045, `rgba(38,20,6,${0.85 * e})`], [R * 0.016, `rgba(255,120,40,${0.7 * e})`]]) {
          ctx.lineWidth = Math.max(0.8, lw); ctx.strokeStyle = col;
          for (const pts of f.p) {
            const n = Math.max(1, Math.round(grow * (pts.length - 1)));
            ctx.beginPath(); ctx.moveTo(x, y);
            for (let j = 1; j <= n; j++) ctx.lineTo(x + pts[j][0] * R, y + pts[j][1] * R);
            ctx.stroke();
          }
        }
        // 揚起的塵土
        for (let i = 0; i < 7; i++) {
          const ang = i * 0.9 + 0.4, t = clamp01(a / f.dur);
          dot(x + Math.cos(ang) * R * (0.25 + t * 0.4), y + Math.sin(ang) * R * 0.2 - t * R * 0.15, R * (0.08 + t * 0.12), `rgba(150,118,80,${(1 - t) * 0.45 * e})`);
        }
      }
    },

    tsunami: {
      draw(f, x, y, R, a, e) {
        // 一開始海床隆起的深色水團
        dot(x, y, R * 0.5, `rgba(14,58,110,${clamp01(1 - a / 1.6) * 0.5 * e})`);
        for (let i = 0; i < 5; i++) {
          const t = (a / f.dur) * 1.15 - i * 0.12;
          if (t <= 0 || t >= 1) continue;
          const rad = R * (0.15 + t * 2.4), al = (1 - t) * e;
          ctx.lineWidth = R * 0.22 * (1 - t * 0.6);
          ctx.strokeStyle = `rgba(26,104,186,${0.55 * al})`;
          ctx.beginPath(); ctx.ellipse(x, y, rad, rad * 0.7, 0, 0, TAU); ctx.stroke();
          const fr = Math.max(0.1, rad - R * 0.07);
          ctx.lineWidth = R * 0.06 * (1 - t * 0.5);
          ctx.strokeStyle = `rgba(240,250,255,${0.9 * al})`; // 浪頭的白色浪花
          ctx.beginPath(); ctx.ellipse(x, y, fr, fr * 0.7, 0, 0, TAU); ctx.stroke();
        }
      }
    },

    tornado: {
      make: (r) => ({
        ph: r() * 6,
        debris: Array.from({ length: 26 }, () => ({ ang: r() * TAU, h: r(), sp: 3 + r() * 3, s: 0.5 + r() * 0.8 }))
      }),
      draw(f, x, y, R, a, e) {
        // 龍捲風會四處亂竄
        const bx = x + Math.sin(a * 0.8 + f.p.ph) * R * 0.35 + a * R * 0.06, by = y + Math.sin(a * 0.55) * R * 0.12;
        const Hh = R * 1.7, n = 18;
        ell(bx, by, R * 0.45, R * 0.15, `rgba(122,96,60,${0.35 * e})`);
        for (let i = 0; i <= n; i++) {
          const t = i / n, w = R * (0.05 + 0.5 * t * t), sway = Math.sin(a * 2.2 + t * 3) * R * 0.15 * t;
          const c = Math.round(105 + 45 * t);
          ell(bx + sway, by - t * Hh, w, w * 0.32, `rgba(${c},${c},${c + 8},${(0.3 + 0.25 * (1 - t)) * e})`);
        }
        // 旋轉的氣流線
        ctx.strokeStyle = `rgba(235,235,240,${0.5 * e})`;
        ctx.lineWidth = Math.max(0.8, R / 50);
        for (let j = 1; j < 7; j++) {
          const t = j / 7, w = R * (0.05 + 0.5 * t * t), sway = Math.sin(a * 2.2 + t * 3) * R * 0.15 * t, st = a * 9 + j;
          ctx.beginPath(); ctx.ellipse(bx + sway, by - t * Hh, w, w * 0.32, 0, st, st + 2.2); ctx.stroke();
        }
        // 被捲起來的碎片
        ctx.fillStyle = `rgba(70,48,26,${0.85 * e})`;
        for (const d of f.p.debris) {
          const ang = d.ang + a * d.sp, hh = d.h * Hh * 0.6, tt = d.h * 0.6;
          const rr = R * (0.08 + 0.5 * tt * tt) + R * 0.08, s = R * 0.03 * d.s;
          ctx.fillRect(bx + Math.cos(ang) * rr - s / 2, by - hh + Math.sin(ang) * rr * 0.3 - s / 2, s, s);
        }
        cloud(bx, by - Hh + R * 0.12, R * 1.05, a, e, f.v);
      }
    },

    volcano: {
      make: (r, dur) => ({
        lava: Array.from({ length: 60 }, () => ({ t0: 0.9 + r() * (dur - 3), vx: (r() - 0.5) * 1.5, vy: 1.4 + r() * 1.2, s: 0.6 + r() * 0.8 })),
        ash: Array.from({ length: 34 }, (_, i) => ({ t0: 0.5 + (i / 34) * (dur - 2.4) + r() * 0.15, dx: (r() - 0.5) * 0.25, s: 0.75 + r() * 0.5, v: Math.floor(r() * 3) }))
      }),
      draw(f, x, y, R, a, e) {
        const V = sprites().volcano, w = R * 2.5, hh = w * V.h / V.w;
        // 從地面慢慢隆起（前 1.2 秒）
        const rise = 1 - Math.pow(1 - clamp01(a / 1.2), 3), hv = hh * (0.35 + 0.65 * rise);
        const left = x - w * V.cx, topY = y + R * 0.15 - hv * V.base; // 山腳約在點擊處下方
        const sx = (u) => left + u * V.w * (w / V.w), sy = (v) => topY + v * V.h * (hv / V.h);
        const cx = x, cy = sy(V.peak), heat = clamp01((a - 0.5) / 0.8) * e;
        // 山腳一圈被火山灰染暗的地面（柔和的漸層，不是硬邊）
        const gr = ctx.createRadialGradient(x, y + R * 0.1, 0, x, y + R * 0.1, R * 1.25);
        gr.addColorStop(0, `rgba(36,26,20,${0.42 * e})`); gr.addColorStop(1, 'rgba(36,26,20,0)');
        ctx.save(); ctx.translate(x, y + R * 0.1); ctx.scale(1, 0.55); ctx.translate(-x, -(y + R * 0.1));
        dot(x, y + R * 0.1, R * 1.25, gr);
        ctx.restore();
        ctx.globalAlpha = e;
        ctx.drawImage(V.img, left, topY, w, hv);
        ctx.globalAlpha = 1;
        // 熔岩沿著沖蝕溝流下：外面一層發光、裡面亮黃
        const grow = clamp01((a - 1) / 3.5);
        if (grow > 0) {
          ctx.lineCap = 'round'; ctx.lineJoin = 'round';
          ctx.globalCompositeOperation = 'lighter';
          for (const [lw, col] of [[R * 0.06, `rgba(255,70,10,${0.28 * heat})`], [R * 0.018 + 0.5, `rgba(255,160,50,${0.75 * heat})`]]) {
            ctx.lineWidth = lw; ctx.strokeStyle = col;
            V.flows.forEach((pts, i) => {
              const n = Math.max(1, Math.round(grow * (0.55 + 0.45 * ((i * 7) % 4) / 3) * (pts.length - 1)));
              ctx.beginPath();
              for (let j = 0; j <= n; j++) {
                const px = sx(pts[j][0] / V.w), py = sy(pts[j][1] / V.h);
                if (j) ctx.lineTo(px, py); else ctx.moveTo(px, py);
              }
              ctx.stroke();
            });
          }
          ctx.globalCompositeOperation = 'source-over';
        }
        // 火口的火光（會閃爍）
        const fl = 0.8 + 0.2 * Math.sin(a * 13) * Math.sin(a * 5.3);
        const cg = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 0.55);
        cg.addColorStop(0, `rgba(255,190,70,${0.9 * heat * fl})`); cg.addColorStop(0.3, `rgba(255,90,20,${0.45 * heat * fl})`); cg.addColorStop(1, 'rgba(255,90,20,0)');
        ctx.globalCompositeOperation = 'lighter';
        dot(cx, cy, R * 0.55, cg);
        ctx.globalCompositeOperation = 'source-over';
        ell(cx, cy, w * V.cw * 0.8, w * V.cw * 0.26, `rgba(255,214,110,${heat})`);
        // 往上翻滾的火山灰柱，底部被火光映橘
        smoke(f.p.ash, cx, cy - R * 0.08, R * 0.9, a, e, 3.6, true);
        // 噴出的熔岩彈：拋物線落下，拖一小段光
        ctx.globalCompositeOperation = 'lighter';
        for (const p of f.p.lava) {
          const tp = a - p.t0;
          if (tp < 0 || tp > 2.2) continue;
          const pos = (t) => [cx + p.vx * R * t * 0.6, cy - (p.vy * t - 1.1 * t * t) * R * 0.9];
          const [px, py] = pos(tp), [qx, qy] = pos(Math.max(0, tp - 0.08));
          if (py > y + R * 0.3) continue;
          ctx.strokeStyle = `rgba(255,120,30,${0.6 * e})`; ctx.lineWidth = R * 0.03 * p.s;
          ctx.beginPath(); ctx.moveTo(qx, qy); ctx.lineTo(px, py); ctx.stroke();
          dot(px, py, R * 0.028 * p.s, `rgba(255,${Math.round(150 + p.s * 60)},60,${e})`);
        }
        ctx.globalCompositeOperation = 'source-over';
      }
    },

    wave: {
      make: (r) => ({
        dir: r() * TAU,
        spray: Array.from({ length: 30 }, () => ({ o: r() * 2 - 1, v: 0.4 + r() * 0.6, s: 0.5 + r() * 0.8 }))
      }),
      draw(f, x, y, R, a, e) {
        const p = clamp01(a / f.dur), dx = Math.cos(f.p.dir), dy = Math.sin(f.p.dir) * 0.7;
        const px = -Math.sin(f.p.dir), py = Math.cos(f.p.dir) * 0.7; // 浪頭的走向（和前進方向垂直）
        const go = (-1 + p * 2) * R, h = Math.sin(p * Math.PI);
        const at = (s, fwd) => [x + dx * (go + fwd) + px * s * R * 1.1 + dx * (1 - s * s) * R * 0.25,
                                y + dy * (go + fwd) + py * s * R * 1.1 + dy * (1 - s * s) * R * 0.25];
        const line = (fwd) => {
          ctx.beginPath();
          for (let i = 0; i <= 24; i++) {
            const [qx, qy] = at(-1 + (i / 12), fwd);
            if (i) ctx.lineTo(qx, qy); else ctx.moveTo(qx, qy);
          }
          ctx.stroke();
        };
        ctx.lineCap = 'round';
        ctx.lineWidth = R * 0.3 * h + 2; ctx.strokeStyle = `rgba(20,86,160,${0.6 * e})`; line(-R * 0.1);
        ctx.lineWidth = R * 0.16 * h + 1.5; ctx.strokeStyle = `rgba(70,160,220,${0.75 * e})`; line(0);
        ctx.lineWidth = R * 0.06 * h + 1; ctx.strokeStyle = `rgba(245,252,255,${0.95 * e})`; line(R * 0.06);
        // 打上岸時噴起的浪花
        if (p > 0.55) {
          const t = (p - 0.55) / 0.45;
          for (const s of f.p.spray) {
            const [qx, qy] = at(s.o, R * 0.08);
            dot(qx + dx * t * R * 0.3 * s.v, qy - Math.sin(t * Math.PI) * R * 0.45 * s.v, R * 0.03 * s.s, `rgba(255,255,255,${(1 - t) * 0.9 * e})`);
          }
        }
      }
    },

    fire: {
      make(r, dur) {
        const flames = Array.from({ length: 90 }, () => {
          const d = Math.sqrt(r()), ang = r() * TAU;
          return { x: Math.cos(ang) * d, y: Math.sin(ang) * d, d, ph: r() * 6, s: 0.6 + r() * 0.7 };
        }).sort((p, q) => p.y - q.y); // 後面的先畫
        return { flames, smoke: Array.from({ length: 16 }, () => ({ t0: r() * (dur - 2), dx: (r() - 0.5) * 1.1, s: 0.6 + r() * 0.5, v: Math.floor(r() * 3) })) };
      },
      draw(f, x, y, R, a, e) {
        const rf = 0.25 + 0.75 * clamp01(a / (f.dur * 0.6)); // 火線慢慢往外燒
        ell(x, y, R * rf * 1.05, R * rf * 0.62, `rgba(30,14,4,${0.45 * e})`); // 燒焦的地面
        const g = ctx.createRadialGradient(x, y, 0, x, y, R * rf * 1.3);
        g.addColorStop(0, `rgba(255,120,30,${0.35 * e})`); g.addColorStop(1, 'rgba(255,120,30,0)');
        dot(x, y, R * rf * 1.3, g);
        for (const fl of f.p.flames) {
          if (fl.d > rf) continue;
          const edge = 0.6 + 0.6 * (fl.d / rf); // 火線前緣燒得比較旺
          const h = R * 0.2 * fl.s * edge * (0.75 + 0.25 * Math.sin(a * 9 + fl.ph));
          flame(x + fl.x * R, y + fl.y * R * 0.6, h * 0.36, h, e);
        }
        smoke(f.p.smoke, x, y - R * 0.2, R * 0.7, a, e * 0.8, 3.2, true);
      }
    }
  };

  /* ---------- 主迴圈：有災難時才跑 ---------- */
  function shake(amp) {
    if (amp > 0.2) {
      shaking = true;
      const dx = (Math.random() * 2 - 1) * amp, dy = (Math.random() * 2 - 1) * amp * 0.6;
      for (const el of o.shakeEls) if (el) el.style.transform = `translate(${dx.toFixed(1)}px,${dy.toFixed(1)}px)`;
    } else if (shaking) {
      shaking = false;
      for (const el of o.shakeEls) if (el) el.style.transform = '';
    }
  }
  function frame(now) {
    raf = 0;
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    const [W, H, dpr] = o.size(), cv = ctx.canvas;
    const cw = Math.round(W * dpr), ch = Math.round(H * dpr);
    if (cv.width !== cw || cv.height !== ch) { cv.width = cw; cv.height = ch; }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, cv.width, cv.height);
    let amp = 0;
    if (!o.enabled()) list = [];
    for (const f of list) f.a += dt;
    list = list.filter((f) => f.a < f.dur);
    if (list.length) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const R = 46 * Math.min(5, Math.max(1, Math.pow(o.zoom(), 0.55)));
      const ww = o.worldW(), pad = R * 3;
      for (const f of list) {
        if (f.k === 'quake' && !o.reduce()) amp = Math.max(amp, (1 - f.a / f.dur) * 7);
        const [x0, y] = o.toScreen(f.lon, f.lat);
        if (y < -pad || y > H + pad) continue;
        const e = env(f.a, f.dur);
        // 世界東西向循環：畫面上可能同時看到同一個地點的兩份
        for (const x of [x0 - ww, x0, x0 + ww]) {
          if (x < -pad || x > W + pad) continue;
          ctx.save();
          try { FX[f.k].draw(f, x, y, R, f.a, e); } catch (err) { console.error(err); f.a = f.dur; }
          ctx.restore();
        }
      }
    }
    shake(amp);
    if (list.length) raf = requestAnimationFrame(frame);
  }

  function trigger(k, lon, lat) {
    const T = BY[k];
    if (!T || !o) return null;
    const r = rng((Math.random() * 4294967296) >>> 0);
    const f = { k, lon, lat, a: 0, dur: T.dur, v: Math.floor(r() * 1e6), p: FX[k].make ? FX[k].make(r, T.dur) : null };
    list.push(f);
    if (list.length > MAX) list.shift();
    if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); }
    return f;
  }

  /* ---------- 選單（右鍵 / 長按 / 右下角按鈕） ---------- */
  function select(k, announce) {
    if (!BY[k]) k = 'rain';
    cur = k;
    try { localStorage.setItem('disaster', JSON.stringify(k)); } catch (e) {}
    const T = BY[k];
    btn.innerHTML = `<span class="dz-i" aria-hidden="true">${T.icon}</span><span class="dz-l">${T.label}</span><span class="dz-c" aria-hidden="true">▾</span>`;
    btn.setAttribute('aria-label', `目前災難：${T.label}，按一下更換`);
    menu.querySelectorAll('.dz-it').forEach((b) => {
      const on = b.dataset.k === k;
      b.classList.toggle('on', on);
      b.setAttribute('aria-checked', on);
    });
    if (announce && o.toast) o.toast(`${T.icon} 已選「${T.label}」，點地圖降下災難`);
  }
  function open(clientX, clientY, fromBtn) {
    if (!o || !o.enabled()) return;
    menu.hidden = false;
    btn.setAttribute('aria-expanded', 'true');
    const sr = o.stage.getBoundingClientRect(), mw = menu.offsetWidth, mh = menu.offsetHeight;
    let x = clientX - sr.left, y = clientY - sr.top;
    if (fromBtn) { x -= mw; y -= mh + 8; }
    x = Math.max(6, Math.min(sr.width - mw - 6, x));
    y = Math.max(6, Math.min(sr.height - mh - 6, y));
    menu.style.left = x + 'px';
    menu.style.top = y + 'px';
    (menu.querySelector('.dz-it.on') || menu.querySelector('.dz-it')).focus({ preventScroll: true });
  }
  function close() {
    if (!menu || menu.hidden) return;
    menu.hidden = true;
    btn.setAttribute('aria-expanded', 'false');
    closedAt = performance.now();
  }
  function buildUi() {
    btn = document.createElement('button');
    btn.id = 'dzBtn';
    btn.type = 'button';
    btn.className = 'gbtn';
    btn.setAttribute('aria-haspopup', 'menu');
    btn.setAttribute('aria-expanded', 'false');
    btn.title = '選擇災難（也可以在地圖上按右鍵）';
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!menu.hidden) { close(); return; }
      const r = btn.getBoundingClientRect();
      open(r.right, r.top, true);
    });
    menu = document.createElement('div');
    menu.id = 'dzMenu';
    menu.className = 'gpanel';
    menu.setAttribute('role', 'menu');
    menu.setAttribute('aria-label', '選擇災難');
    menu.hidden = true;
    menu.innerHTML = '<div class="dz-h">⚡ 上帝之手<small>選好後，點地圖降下災難</small></div>' +
      TYPES.map((t) => `<button type="button" role="menuitemradio" class="dz-it" data-k="${t.k}"><span class="dz-i" aria-hidden="true">${t.icon}</span>${t.label}</button>`).join('');
    menu.addEventListener('click', (e) => {
      const b = e.target.closest('.dz-it');
      if (!b) return;
      select(b.dataset.k, true);
      close();
      btn.focus({ preventScroll: true });
    });
    menu.addEventListener('contextmenu', (e) => e.preventDefault());
    // 方向鍵在選項間移動
    menu.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
      e.preventDefault();
      const items = [...menu.querySelectorAll('.dz-it')], i = items.indexOf(document.activeElement);
      items[(i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length].focus();
    });
    // 點選單外面就關掉（這一下不會觸發災難）
    document.addEventListener('pointerdown', (e) => {
      if (!menu.hidden && !menu.contains(e.target) && !btn.contains(e.target)) close();
    }, true);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !menu.hidden) { e.stopPropagation(); close(); btn.focus({ preventScroll: true }); }
    }, true);
    o.stage.appendChild(btn);
    o.stage.appendChild(menu);
    let saved = 'rain';
    try { saved = JSON.parse(localStorage.getItem('disaster')) || 'rain'; } catch (e) {}
    select(saved, false);
  }

  window.Disasters = {
    TYPES,
    /* opts: stage、canvas、shakeEls（地震時一起搖的元素）、enabled()、toScreen(lon, lat)、toGeo(x, y)、
             zoom()、worldW()（世界一圈的螢幕寬度）、size() → [W, H, dpr]、reduce()（減少動態）、toast(msg) */
    init(opts) {
      o = opts;
      ctx = o.canvas.getContext('2d');
      buildUi();
    },
    get current() { return cur; },
    trigger,
    // 地圖上的左鍵：剛關掉選單的那一下不算
    handleClick(clientX, clientY) {
      if (!o || !o.enabled() || performance.now() - closedAt < 350) return false;
      const sr = o.stage.getBoundingClientRect();
      const [lon, lat] = o.toGeo(clientX - sr.left, clientY - sr.top);
      if (!isFinite(lon) || !isFinite(lat)) return false;
      trigger(cur, lon, lat);
      return true;
    },
    openMenu: (x, y) => open(x, y, false),
    closeMenu: close,
    clear() { list = []; close(); if (ctx) { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height); } if (o) shake(0); },
    // 給之後的原住民躲災難用
    active: () => list.map((f) => ({ k: f.k, lon: f.lon, lat: f.lat, left: f.dur - f.a }))
  };
})();
