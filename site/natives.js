/* 各國的原住民小人：該國主要指數上漲時歡呼跳舞、下跌時沮喪哭泣，平盤時散步、揮手、眨眼。
 *
 * 由 app.js 呼叫：
 *   Natives.FOLK        角色清單（每個角色一筆：market 是看哪個指數的漲跌，lon/lat 是位置，look 是外觀）
 *   Natives.markup(look, uid)  畫出一個角色的所有姿勢（SVG 字串，每個姿勢是一個 <g data-pose="…">）
 *   Natives.VIEWBOX     角色 SVG 的 viewBox
 *
 * 姿勢：idle / idleBlink（站著、眨眼）、wave1 / wave2（揮手）、cheerA / cheerB（歡呼，左右手交替）、
 *       sadA / sadB（沮喪、擦眼淚）。app.js 依漲跌挑姿勢輪流顯示，再加上跳躍 / 呼吸的位移。
 * 漲跌超過 2% 時，帶 class="big" 的元素（彩帶、閃電）才會顯示。
 *
 * 要推廣到其他國家：在 FOLK 加幾筆（market 填該國主指數代碼），外觀調 look 的顏色與頭飾就好。
 * 服飾請以該族群真實的傳統色彩與紋樣為靈感，保持友善、不要刻板化（不畫武器、不畫草裙）。
 */
