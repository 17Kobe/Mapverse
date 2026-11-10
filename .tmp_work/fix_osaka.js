const d3geo = require('d3-geo');
const topojson = require('topojson-client');
const fs = require('fs');
const path = require('path');
const topo = JSON.parse(fs.readFileSync(path.join(__dirname, 'countries-50m.json'), 'utf8'));
const countries = topojson.feature(topo, topo.objects.countries).features;
function landName(lon, lat) {
    const pt = [lon, lat];
    for (const f of countries) if (d3geo.geoContains(f, pt)) return f.properties.name;
    return null;
}

const appJsPath = path.join(__dirname, '..', 'site', 'app.js');
const src = fs.readFileSync(appJsPath, 'utf8');
const startIdx = src.indexOf('const CRITTERS = [');
let depth = 0, i = src.indexOf('[', startIdx), bodyStart = i + 1, end = -1;
for (; i < src.length; i++) { if (src[i] === '[') depth++; else if (src[i] === ']') { depth--; if (depth === 0) { end = i; break; } } }
const body = src.slice(bodyStart, end);
const entries = [];
{ let d = 0, s = -1; for (let p = 0; p < body.length; p++) { if (body[p] === '{') { if (d === 0) s = p; d++; } else if (body[p] === '}') { d--; if (d === 0 && s !== -1) { entries.push(body.slice(s, p + 1)); s = -1; } } } }
function field(obj, name, isNum = true) { const re = new RegExp(name + "\\s*:\\s*('([^']*)'|[-\\d.]+)"); const m = obj.match(re); if (!m) return undefined; if (!isNum) return m[2]; return m[1].startsWith("'") ? m[2] : parseFloat(m[1]); }
const landmarks = [];
for (const e of entries) {
    if (!/landmark\s*:\s*true/.test(e)) continue;
    const src_ = field(e, 'src', false), lon = field(e, 'lon'), lat = field(e, 'lat'), s = field(e, 's');
    if (lon === undefined || lat === undefined) continue;
    landmarks.push({ src: src_, lon, lat, s: s === undefined ? 1 : s, raw: e, sea: /sea\s*:\s*true/.test(e) });
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
function visibleFromK(coords, idx) { for (let k = 1; k <= 20; k += 0.5) if (worstFrac(coords, idx, k) <= 0.55) return k; return Infinity; }

const coords = landmarks.map((l) => [l.lon, l.lat]);

function fixWithLandConstraint(target, requireLand) {
    const idx = landmarks.findIndex((l) => l.src.includes(target));
    const [lon0, lat0] = coords[idx];
    let best = null;
    for (let radius = 0.2; radius <= 1.51; radius += 0.1) {
        for (let ang = 0; ang < 360; ang += 10) {
            const rad = (ang * Math.PI) / 180;
            const cand = [lon0 + Math.cos(rad) * radius, lat0 + Math.sin(rad) * radius];
            const name = landName(cand[0], cand[1]);
            const okLand = requireLand ? !!name : true;
            if (!okLand) continue;
            const save = coords[idx];
            coords[idx] = cand;
            const k = visibleFromK(coords, idx);
            coords[idx] = save;
            if (k <= 2 && (!best || radius < best.radius)) { best = { cand, radius, k, name }; }
        }
        if (best) break;
    }
    if (best) coords[idx] = best.cand;
    console.log(target, '->', best ? `(${best.cand[0].toFixed(3)},${best.cand[1].toFixed(3)}) land=${best.name} k=${best.k} r=${best.radius.toFixed(2)}` : 'FAIL');
    return best;
}

const r1 = fixWithLandConstraint('osaka-castle', true);
const r2 = fixWithLandConstraint('wat-arun', false); // 保留原邏輯但之後人工挑水邊的點

let newSrc = src;
function applyFix(target, cand) {
    if (!cand) return;
    const idx = landmarks.findIndex((l) => l.src.includes(target));
    const lm = landmarks[idx];
    const rawNew = lm.raw
        .replace(/lon:\s*-?\d+\.?\d*/, 'lon: ' + (Math.round(cand[0] * 1000) / 1000))
        .replace(/lat:\s*-?\d+\.?\d*/, 'lat: ' + (Math.round(cand[1] * 1000) / 1000));
    const count = (newSrc.match(new RegExp(lm.raw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
    if (count !== 1) { console.log('WARN anchor not unique', target); return; }
    newSrc = newSrc.replace(lm.raw, rawNew);
}
applyFix('osaka-castle', r1 && r1.cand);
fs.writeFileSync(path.join(__dirname, 'osaka_fix_preview.js'), newSrc, 'utf8');
