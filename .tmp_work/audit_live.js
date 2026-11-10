// 直接解析「現在」的 site/app.js CRITTERS 清單，用跟 app.js 完全一致的 Mercator 投影公式，
// 在常見桌機/手機尺寸、k=1..40 的縮放範圍內，模擬「地標碰撞收起」規則，找出：
//   (a) k=1（預設視角）就被永久擋住、且要放大很多才會出現的地標
//   (b) 整個 k=1..40 都不會出現的地標（徹底壞掉）
const d3geo = require('d3-geo');
const fs = require('fs');
const path = require('path');
const appJsPath = path.join(__dirname, '..', 'site', 'app.js');
const src = fs.readFileSync(appJsPath, 'utf8');

const startIdx = src.indexOf('const CRITTERS = [');
if (startIdx === -1) throw new Error('CRITTERS not found');
let depth = 0, i = src.indexOf('[', startIdx), bodyStart = i + 1, end = -1;
for (; i < src.length; i++) {
    if (src[i] === '[') depth++;
    else if (src[i] === ']') { depth--; if (depth === 0) { end = i; break; } }
}
const body = src.slice(bodyStart, end);
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
    landmarks.push({ src: src_, lon, lat, s: s === undefined ? 1 : s });
}
console.log('共找到', landmarks.length, '個 landmark:true 地標（來自目前的 app.js）');

const VIEW_N = 80, VIEW_S = -58;
const GLOBAL_LEFT_LON = -155;
const sizes = [[1366,768],[1440,820],[1536,864],[1600,900],[1920,1080],[390,844],[414,896]]; // 常見桌機 + 手機尺寸

function makeProj(W, H) {
    const unit = d3geo.geoMercator().scale(1 / (2 * Math.PI)).translate([0.5, 0.5]);
    const yN = unit([0, VIEW_N])[1], yS = unit([0, VIEW_S])[1];
    const S0 = Math.max(W, H / (yS - yN));
    const projection = d3geo.geoMercator().scale(S0 / (2 * Math.PI)).translate([S0 / 2, S0 / 2]);
    const tx0 = -projection([GLOBAL_LEFT_LON, 0])[0];
    const ty0 = H - projection([0, VIEW_S])[1];
    return function screenXY(lon, lat, k) {
        const p = projection([lon, lat]);
        let x = p[0] * k + tx0 * k - (tx0 * k - tx0); // placeholder, fixed below
        return p;
    };
}
// 正確版：translate 是在 k=1 時定好的常數 tx0,ty0，縮放時 t.applyX(px)=px*k+tx*k? 需對照 d3.zoom 實際語意：
// d3 zoomIdentity.translate(tx,ty).scale(k) 的 applyX(x) = x*k + tx*k？不對，d3 zoom transform.apply 是 x*k+tx （translate 在 scale 之後套用的常數位移，不隨 k 再乘）
// 查看 app.js：zoomB.translateExtent 搭配 d3.zoomIdentity.translate(tx,ty) 是初始 transform（k=1 時），之後使用者縮放時 t.k 改變、t.x/t.y 也會由 d3-zoom 自己依游標位置重新計算，
// 不是單純 tx*k。為了這個稽核目的，我們只關心「世界固定不動、使用者原地放大（以畫面中心為錨點）」這種近似：
//   screenX(k) ≈ (projX - cx) * k + cx，cy 同理，cx,cy 用畫面中心近似游標錨點。
function makeProj2(W, H) {
    const unit = d3geo.geoMercator().scale(1 / (2 * Math.PI)).translate([0.5, 0.5]);
    const yN = unit([0, VIEW_N])[1], yS = unit([0, VIEW_S])[1];
    const S0 = Math.max(W, H / (yS - yN));
    const projection = d3geo.geoMercator().scale(S0 / (2 * Math.PI)).translate([S0 / 2, S0 / 2]);
    const tx0 = -projection([GLOBAL_LEFT_LON, 0])[0];
    const ty0 = H - projection([0, VIEW_S])[1];
    function baseXY(lon, lat) {
        const p = projection([lon, lat]);
        let x = p[0] + tx0;
        if (x < -40) x += S0;
        return [x, p[1] + ty0];
    }
    const cx = W / 2, cy = H / 2;
    return function screenXY(lon, lat, k) {
        const [x0, y0] = baseXY(lon, lat);
        return [(x0 - cx) * k + cx, (y0 - cy) * k + cy];
    };
}

function csz(k) { return Math.max(24, Math.min(44, 16 + k * 5)); }
function inter(a, b) {
    const x1 = Math.max(a.x, b.x), y1 = Math.max(a.y, b.y);
    const x2 = Math.min(a.x + a.w, b.x + b.w), y2 = Math.min(a.y + a.h, b.y + b.h);
    const w = Math.max(0, x2 - x1), h = Math.max(0, y2 - y1);
    return w * h;
}

const FOLK_MAX_K = 40;
const results = [];
for (let idx = 0; idx < landmarks.length; idx++) {
    const lm = landmarks[idx];
    let everVisible = false, minOverlapFrac = Infinity, visibleFromK = null;
    outer:
    for (let k = 1; k <= FOLK_MAX_K; k += 0.5) {
        for (const [W, H] of sizes) {
            const screenXY = makeProj2(W, H);
            const placed = [];
            for (let j = 0; j < idx; j++) {
                const [x, y] = screenXY(landmarks[j].lon, landmarks[j].lat, k);
                const z = csz(k) * landmarks[j].s;
                const bj = { x: x - z * 0.5, y: y - z, w: z, h: z };
                const hiddenJ = placed.some((q) => inter(bj, q) / (bj.w * bj.h) > 0.55);
                if (!hiddenJ) placed.push(bj);
            }
            const [xi, yi] = screenXY(lm.lon, lm.lat, k);
            const zi = csz(k) * lm.s;
            const bi = { x: xi - zi * 0.5, y: yi - zi, w: zi, h: zi };
            let maxFrac = 0;
            for (const q of placed) { const f = inter(bi, q) / (bi.w * bi.h); if (f > maxFrac) maxFrac = f; }
            if (maxFrac <= 0.55) { everVisible = true; if (visibleFromK === null || k < visibleFromK) visibleFromK = k; }
            if (maxFrac < minOverlapFrac) minOverlapFrac = maxFrac;
        }
        if (everVisible) break outer;
    }
    results.push({ lm, everVisible, minOverlapFrac, visibleFromK });
}

const broken = results.filter((r) => !r.everVisible);
console.log('\n=== k=1..40、各常見尺寸下，全程都被擋住（永遠不會顯示）的地標 ===');
for (const r of broken) console.log(`  ${r.lm.src}  (lon=${r.lm.lon}, lat=${r.lm.lat}, s=${r.lm.s})  最低重疊比=${r.minOverlapFrac.toFixed(2)}`);
console.log('共', broken.length, '個');

console.log('\n=== 要放大到 k>=4 才會出現的地標（一般玩家在預設視角幾乎看不到）===');
const slow = results.filter((r) => r.everVisible && r.visibleFromK >= 4);
for (const r of slow.sort((a, b) => b.visibleFromK - a.visibleFromK)) console.log(`  ${r.lm.src}  (lon=${r.lm.lon}, lat=${r.lm.lat})  需要 k>=${r.visibleFromK}`);
console.log('共', slow.length, '個');
