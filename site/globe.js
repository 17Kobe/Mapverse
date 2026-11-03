/* 載入畫面的小地球：真的 3D 球體（正射投影），像真實地球那樣自西向東自轉，地軸向右傾 23.4 度。
 * 不依賴 d3 / topojson（它們還在下載時就要先顯示），陸地資料是 assets/geo/land-globe.json（世界地圖 110m 精簡版）。
 * 地圖載入完成（#loading 加上 gone）或畫面被換掉後自動停止；系統開啟「減少動態效果」時只畫一張靜止的。 */
(function () {
  'use strict';
  const box = document.getElementById('loading');
  const cv = box && box.querySelector('canvas.globe');
  if (!cv) return;
  const ctx = cv.getContext('2d');

  const DEG = Math.PI / 180;
  const VIEW_LAT = 14 * DEG; // 從稍微偏北的角度看，才看得到北半球多一點
  const ROLL = 23.4 * DEG; // 地軸順時針傾斜（真實地球儀的樣子）
  const PERIOD = 18; // 自轉一圈的秒數：慢一點才不會讓人煩躁
  const START_LON = 115; // 起始中心經度：亞洲
  const sinV = Math.sin(VIEW_LAT), cosV = Math.cos(VIEW_LAT);
  const sinR = Math.sin(ROLL), cosR = Math.cos(ROLL);

  let rings = []; // 每個外環預先算好 sin / cos，轉動時不用重算緯度
  const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  let size = 0, dpr = 1;

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 3);
    const w = Math.round(cv.clientWidth * dpr) || 0;
    if (w && w !== size) { size = w; cv.width = size; cv.height = size; }
  }

  function draw(t) {
    resize();
    if (!size) return;
    const R = size / 2 - 2 * dpr, c = size / 2;
    ctx.clearRect(0, 0, size, size);
    ctx.save();
    ctx.beginPath();
    ctx.arc(c, c, R, 0, Math.PI * 2);
    ctx.clip();

    // 海洋：左上亮、右下暗，有立體感
    const sea = ctx.createRadialGradient(c - R * 0.35, c - R * 0.4, R * 0.1, c, c, R * 1.05);
    sea.addColorStop(0, '#59b7ff');
    sea.addColorStop(0.55, '#2370d8');
    sea.addColorStop(1, '#0d2f78');
    ctx.fillStyle = sea;
    ctx.fillRect(0, 0, size, size);

    // 陸地：自西向東轉（中心經度越來越小，地表就往右移）
    const lam0 = (START_LON - (t / PERIOD) * 360) * DEG;
    const s0 = Math.sin(lam0), c0 = Math.cos(lam0);
    ctx.fillStyle = '#58c26e';
    ctx.strokeStyle = 'rgba(226,255,214,.55)';
    ctx.lineWidth = Math.max(1, R / 90);
    ctx.lineJoin = 'round';
    for (const r of rings) {
      ctx.beginPath();
      let any = false;
      for (let i = 0; i < r.n; i++) {
        const s = r.sl[i] * c0 - r.cl[i] * s0; // sin(λ-λ0)
        const cc = r.cl[i] * c0 + r.sl[i] * s0; // cos(λ-λ0)
        let x = r.cp[i] * s, y = cosV * r.sp[i] - sinV * r.cp[i] * cc;
        const z = sinV * r.sp[i] + cosV * r.cp[i] * cc;
        if (z >= 0) any = true;
        else { const L = Math.hypot(x, y) || 1; x /= L; y /= L; } // 背面的點貼到球的邊緣，輪廓才閉得起來
        const xr = x * cosR + y * sinR, yr = -x * sinR + y * cosR; // 地軸順時針傾斜
        const px = c + R * xr, py = c - R * yr;
        if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
      }
      if (!any) continue; // 整塊都在背面
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    // 光影：邊緣變暗（球面感）＋左上高光
    const shade = ctx.createRadialGradient(c - R * 0.3, c - R * 0.35, R * 0.35, c, c, R);
    shade.addColorStop(0, 'rgba(255,255,255,0)');
    shade.addColorStop(0.7, 'rgba(6,20,60,.18)');
    shade.addColorStop(1, 'rgba(4,12,40,.62)');
    ctx.fillStyle = shade;
    ctx.fillRect(0, 0, size, size);
    const hi = ctx.createRadialGradient(c - R * 0.42, c - R * 0.46, 0, c - R * 0.42, c - R * 0.46, R * 0.5);
    hi.addColorStop(0, 'rgba(255,255,255,.34)');
    hi.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = hi;
    ctx.fillRect(0, 0, size, size);
    ctx.restore();
  }

  function loop(ts) {
    if (!cv.isConnected || box.classList.contains('gone')) return;
    draw(ts / 1000);
    requestAnimationFrame(loop);
  }

  draw(0); // 資料還沒到之前先畫出海洋球體
  if (!reduce) requestAnimationFrame(loop);
  fetch('assets/geo/land-globe.json')
    .then((r) => r.json())
    .then((data) => {
      rings = data.map((f) => {
        const n = f.length / 2, sl = new Float32Array(n), cl = new Float32Array(n), sp = new Float32Array(n), cp = new Float32Array(n);
        for (let i = 0; i < n; i++) {
          const lo = f[2 * i] * DEG, la = f[2 * i + 1] * DEG;
          sl[i] = Math.sin(lo); cl[i] = Math.cos(lo); sp[i] = Math.sin(la); cp[i] = Math.cos(la);
        }
        return { n, sl, cl, sp, cp };
      });
      if (reduce) draw(0);
    })
    .catch(() => { /* 沒有陸地資料就只轉海洋球，不影響地圖載入 */ });
})();
