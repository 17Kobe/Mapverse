// 針對目前仍「永遠被擋住」或「要放到很大 k 才會出現」的地標，在原始座標附近的環狀網格搜尋一個
// 全程（k=1..40，常見桌機/手機尺寸）都不會被擋住、且盡量在 k 很小時就可見的新座標。
// 只檢查「陣列順序排在它前面」的地標（跟 app.js 的實際規則一致：前面的地標位置不受影響）。
const d3geo = require('d3-geo');
const fs = require('fs');
const path = require('path');
const appJsPath = path.join(__dirname, '..', 'site', 'app.js');
const src = fs.readFileSync(appJsPath, 'utf8');

const startIdx = src.indexOf('const CRITTERS = [');
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

const VIEW_N = 80, VIEW_S = -58;
const GLOBAL_LEFT_LON = -155;
const sizes = [[1366,768],[1440,820],[1536,864],[1600,900],[1920,1080],[390,844],[414,896]];
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

// 評估「某個 idx 的地標」若放在 (lon,lat)，對照陣列中所有 index < idx 的地標（原始位置不變），
// 回傳 {visibleFromK, worstOverlap}；visibleFromK=null 表示永遠被擋住。
function evalCandidate(idx, lon, lat, s) {
    let visibleFromK = null, minOverlapFrac = Infinity;
    for (let k = 1; k <= FOLK_MAX_K; k += 0.5) {
        let okAll = true, maxFracAtK = 0;
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
            const [xi, yi] = screenXY(lon, lat, k);
            const zi = csz(k) * s;
            const bi = { x: xi - zi * 0.5, y: yi - zi, w: zi, h: zi };
            let maxFrac = 0;
            for (const q of placed) { const f = inter(bi, q) / (bi.w * bi.h); if (f > maxFrac) maxFrac = f; }
            maxFracAtK = Math.max(maxFracAtK, maxFrac);
            if (maxFrac > 0.55) okAll = false;
        }
        if (maxFracAtK < minOverlapFrac) minOverlapFrac = maxFracAtK;
        if (okAll && visibleFromK === null) visibleFromK = k;
    }
    return { visibleFromK, minOverlapFrac };
}

const targets = JSON.parse(fs.readFileSync(path.join(__dirname, 'targets.json'), 'utf8'));
const results = [];
for (const t of targets) {
    const idx = landmarks.findIndex((l) => l.src === t.src);
    if (idx === -1) { console.log('NOT FOUND', t.src); continue; }
    const lm = landmarks[idx];
    const base = evalCandidate(idx, lm.lon, lm.lat, lm.s);
    let best = { lon: lm.lon, lat: lm.lat, visibleFromK: base.visibleFromK, minOverlapFrac: base.minOverlapFrac };
    for (let radius = 0.15; radius <= (t.maxRadius || 3.0); radius += 0.15) {
        for (let ang = 0; ang < 360; ang += 10) {
            const rad = (ang * Math.PI) / 180;
            const cand = { lon: lm.lon + Math.cos(rad) * radius, lat: lm.lat + Math.sin(rad) * radius * 0.75 };
            const r = evalCandidate(idx, cand.lon, cand.lat, lm.s);
            const better =
                (r.visibleFromK !== null && (best.visibleFromK === null || r.visibleFromK < best.visibleFromK)) ||
                (r.visibleFromK !== null && best.visibleFromK !== null && r.visibleFromK === best.visibleFromK && r.minOverlapFrac < best.minOverlapFrac);
            if (better) best = { lon: cand.lon, lat: cand.lat, visibleFromK: r.visibleFromK, minOverlapFrac: r.minOverlapFrac };
        }
        if (best.visibleFromK !== null && best.visibleFromK <= 1) break; // 已經找到 k=1 就可見的理想解
    }
    results.push({ src: t.src, from: [lm.lon, lm.lat], fromResult: base, to: [+best.lon.toFixed(3), +best.lat.toFixed(3)], toResult: { visibleFromK: best.visibleFromK, minOverlapFrac: +best.minOverlapFrac.toFixed(3) } });
}
console.log(JSON.stringify(results, null, 1));
