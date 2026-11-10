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
    landmarks.push({ src: src_, lon, lat, s: s === undefined ? 1 : s, raw: e });
}

const VIEW_N = 80, VIEW_S = -58, GLOBAL_LEFT_LON = -155;
const sizes = [[1366,768],[1440,820],[1536,864],[1600,900],[1920,1080],[390,844],[414,896]];
function makeProj2(W, H) {
    const unit = d3geo.geoMercator().scale(1 / (2 * Math.PI)).translate([0.5, 0.5]);
    const yN = unit([0, VIEW_N])[1], yS = unit([0, VIEW_S])[1];
    const S0 = Math.max(W, H / (yS - yN));
    const projection = d3geo.geoMercator().scale(S0 / (2 * Math.PI)).translate([S0 / 2, S0 / 2]);
    const tx0 = -projection([GLOBAL_LEFT_LON, 0])[0], ty0 = H - projection([0, VIEW_S])[1];
    function baseXY(lon, lat) { const p = projection([lon, lat]); let x = p[0] + tx0; if (x < -40) x += S0; return [x, p[1] + ty0]; }
    const cx = W / 2, cy = H / 2;
    return function (lon, lat, k) { const [x0, y0] = baseXY(lon, lat); return [(x0 - cx) * k + cx, (y0 - cy) * k + cy]; };
}
function csz(k) { return Math.max(24, Math.min(44, 16 + k * 5)); }
function inter(a, b) { const x1 = Math.max(a.x, b.x), y1 = Math.max(a.y, b.y), x2 = Math.min(a.x + a.w, b.x + b.w), y2 = Math.min(a.y + a.h, b.y + b.h); return Math.max(0, x2 - x1) * Math.max(0, y2 - y1); }

function worstFrac(coords, idx, kTest) {
    let worst = 0;
    for (const [W, H] of sizes) {
        const fn = makeProj2(W, H);
        const placed = [];
        for (let j = 0; j < idx; j++) {
            const [x, y] = fn(coords[j][0], coords[j][1], kTest);
            const z = csz(kTest) * landmarks[j].s;
            const bj = { x: x - z * 0.5, y: y - z, w: z, h: z };
            const hid = placed.some((q) => inter(bj, q) / (bj.w * bj.h) > 0.55);
            if (!hid) placed.push(bj);
        }
        const [xi, yi] = fn(coords[idx][0], coords[idx][1], kTest);
        const zi = csz(kTest) * landmarks[idx].s;
        const bi = { x: xi - zi * 0.5, y: yi - zi, w: zi, h: zi };
        for (const q of placed) { const f = inter(bi, q) / (bi.w * bi.h); if (f > worst) worst = f; }
    }
    return worst;
}
function visibleFromK(coords, idx) {
    for (let k = 1; k <= 20; k += 0.5) if (worstFrac(coords, idx, k) <= 0.55) return k;
    return Infinity;
}

const targets = ['kaminarimon-lantern', 'n-seoul-tower', 'wat-arun', 'brandenburg-gate', 'dead-sea', 'burj-al-arab', 'osaka-castle'];
const coords = landmarks.map((l) => [l.lon, l.lat]);
const fixes = [];
for (const t of targets) {
    const idx = landmarks.findIndex((l) => l.src.includes(t));
    const [lon0, lat0] = coords[idx];
    const baselineK = visibleFromK(coords, idx);
    let best = { k: baselineK, cand: [lon0, lat0], radius: 0 };
    for (let radius = 0.2; radius <= 1.01; radius += 0.1) {
        for (let ang = 0; ang < 360; ang += 10) {
            const rad = (ang * Math.PI) / 180;
            const cand = [lon0 + Math.cos(rad) * radius, lat0 + Math.sin(rad) * radius];
            const save = coords[idx];
            coords[idx] = cand;
            const k = visibleFromK(coords, idx);
            if (k < best.k || (k === best.k && radius < best.radius)) best = { k, cand, radius };
            coords[idx] = save;
        }
        if (best.k <= 2) break; // 已經很夠好，不用再往外找
    }
    coords[idx] = best.cand;
    fixes.push({ idx, src: landmarks[idx].src, from: [lon0, lat0], to: best.cand, radius: best.radius, kBefore: baselineK, kAfter: best.k });
}
fixes.forEach((f) => console.log(
    f.src.padEnd(30),
    `(${f.from[0]},${f.from[1]}) k=${f.kBefore===Infinity?'inf':f.kBefore}`,
    '->',
    `(${f.to[0].toFixed(3)},${f.to[1].toFixed(3)}) k=${f.kAfter===Infinity?'inf':f.kAfter}`,
    `半徑=${f.radius.toFixed(2)}度`
));

let newSrc = src;
for (const f of fixes) {
    const lm = landmarks[f.idx];
    const rawOld = lm.raw;
    const rawNew = rawOld
        .replace(/lon:\s*-?\d+\.?\d*/, 'lon: ' + (Math.round(f.to[0] * 1000) / 1000))
        .replace(/lat:\s*-?\d+\.?\d*/, 'lat: ' + (Math.round(f.to[1] * 1000) / 1000));
    const count = (newSrc.match(new RegExp(rawOld.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
    if (count !== 1) { console.log('WARN: anchor not unique for', lm.src, 'count=', count); continue; }
    newSrc = newSrc.replace(rawOld, rawNew);
}
fs.writeFileSync(path.join(__dirname, 'targeted_fix2_preview.js'), newSrc, 'utf8');
console.log('\n已寫入 .tmp_work/targeted_fix2_preview.js（尚未覆寫 app.js，待確認）');