(function () {
  const VIEWBOX = '0 -16 128 144';

  // 外觀範本：skin 膚色、top 上衣、trim 衣服上的菱形織紋兩色、pants 褲 / 裙、hair 頭髮、
  // gear 頭飾（feather 羽毛頭帶 / flower 花環 / band 織紋頭帶）、gearColors 頭飾顏色、
  // hairStyle（short 短髮 / long 長髮加辮子 / bob 娃娃頭）、skirt 是否穿裙、k 身高比例
  const LOOKS = {
    // 紅色菱形紋上衣 + 羽毛頭帶（泰雅、賽德克等族群的織紋常見紅 / 黑 / 白）
    red: {
      skin: ['#f3c397', '#d28f5c'], top: ['#d9483c', '#951f1b'], trim: ['#161616', '#fff6e0'],
      pants: ['#3b4060', '#252944'], hair: ['#2c2c36', '#0d0d13'],
      gear: 'feather', gearColors: ['#fff6e0', '#e24a3b', '#2f7fd1'], hairStyle: 'short', skirt: false, k: 1,
    },
    // 靛藍上衣 + 百合花環 + 長辮子（排灣族以百合花與華麗的織繡聞名）
    blue: {
      skin: ['#f0bb8e', '#cc8653'], top: ['#3a6cb8', '#1f3f7d'], trim: ['#ffd24d', '#fff6e0'],
      pants: ['#7a2f4b', '#511d33'], hair: ['#2a2430', '#0c0a10'],
      gear: 'flower', gearColors: ['#ffffff', '#ff9d2e', '#4caf50'], hairStyle: 'long', skirt: true, k: 0.96,
    },
    // 小朋友：綠色上衣 + 織紋頭帶
    green: {
      skin: ['#f5c79f', '#d7955f'], top: ['#3fa56b', '#216c43'], trim: ['#ffcf4a', '#e24a3b'],
      pants: ['#6a4a2f', '#442d1b'], hair: ['#302a2a', '#100c0c'],
      gear: 'band', gearColors: ['#e24a3b', '#ffcf4a', '#2f7fd1'], hairStyle: 'bob', skirt: false, k: 0.8,
    },
  };

  // 台灣：三位小人住在中央山脈東側，ox / oy 是相對於位置點的偏移（單位：小角色的基準大小）
  const FOLK = [
    { id: 'tw-1', market: '^TWII', lon: 121.3, lat: 23.4, ox: -0.95, oy: 0.1, s: 1.7, look: LOOKS.red, ph: 0 },
    { id: 'tw-2', market: '^TWII', lon: 121.3, lat: 23.4, ox: 0.15, oy: -0.1, s: 1.65, look: LOOKS.blue, ph: 1.7 },
    { id: 'tw-3', market: '^TWII', lon: 121.3, lat: 23.4, ox: 1.2, oy: 0.12, s: 1.4, look: LOOKS.green, ph: 3.1 },
  ];

  // 各姿勢：aL / aR = 左右手臂 [手肘, 手], front 表示手臂畫在頭的前面（擦眼淚）；
  // head = [旋轉角度, 往下偏移]；eyes：open / happy / sad / closed；mouth：smile / open / frown / wail；
  // tears：眼淚數量；fx：cheer（星星）/ rain（烏雲雨）
  const POSES = {
    idle: { aL: [[41, 82], [42, 97]], aR: [[87, 82], [86, 97]], head: [0, 0], eyes: 'open', mouth: 'smile' },
    idleBlink: { aL: [[41, 82], [42, 97]], aR: [[87, 82], [86, 97]], head: [0, 0], eyes: 'closed', mouth: 'smile' },
    wave1: { aL: [[41, 82], [42, 97]], aR: [[99, 76], [106, 56]], head: [-3, 0], eyes: 'open', mouth: 'smile' },
    wave2: { aL: [[41, 82], [42, 97]], aR: [[97, 72], [96, 52]], head: [-3, 0], eyes: 'happy', mouth: 'smile' },
    cheerA: { aL: [[32, 62], [26, 38]], aR: [[96, 62], [102, 38]], head: [0, -1], eyes: 'happy', mouth: 'open', fx: 'cheerA' },
    cheerB: { aL: [[28, 72], [13, 82]], aR: [[90, 54], [88, 28]], head: [-5, -1], eyes: 'happy', mouth: 'open', fx: 'cheerB' },
    sadA: { aL: [[43, 84], [54, 99]], aR: [[85, 84], [74, 99]], head: [6, 3], eyes: 'sad', mouth: 'frown', tears: 1, fx: 'rainA' },
    sadB: { aL: [[43, 84], [54, 99]], aR: [[94, 76], [78, 55]], head: [-4, 3], eyes: 'sad', mouth: 'wail', tears: 2, front: 'aR', fx: 'rainB' },
  };

  const STAR = 'M0 -6 L1.8 -1.8 L6 0 L1.8 1.8 L0 6 L-1.8 1.8 L-6 0 L-1.8 -1.8Z';

  function fx(kind) {
    if (kind === 'cheerA' || kind === 'cheerB') {
      const pts = kind === 'cheerA' ? [[18, 20, 1], [110, 14, 0.8], [8, 56, 0.7], [118, 50, 1]] : [[26, 8, 0.9], [102, 24, 1], [12, 38, 1], [116, 70, 0.7]];
      let s = pts.map(([x, y, k]) => `<path d="${STAR}" transform="translate(${x} ${y}) scale(${k})" fill="#ffe27a" stroke="#f5a623" stroke-width=".7"/>`).join('');
      // 漲超過 2%：多撒一把彩帶
      const conf = kind === 'cheerA'
        ? [[30, 6, '#ff5a5a', 20], [52, -6, '#4aa3ff', -30], [78, 0, '#ffd24d', 40], [98, -8, '#5ee08a', -20], [64, 6, '#ff8de0', 10]]
        : [[40, 2, '#ffd24d', -20], [60, -8, '#ff5a5a', 30], [86, 4, '#4aa3ff', -40], [106, -4, '#5ee08a', 15], [20, -2, '#ff8de0', 25]];
      s += `<g class="big">${conf.map(([x, y, c, r]) => `<rect x="${x}" y="${y}" width="6" height="3.2" rx="1" fill="${c}" transform="rotate(${r} ${x + 3} ${y + 1.6})"/>`).join('')}</g>`;
      return s;
    }
    if (kind === 'rainA' || kind === 'rainB') {
      const dy = kind === 'rainA' ? 0 : 6;
      let s = '<g transform="translate(64 -4)"><ellipse cx="-12" cy="2" rx="13" ry="8" fill="#8793a8"/><ellipse cx="6" cy="-2" rx="15" ry="9.5" fill="#9aa6bb"/><ellipse cx="17" cy="4" rx="11" ry="7" fill="#8793a8"/><rect x="-24" y="4" width="52" height="7" rx="3.5" fill="#8793a8"/></g>';
      for (const x of [48, 60, 72, 84]) s += `<line x1="${x}" y1="${10 + dy + (x % 3) * 2}" x2="${x - 2}" y2="${16 + dy + (x % 3) * 2}" stroke="#7cc7ff" stroke-width="2" stroke-linecap="round"/>`;
      // 跌超過 2%：閃電
      s += '<path class="big" d="M70 8 L61 22 L67 22 L62 34 L76 17 L69 17 Z" fill="#ffd84d" stroke="#e0a100" stroke-width=".8" stroke-linejoin="round"/>';
      return s;
    }
    return '';
  }

  // 一個姿勢的完整圖形
  function pose(look, p, id) {
    const P = POSES[p];
    const g = (n) => `${id}-${n}`;
    const U = (n) => `url(#${g(n)})`;
    const [tr, ty] = P.head;
    const arm = (a, side) => {
      const sx = side === 'L' ? 47 : 81;
      return `<path d="M${sx} 67 L${a[0][0]} ${a[0][1]}" stroke="${U('top')}" stroke-width="12" stroke-linecap="round" fill="none"/>` +
        `<path d="M${a[0][0]} ${a[0][1]} L${a[1][0]} ${a[1][1]}" stroke="${look.skin[1]}" stroke-width="9" stroke-linecap="round" fill="none"/>` +
        `<circle cx="${a[1][0]}" cy="${a[1][1]}" r="5.4" fill="${U('skin')}"/>`;
    };

    // 腿 / 裙
    let lower;
    if (look.skirt) {
      lower = `<rect x="52" y="100" width="10" height="20" rx="5" fill="${look.skin[1]}"/><rect x="66" y="100" width="10" height="20" rx="5" fill="${look.skin[1]}"/>` +
        `<path d="M44 94 Q64 89 84 94 L91 113 Q64 119 37 113 Z" fill="${U('pants')}"/>` +
        `<path d="M38 108 Q64 114 90 108 L91 113 Q64 119 37 113 Z" fill="${look.trim[0]}"/>` +
        `<path d="M40 110.5 l4 2.5 4 -2.5 4 2.5 4 -2.5 4 2.5 4 -2.5 4 2.5 4 -2.5 4 2.5 4 -2.5 4 2.5" fill="none" stroke="${look.trim[1]}" stroke-width="1.3"/>`;
    } else {
      lower = `<rect x="48" y="94" width="14" height="26" rx="6.5" fill="${U('pants')}"/><rect x="66" y="94" width="14" height="26" rx="6.5" fill="${U('pants')}"/>`;
    }
    const shoes = '<ellipse cx="55" cy="122" rx="9" ry="5" fill="#4a2f1f"/><ellipse cx="73" cy="122" rx="9" ry="5" fill="#4a2f1f"/>';

    // 上衣 + 菱形織紋 + 腰帶
    let diamonds = '';
    for (let r = 0; r < 2; r++)
      for (let i = 0; i < 6; i++) {
        const cx = 50 + i * 5.7 + (r ? 2.85 : 0),
          cy = 76 + r * 8;
        if (cx > 80) continue;
        diamonds += `<path d="M${cx} ${cy - 3.3} L${cx + 3} ${cy} L${cx} ${cy + 3.3} L${cx - 3} ${cy} Z" fill="${look.trim[(i + r) % 2]}"/>`;
      }
    const torso = `<path d="M46 64 Q64 58 82 64 L86 100 Q64 106 42 100 Z" fill="${U('top')}"/>` +
      `<path d="M44.5 71 Q64 66 83.5 71 L84 72.5 Q64 67.5 44 72.5 Z" fill="${look.trim[1]}" opacity=".85"/>` + diamonds +
      `<path d="M43 93 Q64 98 85 93 L85.5 99 Q64 104.5 42.5 99 Z" fill="${look.trim[0]}"/>`;

    // 頭
    const hairBack = look.hairStyle === 'long'
      ? `<path d="M40 34 Q34 62 44 72 L50 68 Q46 52 48 36 Z" fill="${U('hair')}"/><path d="M88 34 Q94 62 84 72 L78 68 Q82 52 80 36 Z" fill="${U('hair')}"/>` +
        `<ellipse cx="42" cy="76" rx="4.5" ry="6" fill="${U('hair')}"/><ellipse cx="86" cy="76" rx="4.5" ry="6" fill="${U('hair')}"/>` +
        `<rect x="38.5" y="70" width="7" height="3" rx="1.5" fill="${look.trim[0]}"/><rect x="82.5" y="70" width="7" height="3" rx="1.5" fill="${look.trim[0]}"/>`
      : look.hairStyle === 'bob'
        ? `<path d="M39 32 Q35 52 42 58 L52 54 L76 54 L86 58 Q93 52 89 32 Z" fill="${U('hair')}"/>`
        : '';
    const hairTop = look.hairStyle === 'short'
      ? `<path d="M39 38 Q35 12 64 11 Q93 12 89 38 Q85 24 64 23 Q43 24 39 38 Z" fill="${U('hair')}"/>`
      : `<path d="M39 40 Q35 11 64 10 Q93 11 89 40 Q86 24 64 22 Q42 24 39 40 Z" fill="${U('hair')}"/>`;

    // 頭飾
    const [c1, c2, c3] = look.gearColors;
    let gear = '';
    if (look.gear === 'feather') {
      gear = `<path d="M40 27 Q64 19 88 27 L88.5 33 Q64 25 39.5 33 Z" fill="${look.top[0]}"/>` +
        [0, 1, 2, 3, 4, 5, 6].map((i) => `<path d="M${46 + i * 6} 28.5 l2.6 2.2 l-2.6 2.2 l-2.6 -2.2 Z" fill="${look.trim[i % 2]}"/>`).join('') +
        // 一根帝王雉（台灣特有的黑長尾雉）的黑白橫紋長尾羽，插在頭帶側邊，底部繫一小撮紅色絨球
        `<g transform="translate(86 27) rotate(22)"><path d="M0 0 Q-7 -16 -1.5 -37 Q6.5 -18 0 0 Z" fill="#1d2a46" stroke="#0e1628" stroke-width=".6"/>` +
        [-9, -16.5, -24, -31].map((y) => `<path d="M-4.8 ${y} Q0 ${y - 2.4} 4.4 ${y}" stroke="${c1}" stroke-width="1.7" fill="none" stroke-linecap="round"/>`).join('') +
        `<path d="M0 -1 Q-1.5 -18 -0.6 -34" stroke="#0e1628" stroke-width=".7" fill="none"/><circle cx="0" cy="1.5" r="3.4" fill="${c2}"/></g>`;
    } else if (look.gear === 'flower') {
      const flower = (x, y, r) => `<g transform="translate(${x} ${y}) scale(${r})"><circle cx="0" cy="-3.4" r="3" fill="${c1}"/><circle cx="3.4" cy="0" r="3" fill="${c1}"/><circle cx="0" cy="3.4" r="3" fill="${c1}"/><circle cx="-3.4" cy="0" r="3" fill="${c1}"/><circle r="2.1" fill="${c2}"/></g>`;
      gear = `<path d="M41 28 Q64 15 87 28" fill="none" stroke="${c3}" stroke-width="3.4" stroke-linecap="round"/>` +
        [[45, 27, 0.8], [54, 21, 0.9], [64, 17.5, 1.05], [74, 21, 0.9], [83, 27, 0.8]].map(([x, y, r]) => flower(x, y, r)).join('') +
        `<ellipse cx="38.5" cy="30" rx="4" ry="2.3" fill="${c3}" transform="rotate(-35 38.5 30)"/><ellipse cx="89.5" cy="30" rx="4" ry="2.3" fill="${c3}" transform="rotate(35 89.5 30)"/>`;
    } else {
      gear = `<path d="M40 25 Q64 18 88 25 L88.5 31 Q64 24 39.5 31 Z" fill="${c1}"/>` +
        [0, 1, 2, 3, 4, 5, 6].map((i) => `<path d="M${46 + i * 6} 26.5 l2.4 2 l-2.4 2 l-2.4 -2 Z" fill="${i % 2 ? c2 : '#fff6e0'}"/>`).join('') +
        `<path d="M86 28 Q92 36 89 46" stroke="${c3}" stroke-width="2.6" fill="none" stroke-linecap="round"/><circle cx="89" cy="47" r="2.8" fill="${c2}"/>`;
    }

    // 眼睛 / 嘴
    const ink = '#2a1b14';
    const eyes = {
      open: [55, 73].map((x) => `<ellipse cx="${x}" cy="42" rx="3.1" ry="4" fill="${ink}"/><circle cx="${x - 1}" cy="40.4" r="1.2" fill="#fff"/>`).join(''),
      closed: [55, 73].map((x) => `<path d="M${x - 3.6} 42 Q${x} 45.2 ${x + 3.6} 42" stroke="${ink}" stroke-width="2.2" fill="none" stroke-linecap="round"/>`).join(''),
      happy: [55, 73].map((x) => `<path d="M${x - 3.8} 43.5 Q${x} 37.5 ${x + 3.8} 43.5" stroke="${ink}" stroke-width="2.6" fill="none" stroke-linecap="round"/>`).join(''),
      sad: [55, 73].map((x) => `<ellipse cx="${x}" cy="43" rx="3" ry="3.8" fill="${ink}"/><circle cx="${x - 1}" cy="41.6" r="1.5" fill="#fff"/><circle cx="${x + 1.2}" cy="44.4" r=".9" fill="#bfe6ff"/>`).join('') +
        `<path d="M49.5 37.5 L59 33.5" stroke="${ink}" stroke-width="2" stroke-linecap="round"/><path d="M78.5 37.5 L69 33.5" stroke="${ink}" stroke-width="2" stroke-linecap="round"/>`,
    }[P.eyes];
    const mouth = {
      smile: `<path d="M58 51 Q64 57 70 51" stroke="${ink}" stroke-width="2.2" fill="none" stroke-linecap="round"/>`,
      open: `<path d="M56 49.5 Q64 64 72 49.5 Z" fill="#7a2a2a"/><ellipse cx="64" cy="57" rx="3.6" ry="2.2" fill="#ff8a8a"/>`,
      frown: `<path d="M58 56.5 Q64 50.5 70 56.5" stroke="${ink}" stroke-width="2.2" fill="none" stroke-linecap="round"/>`,
      wail: '<ellipse cx="64" cy="55.5" rx="4" ry="5" fill="#7a2a2a"/><ellipse cx="64" cy="58" rx="2.6" ry="1.8" fill="#ff8a8a"/>',
    }[P.mouth];
    let tears = '';
    if (P.tears >= 1) tears += '<path d="M52 47 Q55.4 52 52 55 Q48.6 52 52 47Z" fill="#8fd3ff" stroke="#5aa9dd" stroke-width=".6"/>';
    if (P.tears >= 2) tears += '<path d="M76 47 Q79.4 52 76 55 Q72.6 52 76 47Z" fill="#8fd3ff" stroke="#5aa9dd" stroke-width=".6"/>';

    const head = `<g transform="translate(64 ${44 + ty}) rotate(${tr}) translate(-64 -44)">` +
      hairBack + `<rect x="58" y="56" width="12" height="11" fill="${look.skin[1]}"/>` +
      `<circle cx="40" cy="43" r="4.5" fill="${U('skin')}"/><circle cx="88" cy="43" r="4.5" fill="${U('skin')}"/>` +
      `<circle cx="64" cy="40" r="24.5" fill="${U('skin')}"/>` + hairTop + gear +
      '<ellipse cx="48.5" cy="49" rx="4.6" ry="3" fill="#ff7a7a" opacity=".32"/><ellipse cx="79.5" cy="49" rx="4.6" ry="3" fill="#ff7a7a" opacity=".32"/>' +
      eyes + mouth + tears + '</g>';

    const front = P.front ? arm(P[P.front], P.front === 'aL' ? 'L' : 'R') : '';
    const back = (P.front === 'aL' ? '' : arm(P.aL, 'L')) + (P.front === 'aR' ? '' : arm(P.aR, 'R'));
    return `<g data-pose="${p}" style="display:none">${fx(P.fx)}${lower}${shoes}${torso}${back}${head}${front}</g>`;
  }

  // 一個角色：定義漸層 + 所有姿勢。uid 要唯一（同一頁面有多個角色時 id 不能重複）
  function markup(look, uid) {
    const id = `nv-${uid}`;
    const lin = (n, c) => `<linearGradient id="${id}-${n}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c[0]}"/><stop offset="1" stop-color="${c[1]}"/></linearGradient>`;
    const defs = '<defs>' + lin('top', look.top) + lin('pants', look.pants) + lin('hair', look.hair) +
      `<radialGradient id="${id}-skin" cx=".38" cy=".3" r=".8"><stop offset="0" stop-color="${look.skin[0]}"/><stop offset="1" stop-color="${look.skin[1]}"/></radialGradient></defs>`;
    const k = look.k || 1;
    const body = Object.keys(POSES).map((p) => pose(look, p, id)).join('');
    return `${defs}<g transform="translate(64 124) scale(${k}) translate(-64 -124)">${body}</g>`;
  }

  window.Natives = { FOLK, LOOKS, VIEWBOX, markup, POSES: Object.keys(POSES) };
})();
