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
function inter(a, b) {
    const x1 = Math.max(a.x, b.x), y1 = Math.max(a.y, b.y);
    const x2 = Math.min(a.x + a.w, b.x + b.w), y2 = Math.min(a.y + a.h, b.y + b.h);
    return Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
}

const targets = ['kaminarimon-lantern', 'n-seoul-tower', 'wat-arun', 'brandenburg-gate', 'dead-sea', 'burj-al-arab', 'osaka-castle'];
for (const t of targets) {
    const idx = landmarks.findIndex((l) => l.src.includes(t));
    if (idx === -1) { console.log(t, 'NOT FOUND'); continue; }
    const blockers = new Set();
    for (const [W, H] of sizes) {
        const fn = makeProj2(W, H);
        const placed = [];
        for (let j = 0; j < idx; j++) {
            const [x, y] = fn(landmarks[j].lon, landmarks[j].lat, 1);
            const z = csz(1) * landmarks[j].s;
            const bj = { x: x - z * 0.5, y: y - z, w: z, h: z };
            const hid = placed.some((q) => inter(bj, q.r) / (bj.w * bj.h) > 0.55);
            if (!hid) placed.push({ src: landmarks[j].src, r: bj });
        }
        const lm = landmarks[idx];
        const [xi, yi] = fn(lm.lon, lm.lat, 1);
        const zi = csz(1) * lm.s;
        const bi = { x: xi - zi * 0.5, y: yi - zi, w: zi, h: zi };
        for (const q of placed) {
            const f = inter(bi, q.r) / (bi.w * bi.h);
            if (f > 0.55) blockers.add(q.src + ' @' + W + 'x' + H + ' frac=' + f.toFixed(2));
        }
    }
    console.log(landmarks[idx].src, '(', landmarks[idx].lon, landmarks[idx].lat, ')');
    for (const b of blockers) console.log('   blocked by', b);
}
