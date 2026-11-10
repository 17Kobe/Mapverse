// 盤點 app.js 的 CRITTERS 清單：找出在正常縮放範圍內，因為跟「先放進陣列」的另一個地標靠太近、
// 永遠被 55% 重疊規則遮住（跟天壇被紫禁城遮住一樣）的地標。
const fs = require('fs');
const path = require('path');
const appJsPath = path.join(__dirname, '..', 'site', 'app.js');
const src = fs.readFileSync(appJsPath, 'utf8');

// 找到 CRITTERS 陣列本體（從 "const CRITTERS = [" 到對應的 "];"）
const startIdx = src.indexOf('const CRITTERS = [');
if (startIdx === -1) throw new Error('CRITTERS not found');
// 用括號配對找結尾
let depth = 0, i = src.indexOf('[', startIdx), bodyStart = i + 1, end = -1;
for (; i < src.length; i++) {
    if (src[i] === '[') depth++;
    else if (src[i] === ']') { depth--; if (depth === 0) { end = i; break; } }
}
const body = src.slice(bodyStart, end);

// 用括號配對切出每個 { ... } 物件
const entries = [];
{
    let d = 0, s = -1;
    for (let p = 0; p < body.length; p++) {
        if (body[p] === '{') { if (d === 0) s = p; d++; }
        else if (body[p] === '}') { d--; if (d === 0 && s !== -1) { entries.push(body.slice(s, p + 1)); s = -1; } }
    }
}

function field(obj, name, isNum = true) {
    const re = new RegExp(name + "\\s*:\\s*('([^']*)'|[-\\d.]+)");
    const m = obj.match(re);
    if (!m) return undefined;
    if (!isNum) return m[2];
    return m[1].startsWith("'") ? m[2] : parseFloat(m[1]);
}

const landmarks = [];
for (const e of entries) {
    if (!/landmark\s*:\s*true/.test(e)) continue;
    const src_ = field(e, 'src', false);
    const lon = field(e, 'lon');
    const lat = field(e, 'lat');
    const s = field(e, 's');
    if (lon === undefined || lat === undefined) continue;
    landmarks.push({ src: src_, lon, lat, s: s === undefined ? 1 : s, order: landmarks.length });
}
console.log('共找到', landmarks.length, '個 landmark:true 地標');
landmarks.forEach((l, idx) => {
    if (/temple-of-heaven|forbidden-city|great-wall/.test(l.src)) console.log('DEBUG', idx, l.src, l.lon, l.lat, l.s);
});

// ---- Mercator 投影（複製 app.js 的作法）----
const VIEW_N = 80, VIEW_S = -58;
function unitXY(lon, lat) {
    const x = lon / 360 + 0.5;
    const latRad = (lat * Math.PI) / 180;
    const y = -Math.log(Math.tan(Math.PI / 4 + latRad / 2)) / (2 * Math.PI) + 0.5;
    return [x, y];
}
const yN = unitXY(0, VIEW_N)[1];
const yS = unitXY(0, VIEW_S)[1];
const W = 1400, H = 850; // 一般桌面視窗尺寸的估計值
const S0 = Math.max(W, H / (yS - yN));
function proj(lon, lat) {
    const [ux, uy] = unitXY(lon, lat);
    return [ux * S0, uy * S0];
}

function csz(k) { return Math.max(24, Math.min(44, 16 + k * 5)); }

function inter(a, b) {
    const x1 = Math.max(a.x, b.x), y1 = Math.max(a.y, b.y);
    const x2 = Math.min(a.x + a.w, b.x + b.w), y2 = Math.min(a.y + a.h, b.y + b.h);
    const w = Math.max(0, x2 - x1), h = Math.max(0, y2 - y1);
    return w * h;
}

function box(lm, k) {
    const [x, y] = proj(lm.lon, lm.lat);
    const z = csz(k) * lm.s;
    const px = x * k, py = y * k; // t.applyX/Y with translate 不影響相對距離，可設 translate=0
    return { x: px - z * 0.5, y: py - z, w: z, h: z };
}

const FOLK_MAX_K = 40;
// 對每個地標，從 k=1 掃到 k=FOLK_MAX_K，看它是否在整段範圍內都被「先放進陣列、且還沒被自己擋住」的地標擋住
const results = [];
for (let idx = 0; idx < landmarks.length; idx++) {
    const lm = landmarks[idx];
    let everVisible = false;
    let minOverlapFrac = Infinity;
    let blockerAtMin = null;
    let visibleFromK = null;
    for (let k = 1; k <= FOLK_MAX_K; k += 0.25) {
        // 重新模擬：依序處理 0..idx-1，决定哪些真的被放進 lmPlaced（遞迴依賴前面是否被擋）
        const placed = [];
        for (let j = 0; j < idx; j++) {
            const bj = box(landmarks[j], k);
            const hiddenJ = placed.some((q) => inter(bj, q) / (bj.w * bj.h) > 0.55);
            if (!hiddenJ) placed.push(bj);
        }
        const bi = box(lm, k);
        let maxFrac = 0, blocker = -1;
        for (let j = 0; j < placed.length; j++) {
            const f = inter(bi, placed[j]) / (bi.w * bi.h);
            if (f > maxFrac) { maxFrac = f; }
        }
        if (maxFrac <= 0.55) { everVisible = true; if (visibleFromK === null) visibleFromK = k; break; }
        if (maxFrac < minOverlapFrac) minOverlapFrac = maxFrac;
    }
    results.push({ lm, everVisible, minOverlapFrac, visibleFromK });
    if (/temple-of-heaven|forbidden-city|n-seoul-tower|gyeongbokgung/.test(lm.src))
        console.log('DEBUG2', lm.src, 'everVisible=', everVisible, 'visibleFromK=', visibleFromK, 'minOverlapFrac=', minOverlapFrac);
}

const broken = results.filter((r) => !r.everVisible);
console.log('\n=== 在 k=1..40 全程都被擋住（永遠不會真正顯示）的地標 ===');
for (const r of broken) {
    console.log(`  ${r.lm.src}  (lon=${r.lm.lon}, lat=${r.lm.lat}, s=${r.lm.s})  最低重疊比=${r.minOverlapFrac.toFixed(2)}`);
}
console.log('\n共', broken.length, '個');

console.log('\n=== 要放大到 k>=8 才會出現的地標（實際上很難被玩家看到）===');
const slow = results.filter((r) => r.everVisible && r.visibleFromK >= 8);
for (const r of slow.sort((a,b)=>b.visibleFromK-a.visibleFromK)) {
    console.log(`  ${r.lm.src}  (lon=${r.lm.lon}, lat=${r.lm.lat})  需要 k>=${r.visibleFromK}`);
}
console.log('共', slow.length, '個');
