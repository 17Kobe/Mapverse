/* 載入畫面的小地球：真的 3D 球體，像真實地球那樣自西向東自轉，地軸向右傾 23.4 度。
 * 做法：先把陸地（assets/geo/land-globe.json，世界地圖 110m 精簡版）畫成一張經緯度貼圖，
 * 再逐像素反投影到球面取樣。不是「畫多邊形再裁切」，所以橫跨背面的大陸（南極洲、歐亞大陸）
 * 在任何角度都不會填錯。不依賴 d3（它還在下載時就要先顯示）。
 * 地圖載入完成（#loading 加上 gone）或畫面被換掉後自動停止；系統開啟「減少動態效果」時只畫一張靜止的。 */
(function () {
  'use strict';
  const box = document.getElementById('loading');
  const cv = box && box.querySelector('canvas.globe');
  if (!cv) return;
  const ctx = cv.getContext('2d');

  const DEG = Math.PI / 180, TAU = Math.PI * 2;
  const VIEW_LAT = 14 * DEG; // 從稍微偏北的角度看，北半球多看到一點
  const ROLL = 23.4 * DEG; // 地軸向右傾斜（真實地球儀的樣子）
  const PERIOD = 18; // 自轉一圈的秒數：慢一點才不會讓人煩躁
  const START_LON = 115; // 起始中心經度：亞洲
  const MAX_PX = 360; // 內部解析度上限（效能）；畫面大小由 CSS 決定，瀏覽器會平滑放大
  const MW = 1024, MH = 512; // 陸地貼圖大小

  const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  let mask = null; // 陸地覆蓋率（0~255），經度 -180~180、緯度 90~-90
  let N = 0, img = null, lonOff, vRow, seaC, landC, alpha;

  // 陸地貼圖：用 canvas 填色（自帶抗鋸齒），再取 alpha 當覆蓋率。
  // 橫跨日期變更線的多邊形（斐濟、楚科奇、南極洲）：先把經度展開成連續的，再左右各多畫一份；
  // 繞整圈的（南極洲）補上到極點的邊，不然極點附近會是空的，而且封閉線會橫跨整張貼圖
  function buildMask(rings) {
    const c = document.createElement('canvas');
    c.width = MW; c.height = MH;
    const g = c.getContext('2d');
    g.fillStyle = '#fff';
    for (const r of rings) {
      const lon = [], lat = [];
      let off = 0, sumLat = 0;
      for (let i = 0; i < r.length; i += 2) {
        let lo = r[i] + off;
        if (i && Math.abs(lo - lon[lon.length - 1]) > 180) { off += lo > lon[lon.length - 1] ? -360 : 360; lo = r[i] + off; }
        lon.push(lo); lat.push(r[i + 1]); sumLat += r[i + 1];
      }
      if (Math.abs(lon[lon.length - 1] - lon[0]) > 180) {
        const pole = sumLat < 0 ? -90 : 90;
        lon.push(lon[lon.length - 1], lon[0]); lat.push(pole, pole);
      }
      for (const shift of [-360, 0, 360]) {
        g.beginPath();
        for (let i = 0; i < lon.length; i++) {
          const x = ((lon[i] + shift + 180) / 360) * MW, y = ((90 - lat[i]) / 180) * MH;
          if (i) g.lineTo(x, y); else g.moveTo(x, y);
        }
        g.closePath();
        g.fill();
      }
    }
    const px = g.getImageData(0, 0, MW, MH).data;
    mask = new Uint8Array(MW * MH);
    for (let i = 0; i < mask.length; i++) mask[i] = px[i * 4 + 3];
  }

  // 每個像素在球面上的位置與光影只和畫面大小有關，不隨自轉改變，只算一次
  function prepare(n) {
    N = n; cv.width = n; cv.height = n;
    img = ctx.createImageData(n, n);
    const total = n * n;
    lonOff = new Float32Array(total); // 該像素相對中心經度的偏移（弧度）
    vRow = new Float32Array(total); // 貼圖的列（緯度）
    seaC = new Uint8ClampedArray(total * 3);
    landC = new Uint8ClampedArray(total * 3);
    alpha = new Uint8ClampedArray(total);
    const sinV = Math.sin(VIEW_LAT), cosV = Math.cos(VIEW_LAT), sinR = Math.sin(ROLL), cosR = Math.cos(ROLL);
    const half = n / 2, R = half - 1.5;
    // 光從左上前方來
    let lx = -0.45, ly = 0.5, lz = 0.75;
    const ll = Math.hypot(lx, ly, lz); lx /= ll; ly /= ll; lz /= ll;
    let hx = lx, hy = ly, hz = lz + 1; // 高光用的半角向量（視線朝向 +z）
    const hl = Math.hypot(hx, hy, hz); hx /= hl; hy /= hl; hz /= hl;
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const k = j * n + i;
        const xr = (i + 0.5 - half) / R, yr = (half - j - 0.5) / R; // 螢幕座標（右、上為正）
        const r2 = xr * xr + yr * yr, r = Math.sqrt(r2);
        alpha[k] = Math.max(0, Math.min(1, (1 - r) * R)) * 255;
        if (r2 >= 1) continue;
        const zr = Math.sqrt(1 - r2);
        // 光影（螢幕座標）：漫射 + 海面高光 + 邊緣的藍色大氣
        const diff = Math.max(0, xr * lx + yr * ly + zr * lz);
        const shade = 0.34 + 0.78 * Math.pow(diff, 0.9);
        const spec = Math.pow(Math.max(0, xr * hx + yr * hy + zr * hz), 48) * 90;
        const rim = Math.pow(r, 6) * 70;
        seaC[3 * k] = 30 * shade + spec + rim * 0.5;
        seaC[3 * k + 1] = 112 * shade + spec + rim * 0.9;
        seaC[3 * k + 2] = 214 * shade + spec + rim;
        landC[3 * k] = 92 * shade + rim * 0.3;
        landC[3 * k + 1] = 192 * shade + rim * 0.5;
        landC[3 * k + 2] = 106 * shade + rim * 0.8;
        // 反投影：先轉回地軸沒有傾斜的座標，再求經緯度
        const x = xr * cosR - yr * sinR, y = xr * sinR + yr * cosR;
        const sinLat = y * cosV + zr * sinV;
        lonOff[k] = Math.atan2(x, zr * cosV - y * sinV);
        vRow[k] = (0.5 - Math.asin(Math.max(-1, Math.min(1, sinLat))) / Math.PI) * MH - 0.5;
      }
    }
  }

  function sample(u, v) {
    // 雙線性取樣；經度繞回，緯度夾在兩極
    const x0 = Math.floor(u), fx = u - x0, y0 = Math.floor(v), fy = v - y0;
    const xa = ((x0 % MW) + MW) % MW, xb = (xa + 1) % MW;
    const ya = Math.max(0, Math.min(MH - 1, y0)), yb = Math.max(0, Math.min(MH - 1, y0 + 1));
    const a = mask[ya * MW + xa] * (1 - fx) + mask[ya * MW + xb] * fx;
    const b = mask[yb * MW + xa] * (1 - fx) + mask[yb * MW + xb] * fx;
    return (a * (1 - fy) + b * fy) / 255;
  }

  function draw(t) {
    const want = Math.min(Math.round(cv.clientWidth * Math.min(window.devicePixelRatio || 1, 3)), MAX_PX);
    if (!want) return;
    if (want !== N) prepare(want);
    const d = img.data;
    const lam0 = (START_LON - (t / PERIOD) * 360) * DEG;
    const off = (lam0 / TAU + 0.5) * MW - 0.5;
    const total = N * N;
    for (let k = 0; k < total; k++) {
      const o = k * 4;
      const al = alpha[k];
      if (al === 0) { d[o + 3] = 0; continue; }
      const c = mask ? sample(off + (lonOff[k] / TAU) * MW, vRow[k]) : 0;
      // 海岸線處多一圈淡淡的亮邊
      const edge = c > 0 && c < 1 ? (1 - Math.abs(2 * c - 1)) * 0.55 : 0;
      const s = 3 * k;
      d[o] = seaC[s] + (landC[s] - seaC[s]) * c + (232 - landC[s]) * edge * 0.5;
      d[o + 1] = seaC[s + 1] + (landC[s + 1] - seaC[s + 1]) * c + (255 - landC[s + 1]) * edge * 0.5;
      d[o + 2] = seaC[s + 2] + (landC[s + 2] - seaC[s + 2]) * c + (222 - landC[s + 2]) * edge * 0.5;
      d[o + 3] = al;
    }
    ctx.putImageData(img, 0, 0);
  }

  let last = -1e9;
  function loop(ts) {
    if (!cv.isConnected || box.classList.contains('gone')) return;
    if (ts - last >= 30) { last = ts; draw(ts / 1000); } // 約 30 幀就夠順，也不和載入搶時間
    requestAnimationFrame(loop);
  }

  draw(0); // 陸地資料還沒到之前先畫出海洋球體
  if (!reduce) requestAnimationFrame(loop);
  fetch('assets/geo/land-globe.json')
    .then((r) => r.json())
    .then((rings) => {
      buildMask(rings);
      if (reduce) draw(0);
    })
    .catch(() => { /* 沒有陸地資料就只轉海洋球，不影響地圖載入 */ });
})();
