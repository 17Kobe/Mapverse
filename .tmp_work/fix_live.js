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
console.log('共', landmarks.length, '個地標');

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
const projs = sizes.map(([W, H]) => ({ W, H, fn: makeProj2(W, H) }));
const csz = Math.max(24, Math.min(44, 16 + 1 * 5));
function inter(a, b) { const x1 = Math.max(a.x, b.x), y1 = Math.max(a.y, b.y), x2 = Math.min(a.x + a.w, b.x + b.w), y2 = Math.min(a.y + a.h, b.y + b.h); return Math.max(0, x2 - x1) * Math.max(0, y2 - y1); }

function checkVisible(coords, idx) {
    for (const { fn } of projs) {
        const placed = [];
        let hidden = false;
        for (let i2 = 0; i2 <= idx; i2++) {
            const lon = coords[i2][0], lat = coords[i2][1];
            const z = csz * (landmarks[i2].s || 1);
            const [x, y] = fn(lon, lat, 1);
            const lr = { x: x - z * 0.5, y: y - z, w: z, h: z };
            const overlapped = placed.some((q) => inter(lr, q) / (lr.w * lr.h) > 0.55);
            if (i2 === idx && overlapped) hidden = true;
            if (!overlapped) placed.push(lr);
        }
        if (hidden) return false;
    }
    return true;
}

const coordsBase = landmarks.map((d) => [d.lon, d.lat]);
let hiddenIdx = [];
for (let idx = 0; idx < landmarks.length; idx++) if (!checkVisible(coordsBase, idx)) hiddenIdx.push(idx);
console.log('目前在常見尺寸 k=1 會被擋住的地標數:', hiddenIdx.length);
hiddenIdx.forEach((idx) => console.log('  -', landmarks[idx].src, landmarks[idx].lon, landmarks[idx].lat));

let coords = coordsBase.map((c) => c.slice());
const fixes = [];
for (const idx of hiddenIdx) {
    const [lon0, lat0] = coordsBase[idx];
    let found = null;
    for (let radius = 0.3; radius <= 4.01 && !found; radius += 0.2) {
        for (let ang = 0; ang < 360 && !found; ang += 15) {
            const rad = (ang * Math.PI) / 180;
            const cand = [lon0 + Math.cos(rad) * radius, lat0 + Math.sin(rad) * radius * 0.7];
            coords[idx] = cand;
            if (checkVisible(coords, idx)) found = cand;
        }
    }
    if (!found) { coords[idx] = [lon0, lat0]; fixes.push({ idx, src: landmarks[idx].src, ok: false }); }
    else fixes.push({ idx, src: landmarks[idx].src, ok: true, from: [lon0, lat0], to: found });
}
fixes.forEach((f) => console.log(f.ok ? 'OK  ' : 'FAIL', f.src.padEnd(30), f.ok ? `(${f.from[0]},${f.from[1]}) -> (${f.to[0].toFixed(3)},${f.to[1].toFixed(3)})` : ''));
fs.writeFileSync(path.join(__dirname, 'fix_live_result.json'), JSON.stringify(fixes, null, 1));

// 寫回 app.js：針對每個 ok 的修正，用原始 raw 物件文字當 anchor，取代其中的 lon/lat
let newSrc = src;
for (const f of fixes) {
    if (!f.ok) continue;
    const lm = landmarks[f.idx];
    const rawOld = lm.raw;
    const rawNew = rawOld
        .replace(/lon:\s*-?\d+\.?\d*/, 'lon: ' + (Math.round(f.to[0] * 10000) / 10000))
        .replace(/lat:\s*-?\d+\.?\d*/, 'lat: ' + (Math.round(f.to[1] * 10000) / 10000));
    const count = (newSrc.match(new RegExp(rawOld.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
    if (count !== 1) { console.log('WARN: anchor not unique for', lm.src, 'count=', count); continue; }
    newSrc = newSrc.replace(rawOld, rawNew);
}
fs.writeFileSync(appJsPath, newSrc, 'utf8');
console.log('\n已寫回 app.js');
