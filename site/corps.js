/* 台股市值前十大公司：畫在股市地圖的台灣島上（遊戲風的小建築 + 招牌）
 * - 縮小時（台灣只有一點點大）：前 3 大（台積電、聯發科、台達電）合成一座「模擬城市封面」式的小城市
 * - 放大到台灣夠大時：10 棟建築各自蓋在公司總部所在地，頭上掛招牌
 * - 台股加權指數上漲：窗戶亮燈；下跌：整片低迷變暗；漲超過 2% 放煙火；跌超過 2% 頭上烏雲下雨打雷
 * 由 app.js 呼叫 Corps.build() / Corps.layout()。
 */
(function () {
  'use strict';

  // 市值資料：內建的是 2026 年 10 月 23 日收盤附近（新台幣兆元）的備用值；總部地址取自證交所上市公司基本資料。
  // 網頁載入後會用 iKDx-realtime 每天更新的 tw-top.json 覆蓋市值與名次（applyFeed），連不上就沿用這裡的數字
  let dataDate = '2026-10-23';
  let live = false;
  const TOP_SHOWN = 10; // 只畫前十大；掉出前十的公司建築自動收起來
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

  /* ---------- 建築畫法（SVG 字串；原點是建築底部中央的地面，y 往上是負的） ----------
   * 造型參考模擬城市 4 封面：細長的玻璃高樓、一層層退縮、斜切或尖頂的樓冠、頂樓塔吊/停機坪/天線，
   * 商標直接嵌在大樓正面上方（像真的企業總部大樓），不另外立牌。 */
  const hex = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
  const mix = (c, t, f) => {
    const a = hex(c), b = hex(t);
    return '#' + a.map((v, i) => Math.round(v + (b[i] - v) * f).toString(16).padStart(2, '0')).join('');
  };
  const dark = (c, f) => mix(c, '#0b1220', f), light = (c, f) => mix(c, '#ffffff', f);
  const f1 = (n) => +n.toFixed(2);

  // 正面與側面的窗戶。樣式：grid 方格窗、band 橫向帶狀玻璃（加直向窗框）、col 直向長窗（加樓層線）
  function windows(x, w, d, t, b, [rows, cols, style = 'grid']) {
    const h = b - t, mx = Math.min(1.6, w * 0.09), my = Math.min(2, h * 0.12);
    const gw = (w - mx * 2) / cols, gh = (h - my * 2) / rows;
    const sc = Math.max(1, Math.round((cols * d) / w)), sg = d / sc;
    const rect = (x0, y0, ww, hh) => `M${f1(x0)},${f1(y0)}h${f1(ww)}v${f1(hh)}h${f1(-ww)}Z`;
    const side = (x0, y0, sw, hh) => `M${f1(x0)},${f1(y0)}l${f1(sw)},${f1(-sw * 0.5)}v${f1(hh)}l${f1(-sw)},${f1(sw * 0.5)}Z`;
    let p = '', m = '';
    if (style === 'band') {
      const wh = gh * 0.58;
      for (let r = 0; r < rows; r++) {
        const y = t + my + r * gh + (gh - wh) / 2;
        p += rect(x + mx, y, w - mx * 2, wh) + side(x + w + 0.6, y - 0.3, d - 1.2, wh);
      }
      for (let k = 1; k < cols; k++) m += `M${f1(x + mx + k * gw)},${f1(t + my)}V${f1(b - my)}`;
    } else if (style === 'col') {
      const ww = gw * 0.6;
      for (let k = 0; k < cols; k++) p += rect(x + mx + k * gw + (gw - ww) / 2, t + my, ww, h - my * 2);
      for (let k = 0; k < sc; k++) p += side(x + w + k * sg + sg * 0.2, t + my - (k * sg + sg * 0.2) * 0.5, sg * 0.6, h - my * 2);
      for (let r = 1; r < rows; r++) m += `M${f1(x + mx)},${f1(t + my + r * gh)}h${f1(w - mx * 2)}`;
    } else {
      const ww = gw * 0.56, wh = gh * 0.5;
      for (let r = 0; r < rows; r++) for (let k = 0; k < cols; k++) p += rect(x + mx + k * gw + (gw - ww) / 2, t + my + r * gh + (gh - wh) / 2, ww, wh);
      for (let r = 0; r < rows; r++) for (let k = 0; k < sc; k++) {
        p += side(x + w + k * sg + sg * 0.25, t + my + r * gh + (gh - wh) / 2 - (k * sg + sg * 0.25) * 0.5, sg * 0.5, wh);
      }
    }
    return `<path class="w" d="${p}"/>` + (m ? `<path class="mu" d="${m}"/>` : '');
  }

  // 立體方塊：正面 + 右側面（光從左上來，側面較暗）+ 屋頂
  // y0：底部離地高度（疊在別的方塊上）；back：往後退縮（高樓一層層內縮）；glass：正面加玻璃反光
  function box(x, w, h, d, c, { win, y0 = 0, back = 0, roof, glass } = {}) {
    x += back; y0 += back / 2;
    const b = -y0, t = -y0 - h, dx = d, dy = d * 0.5;
    let s = `<path fill="${c}" d="M${f1(x)},${f1(b)}H${f1(x + w)}V${f1(t)}H${f1(x)}Z"/>`;
    s += `<path fill="${dark(c, 0.32)}" d="M${f1(x + w)},${f1(b)}L${f1(x + w + dx)},${f1(b - dy)}V${f1(t - dy)}L${f1(x + w)},${f1(t)}Z"/>`;
    s += `<path fill="${roof || light(c, 0.28)}" d="M${f1(x)},${f1(t)}L${f1(x + dx)},${f1(t - dy)}H${f1(x + w + dx)}L${f1(x + w)},${f1(t)}Z"/>`;
    if (win) s += windows(x, w, d, t, b, win);
    if (glass) s += `<path class="gl" d="M${f1(x)},${f1(b)}H${f1(x + w)}V${f1(t)}H${f1(x)}Z"/>`;
    s += `<path class="edge" d="M${f1(x)},${f1(b)}H${f1(x + w)}L${f1(x + w + dx)},${f1(b - dy)}V${f1(t - dy)}H${f1(x + dx)}L${f1(x)},${f1(t)}Z"/>`;
    return s;
  }
  // 圓柱（儲槽、圓塔）；bands 給了就畫一圈圈的帶狀窗
  function cyl(x, w, h, c, y0 = 0, bands = 0) {
    const b = -y0, t = b - h, rx = w / 2, ry = w * 0.22, cx = x + rx;
    let s = `<path fill="${c}" d="M${f1(x)},${f1(t)}V${f1(b)}A${f1(rx)},${f1(ry)} 0 0 0 ${f1(x + w)},${f1(b)}V${f1(t)}Z"/>` +
      `<path fill="${dark(c, 0.3)}" d="M${f1(cx + rx * 0.3)},${f1(t)}V${f1(b + ry * 0.95)}A${f1(rx)},${f1(ry)} 0 0 0 ${f1(x + w)},${f1(b)}V${f1(t)}Z"/>`;
    if (bands) {
      const gh = (h - 3) / bands;
      let p = '';
      for (let i = 0; i < bands; i++) {
        const y = t + 2 + i * gh + gh / 2;
        p += `M${f1(x + 0.6)},${f1(y)}A${f1(rx - 0.6)},${f1(ry)} 0 0 0 ${f1(x + w - 0.6)},${f1(y)}`;
      }
      s += `<path class="wl" stroke-width="${f1(gh * 0.5)}" d="${p}"/>`;
      s += `<path class="gl" d="M${f1(x)},${f1(t)}V${f1(b)}A${f1(rx)},${f1(ry)} 0 0 0 ${f1(x + w)},${f1(b)}V${f1(t)}Z"/>`;
    }
    return s + `<ellipse fill="${light(c, 0.3)}" cx="${f1(cx)}" cy="${f1(t)}" rx="${f1(rx)}" ry="${f1(ry)}"/>`;
  }
  // 四角尖頂（像金字塔的樓冠）：蓋在 x、寬 w、深 d、離地 y0 的屋頂上，高 h
  function hip(x, w, d, y0, h, c) {
    const b = -y0, ax = f1(x + (w + d) / 2), ay = f1(b - d / 4 - h);
    return `<path fill="${light(c, 0.12)}" d="M${f1(x)},${f1(b)}H${f1(x + w)}L${ax},${ay}Z"/>` +
      `<path fill="${dark(c, 0.3)}" d="M${f1(x + w)},${f1(b)}L${f1(x + w + d)},${f1(b - d / 2)}L${ax},${ay}Z"/>` +
      `<path class="edge" d="M${f1(x)},${f1(b)}L${ax},${ay}L${f1(x + w + d)},${f1(b - d / 2)}M${f1(x + w)},${f1(b)}L${ax},${ay}"/>`;
  }
  // 斜切的樓冠：dir=1 往右升高、dir=-1 往左升高（像一把刀鋒）
  function slant(x, w, d, y0, h, c, dir = 1) {
    const b = -y0, dy = d / 2;
    if (dir > 0) {
      return `<path fill="${c}" d="M${f1(x)},${f1(b)}H${f1(x + w)}V${f1(b - h)}Z"/>` +
        `<path fill="${dark(c, 0.32)}" d="M${f1(x + w)},${f1(b)}L${f1(x + w + d)},${f1(b - dy)}V${f1(b - dy - h)}L${f1(x + w)},${f1(b - h)}Z"/>` +
        `<path fill="${light(c, 0.35)}" d="M${f1(x)},${f1(b)}L${f1(x + w)},${f1(b - h)}L${f1(x + w + d)},${f1(b - dy - h)}L${f1(x + d)},${f1(b - dy)}Z"/>` +
        `<path class="edge" d="M${f1(x)},${f1(b)}L${f1(x + w)},${f1(b - h)}L${f1(x + w + d)},${f1(b - dy - h)}V${f1(b - dy)}M${f1(x + w)},${f1(b)}V${f1(b - h)}"/>`;
    }
    return `<path fill="${c}" d="M${f1(x)},${f1(b)}H${f1(x + w)}L${f1(x)},${f1(b - h)}Z"/>` +
      `<path fill="${light(c, 0.35)}" d="M${f1(x)},${f1(b - h)}L${f1(x + w)},${f1(b)}L${f1(x + w + d)},${f1(b - dy)}L${f1(x + d)},${f1(b - dy - h)}Z"/>` +
      `<path class="edge" d="M${f1(x)},${f1(b - h)}L${f1(x + w)},${f1(b)}L${f1(x + w + d)},${f1(b - dy)}L${f1(x + d)},${f1(b - dy - h)}Z"/>`;
  }
  // 天線（頂端紅色航空警示燈會閃）
  const ant = (x, y, h) => `<path stroke="#c9d1db" stroke-width=".7" d="M${f1(x)},${f1(y)}V${f1(y - h)}M${f1(x - 1.2)},${f1(y - h * 0.45)}H${f1(x + 1.2)}"/>` +
    `<circle class="bk" fill="#ff4b4b" cx="${f1(x)}" cy="${f1(y - h)}" r="1"/>`;
  // 頂樓停機坪
  const heli = (cx, cy, r) => `<ellipse fill="#3b4352" cx="${cx}" cy="${cy}" rx="${r}" ry="${f1(r * 0.5)}"/>` +
    `<ellipse fill="none" stroke="#f2c14e" stroke-width="${f1(r * 0.1)}" cx="${cx}" cy="${cy}" rx="${f1(r * 0.75)}" ry="${f1(r * 0.37)}"/>` +
    `<path stroke="#fff" stroke-width="${f1(r * 0.12)}" d="M${f1(cx - r * 0.25)},${f1(cy - r * 0.18)}v${f1(r * 0.36)}M${f1(cx + r * 0.25)},${f1(cy - r * 0.18)}v${f1(r * 0.36)}M${f1(cx - r * 0.25)},${cy}h${f1(r * 0.5)}"/>`;
  // 塔吊（模擬城市封面那種黃色塔吊）：x 塔身、y 塔底、h 塔高、jib 吊臂長、dir 吊臂朝向
  function crane(x, y, h, jib, dir = 1) {
    const t = y - h, Y = '#f2b705', n = Math.max(3, Math.round(h / 2.6)), st = h / n;
    let lat = '';
    for (let i = 0; i < n; i++) lat += `M${f1(x - 0.9)},${f1(y - i * st)}L${f1(x + 0.9)},${f1(y - (i + 1) * st)}`;
    const je = x + jib * dir, ce = x - jib * 0.32 * dir, hk = x + jib * 0.72 * dir;
    return `<path fill="none" stroke="${Y}" stroke-width=".45" d="M${f1(x - 0.9)},${f1(y)}V${f1(t)}M${f1(x + 0.9)},${f1(y)}V${f1(t)}${lat}"/>` +
      `<path fill="none" stroke="${Y}" stroke-width=".7" d="M${f1(ce)},${f1(t)}H${f1(je)}"/>` +
      `<path fill="none" stroke="${dark(Y, 0.2)}" stroke-width=".35" d="M${f1(x)},${f1(t - 3.5)}V${f1(t)}M${f1(x)},${f1(t - 3.5)}L${f1(je)},${f1(t)}M${f1(x)},${f1(t - 3.5)}L${f1(ce)},${f1(t)}"/>` +
      `<rect fill="#6b7280" x="${f1(Math.min(ce, ce - 2.4 * dir))}" y="${f1(t)}" width="2.4" height="1.8"/>` +
      `<rect fill="${Y}" x="${f1(dir > 0 ? x + 0.9 : x - 2.9)}" y="${f1(t + 0.4)}" width="2" height="1.6"/>` +
      `<path stroke="#39424e" stroke-width=".25" d="M${f1(hk)},${f1(t)}V${f1(t + 9)}"/>` +
      `<rect fill="#c0392b" x="${f1(hk - 1.6)}" y="${f1(t + 9)}" width="3.2" height="1.4"/>`;
  }
  const tree = (x, y, r) => `<circle fill="#2f8a3e" cx="${x}" cy="${y}" r="${r}"/><circle fill="#5cc062" cx="${f1(x - r * 0.3)}" cy="${f1(y - r * 0.3)}" r="${f1(r * 0.55)}"/>`;

  // 嵌在大樓正面的商標（corp-logos.js，來自 iKDx 的 StockLogo.vue）：白色外框 + 商標，cx 中心、y 上緣、size 邊長。
  // 沒有商標圖時退回公司名稱。
  let logoSeq = 0;
  function logo(c, cx, y, size) {
    const pad = size * 0.1, w = size + pad * 2, x = cx - w / 2;
    const s = `<rect class="lgf" x="${f1(x)}" y="${f1(y)}" width="${f1(w)}" height="${f1(w)}" rx="${f1(size * 0.16)}"/>`;
    const svg = window.CORP_LOGOS && window.CORP_LOGOS[c.s];
    if (svg) {
      // 商標裡的 id（clipPath、漸層）每次放進頁面都要換成不重複的，不然同一張商標放兩處會互相干擾
      const n = ++logoSeq, uid = svg.replace(/id="([^"]+)"/g, (_, i) => `id="${i}-${n}"`).replace(/url\(#([^)]+)\)/g, (_, i) => `url(#${i}-${n})`);
      return s + uid.replace('<svg ', `<svg x="${f1(x + pad)}" y="${f1(y + pad)}" width="${f1(size)}" height="${f1(size)}" `);
    }
    return s + `<text class="lgt" x="${f1(cx)}" y="${f1(y + w / 2)}" fill="${c.col}" font-size="${f1(size * 0.36)}">${c.name}</text>`;
  }

  // 每種建築：svg 內容、top（建築最高點，給招牌和特效用）
  const ART = {
    // 台積電：晶圓廠（屋頂有排氣塔、正在擴廠的塔吊）+ 尖頂玻璃總部大樓
    tsmc: (c) => ({
      top: -82,
      svg: box(-6, 34, 12, 16, '#eef1f4', { win: [2, 9, 'band'], roof: '#dfe5ec' }) +
        `<rect fill="#d71920" x="-6" y="-12" width="34" height="1.6"/>` +
        cyl(6, 3.4, 9, '#f4f6f8', 16) + cyl(13, 3.4, 11, '#f4f6f8', 17) +
        `<rect fill="#d71920" x="6" y="-24.4" width="3.4" height="1.4"/><rect fill="#d71920" x="13" y="-27.4" width="3.4" height="1.4"/>` +
        crane(31, -18, 34, 17, -1) +
        box(-26, 18, 48, 10, '#3f74b5', { win: [13, 4, 'band'], glass: true }) +
        `<path fill="#bfe2ff" opacity=".85" d="M-23,0V-5H-11V0Z"/><path fill="#d71920" d="M-24,-5H-10L-9,-6.5H-23Z"/>` +
        box(-24, 14, 12, 7, '#4f86c6', { y0: 48, back: 1, win: [3, 3, 'band'], glass: true }) +
        hip(-23, 14, 7, 60.5, 10, '#8fb8e6') + ant(-12.5, -72.2, 8) +
        logo(c, -17, -45.5, 10.5)
    }),
    // 聯發科：裙樓上的細長玻璃塔，橘色直條立面、斜切樓冠
    mtk: (c) => ({
      top: -82,
      svg: box(-13, 28, 6, 14, '#eceff3', { win: [1, 7, 'band'] }) +
        `<path fill="#f08c00" d="M-8,-6H6L7.5,-7.5H-6.5Z"/>` +
        box(-9, 18, 50, 9, '#2b5c96', { y0: 6, back: 2, win: [15, 4, 'col'], glass: true }) +
        `<rect fill="#f08c00" x="-7" y="-57" width="2" height="50"/>` +
        slant(-7, 18, 9, 57, 12, '#5d93d1', 1) + ant(15.5, -71.2, 9) +
        logo(c, 2.5, -53, 10)
    }),
    // 台達電：綠建築，一層層退縮的屋頂花園，頂樓太陽能板和風機
    delta: (c) => ({
      top: -70,
      svg: box(-15, 30, 13, 14, '#3a9466', { win: [3, 7, 'band'], roof: '#7fcf6a' }) +
        `<path fill="#bfe8ff" opacity=".85" d="M-5,0V-4H5V0Z"/>` +
        tree(-12, -14.6, 1.6) + tree(-8, -14.4, 1.4) + tree(25, -18.5, 1.6) +
        box(-11, 22, 13, 9, '#43a271', { y0: 13, back: 5, win: [3, 5, 'band'], roof: '#7fcf6a' }) +
        tree(-4, -29.6, 1.4) + tree(16, -32, 1.5) +
        box(-10, 14, 18, 6, '#2f8a5c', { y0: 26, back: 8, win: [5, 3, 'band'], glass: true, roof: '#cfd8dc' }) +
        `<path fill="#22406e" stroke="#7fa7d9" stroke-width=".25" d="M0,-48.7l2,-1h8l-2,1ZM2.6,-50l2,-1h8l-2,1Z"/>` +
        `<path stroke="#f4f6f8" stroke-width=".7" d="M15,-50V-62"/>` +
        `<path stroke="#ffffff" stroke-width="1" stroke-linecap="round" d="M15,-62V-68.5M15,-62L20.6,-58.8M15,-62L9.4,-58.8"/>` +
        `<circle fill="#dfe6ef" cx="15" cy="-62" r=".9"/>` +
        logo(c, 5, -46, 10)
    }),
    // 鴻海：鋸齒屋頂的廠房 + 頂樓有停機坪的總部大樓
    honhai: (c) => {
      let saw = '', sky = '';
      for (const [ox, oy] of [[6, -3], [0, 0]]) {
        for (let i = 0; i < 8; i++) {
          const x0 = -2 + ox + i * 4, y0 = -13 + oy;
          saw += `M${x0},${y0}V${y0 - 3.6}L${x0 + 4},${y0}Z`;
          sky += `M${x0},${y0}v-3.4h.9v3.4Z`;
        }
      }
      return {
        top: -54,
        svg: box(-2, 32, 13, 14, '#c9ced6', { win: [2, 8, 'band'] }) +
          `<path fill="#a7afbb" d="${saw}"/><path class="w" d="${sky}"/>` +
          box(-24, 18, 42, 10, '#1d4f9c', { win: [12, 4, 'band'], glass: true }) +
          `<path fill="#bfe2ff" opacity=".85" d="M-21,0V-4.5H-9V0Z"/>` +
          heli(-10, -44.5, 5) + ant(-20, -45, 8) +
          logo(c, -15, -39.5, 10)
      };
    },
    // 日月光：屋頂有晶片的封測廠 + 圓柱形玻璃塔
    ase: (c) => ({
      top: -56,
      svg: box(-4, 30, 14, 14, '#d8dde4', { win: [2, 7, 'band'] }) +
        `<path fill="#232a36" d="M10,-16L16,-19H26L20,-16Z"/>` +
        `<path stroke="#e3c35a" stroke-width=".6" d="M12,-15.2v1M15,-15.2v1M18,-15.2v1M21,-16.2l1.6,-.8M23,-17.2l1.6,-.8"/>` +
        cyl(-24, 16, 40, '#00539b', 0, 11) +
        cyl(-22.5, 13, 3, '#2a78c8', 40) + ant(-16, -46.5, 9) +
        logo(c, -16, -37, 10)
    }),
    // 南亞：石化儲槽、蒸餾塔、燃燒塔 + 斜頂辦公大樓
    nanya: (c) => ({
      top: -46,
      svg: cyl(2, 3.4, 30, '#aeb6c0') +
        `<path stroke="#8b96a5" stroke-width=".6" d="M2,-10h3.4M2,-17h3.4M2,-24h3.4"/>` +
        `<path stroke="#9aa3ad" stroke-width="1.3" d="M28,-8V-34"/>` +
        `<path class="flame" fill="#ffb347" d="M28,-34c-1.6,-2 -.6,-4.4 0,-6.4c.6,2 1.6,4.4 0,6.4Z"/>` +
        `<path stroke="#8b96a5" stroke-width="1.1" fill="none" d="M5.4,-20H13V-14M5.4,-12H23V-9"/>` +
        cyl(8, 11, 14, '#d3d9e0') + cyl(19, 9, 10, '#c3cad3') +
        `<path fill="none" stroke="#0b7a52" stroke-width="1.6" d="M8,-8A5.5,2.42 0 0 0 19,-8M19,-5A4.5,1.98 0 0 0 28,-5"/>` +
        box(-22, 15, 34, 9, '#4a6a8c', { win: [10, 3], glass: true }) +
        slant(-22, 15, 9, 34, 8, '#7a9cc0', -1) + ant(-21, -42, 4) +
        logo(c, -14.5, -31.5, 9)
    }),
    // 富邦金：裙樓 + 高聳玻璃塔，刀鋒狀斜頂加尖塔
    fubon: (c) => ({
      top: -88,
      svg: box(-14, 28, 8, 14, '#cfd9e2', { win: [2, 7, 'band'] }) +
        `<path fill="#00808f" d="M-6,-4H6L7.5,-5.5H-4.5Z"/>` +
        box(-10, 18, 52, 9, '#2c7fb8', { y0: 8, back: 3, win: [15, 4, 'band'], glass: true }) +
        slant(-7, 18, 9, 61.5, 14, '#9fd4f5', -1) + ant(-7, -75.5, 10) +
        logo(c, 2, -58.5, 10)
    }),
    // 台光電：銅色屋頂的基板廠 + 辦公樓
    emc: (c) => ({
      top: -34,
      svg: box(-4, 30, 12, 13, '#dcc7ab', { win: [1, 7, 'band'], roof: '#c8743a' }) +
        `<path stroke="#f3b27a" stroke-width=".6" d="M-1,-13.5L5,-16.5M5,-13.5L11,-16.5M11,-13.5L17,-16.5M17,-13.5L23,-16.5"/>` +
        box(6, 4, 2, 3, '#a7b0ba', { y0: 12, back: 6 }) + box(14, 4, 2, 3, '#a7b0ba', { y0: 12, back: 7 }) +
        box(-22, 16, 26, 9, '#b4561c', { win: [7, 3, 'col'], glass: true }) +
        box(-21, 14, 2, 8, '#8f4415', { y0: 26, back: 0.5 }) + ant(-9, -31, 5) +
        logo(c, -14, -23.5, 9)
    }),
    // 欣興：綠色屋頂上有電路走線的載板廠 + 辦公塔
    unimicron: (c) => ({
      top: -48,
      svg: box(-4, 30, 13, 13, '#cfd8d0', { win: [2, 7, 'band'], roof: '#2f8a4c' }) +
        `<path stroke="#e6d16a" stroke-width=".6" fill="none" d="M1,-14.5h6l3,-1.5h6M4,-16l4,-2h7M13,-14.5l4,-2h6"/>` +
        `<circle fill="#e6d16a" cx="1" cy="-14.5" r=".8"/><circle fill="#e6d16a" cx="23" cy="-16.5" r=".8"/>` +
        box(-20, 14, 30, 9, '#2a56a8', { win: [9, 3, 'band'], glass: true }) +
        box(-19, 12, 6, 7, '#3a6cc4', { y0: 30, back: 1, win: [2, 3, 'band'], glass: true }) + ant(-8.5, -38.2, 8) +
        logo(c, -13, -27.5, 9)
    }),
    // 國泰金：裙樓 + 退縮的綠色大樓，頂樓種一棵大樹（國泰的樹）
    cathay: (c) => ({
      top: -72,
      svg: box(-14, 28, 7, 14, '#d9e4da', { win: [2, 7, 'band'] }) +
        `<path fill="#00a04a" d="M-6,-3.5H6L7.5,-5H-4.5Z"/>` +
        box(-10, 18, 40, 9, '#2f8f55', { y0: 7, back: 3, win: [11, 4], glass: true }) +
        box(-8, 14, 10, 6, '#3aa865', { y0: 47, back: 4.5, win: [3, 3], glass: true }) +
        `<path stroke="#6b4a2b" stroke-width="1.4" d="M6.5,-60.5V-64"/>` + tree(6.5, -67, 4.2) +
        logo(c, 2, -45.5, 10)
    })
  };
  // 縮小時的小城市：前 3 大蓋在同一座廣場上（模擬城市封面的感覺），台積電在中間最大
  function clusterArt() {
    const t = ART.tsmc(CORPS[0]), m = ART.mtk(CORPS[1]), d = ART.delta(CORPS[2]);
    const plaza = `<path fill="#d9d2bf" d="M-68,2L-36,-14H74L42,2Z"/><path fill="#a99f86" d="M-68,2H42V4.5H-68Z"/>` +
      `<path fill="#8e856d" d="M42,2L74,-14V-11.5L42,4.5Z"/>` + tree(-62, -1, 2.4) + tree(66, -11, 2.2) + tree(-36, 0, 2) + tree(36, 0, 2);
    return {
      top: -84,
      svg: plaza +
        `<g transform="translate(-48,-8) scale(.82)">${m.svg}</g>` +
        `<g transform="translate(50,-10) scale(.8)">${d.svg}</g>` +
        `<g transform="translate(0,0)">${t.svg}</g>`
    };
  }
  /* ---------- 建立 SVG ---------- */
  let root = null, items = [], cluster = null, fx = [], onPick = null, lastOrder = '', lab = null;
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
    // 玻璃帷幕的斜向反光（所有建築共用）
    el('defs', {}, root).innerHTML = '<linearGradient id="corp-sheen" x1="0" y1="0" x2="1" y2="1">' +
      '<stop offset="0" stop-color="#fff" stop-opacity=".5"/><stop offset=".38" stop-color="#fff" stop-opacity="0"/>' +
      '<stop offset=".62" stop-color="#fff" stop-opacity=".16"/><stop offset=".75" stop-color="#fff" stop-opacity="0"/></linearGradient>';
    // 先放特效的底層（低迷時地上的陰影）再放建築，最後是特效（煙火、烏雲）
    cluster = { g: el('g', { class: 'bld mk cluster', role: 'button', tabindex: 0, 'aria-label': '台股權值股小城市：台積電、聯發科、台達電' }, root) };
    el('ellipse', { class: 'gs', filter: 'url(#soft)' }, cluster.g);
    cluster.art = el('g', { class: 'art' }, cluster.g);
    const ca = clusterArt();
    cluster.art.innerHTML = ca.svg;
    cluster.top = ca.top;
    cluster.g.addEventListener('click', () => onPick && onPick(null));
    const labLayer = el('g', { class: 'labels' });
    for (const c of CORPS) {
      const g = el('g', { class: 'bld mk', role: 'button', tabindex: 0, 'aria-label': `${c.name}（市值第 ${c.rk} 名）` }, root);
      const lead = el('path', { class: 'lead' }, g);
      const dot = el('circle', { class: 'hq', r: 2.2, fill: c.col }, g);
      const body = el('g', {}, g);
      el('ellipse', { class: 'gs', filter: 'url(#soft)' }, body);
      const art = el('g', { class: 'art' }, body);
      const a = ART[c.kind](c);
      art.innerHTML = a.svg;
      // 招牌放在最上層（不會被前面的建築擋住），位置跟著建築
      const lg = el('g', { class: 'lbl mk' }, labLayer);
      const sign = makeSign(lg, c);
      for (const n of [g, lg]) {
        n.addEventListener('click', () => onPick && onPick(c));
        n.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick && onPick(c); } });
      }
      items.push({ c, g, body, art, lg, sign, lead, dot, top: a.top, w: 0 });
    }
    root.appendChild(labLayer);
    lab = labLayer;
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
      const hgt = Math.max(34, Math.min(72, ppd * 6)), s = hgt / -cluster.top;
      const on = x > -80 && x < W + 80 && y > -80 && y < H + 80;
      show(cluster.g, on);
      if (on) {
        setA(cluster.g, 'transform', `translate(${f1(x)},${f1(y)})`);
        setA(cluster.art, 'transform', `scale(${f1(s)})`);
        if (!cluster.bb) bboxOf(cluster);
        const bb = cluster.bb || { x: -55, y: cluster.top, w: 120, h: -cluster.top + 5 };
        const gs = cluster.g.querySelector('.gs');
        setA(gs, 'rx', f1(bb.w * 0.45 * s)); setA(gs, 'ry', f1(9 * s)); setA(gs, 'cx', f1((bb.x + bb.w / 2) * s)); setA(gs, 'cy', f1(-2 * s));
        out.push({ x: x + bb.x * s, y: y + bb.y * s, w: bb.w * s, h: bb.h * s, an: true });
        fxAt.push([x + 3 * s, y + (cluster.top - 6) * s, s * 1.6]);
      }
      for (const it of items) { show(it.g, false); show(it.lg, false); }
    } else {
      // 放大：10 棟各自蓋在總部。台北的幾家總部離得很近，建築本身可以前後交疊（像一排天際線），
      // 只有幾乎整棟被擋住時才往左右挪一點；招牌另外找不重疊的位置，真的放不下就先不掛（再放大就會出現）
      const u = Math.max(0.5, Math.min(2.2, ppd / 130));
      const ui = (o.avoid || []).slice();
      const vis = [];
      for (const it of items) {
        const c = it.c, [hx, hy] = xy(c.lon, c.lat);
        if (c.rk > TOP_SHOWN) { show(it.g, false); show(it.lg, false); continue; }
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
        show(it.lg, on);
        if (on) vis.push({ it, c, hx, hy, px, py, s, bb, r });
      }
      // 畫的順序：越下面（越靠近鏡頭）的越後畫，前面的建築才會擋住後面的；順序沒變就不動 DOM
      const order = vis.slice().sort((a, b) => a.py - b.py);
      const key = order.map((v) => v.c.rk).join(',');
      if (key !== lastOrder) { lastOrder = key; order.forEach((v) => root.insertBefore(v.it.g, lab)); }
      const signs = [];
      for (const v of vis) {
        const { it, c, hx, hy, px, py, s, bb, r } = v;
        out.push({ ...r, an: true });
        const moved = Math.hypot(px - hx, py - hy) > 1;
        setA(it.g, 'transform', `translate(${f1(hx)},${f1(hy)})`);
        setA(it.body, 'transform', `translate(${f1(px - hx)},${f1(py - hy)})`);
        setA(it.lg, 'transform', `translate(${f1(px)},${f1(py)})`);
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

  /* ---------- 排行資料 ---------- */
  let feedTop = null;
  // 套用最新排行（tw-top.json：{ date, top: [{ rk, s, name, cap, p, c, pct, ind }] }）：更新市值與名次。
  // 排行裡沒有設計過建築的公司只會出現在清單；要幫新公司蓋建築，在 CORPS 加一筆（含 kind 與 ART 造型）
  function applyFeed(feed) {
    if (!feed || !Array.isArray(feed.top) || feed.top.length < TOP_SHOWN) return false;
    feedTop = feed.top;
    const by = new Map(feed.top.map((t) => [String(t.s), t]));
    for (const c of CORPS) {
      const t = by.get(c.s);
      if (!t) continue;
      c.cap = t.cap; c.rk = t.rk; c.p = t.p; c.pct = t.pct;
    }
    if (feed.date) dataDate = feed.date;
    live = true;
    // 已經建好的招牌跟著換名次
    for (const it of items) {
      const t = it.sign && it.sign.querySelector('.rkt');
      if (t) t.textContent = it.c.rk;
      it.g.setAttribute('aria-label', `${it.c.name}（市值第 ${it.c.rk} 名）`);
    }
    lastOrder = '';
    return true;
  }
  // 前十大清單（詳情卡用）：有最新排行就用排行，沒有就用內建資料；built 表示地圖上有這家的建築
  function topList() {
    const byS = new Map(CORPS.map((c) => [c.s, c]));
    const src = feedTop ? feedTop.slice(0, TOP_SHOWN) : CORPS.slice().sort((a, b) => a.rk - b.rk);
    return src.map((t) => {
      const c = byS.get(String(t.s));
      return { rk: t.rk, s: String(t.s), name: c ? c.name : t.name, cap: c ? c.cap : t.cap, ind: c ? c.ind : t.ind || '', pct: t.pct, c: c || null };
    });
  }

  window.Corps = {
    CORPS, build, layout, applyFeed, topList, BOOM, CRASH,
    get DATA_DATE() { return dataDate; },
    get LIVE() { return live; }
  };
})();
