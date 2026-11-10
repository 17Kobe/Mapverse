const d3geo = require('d3-geo');
const landmarks = require('./landmarks.json');

const VIEW_N = 80, VIEW_S = -58;
// pick a representative desktop viewport
const W = 1400, H = 820;

const unit = d3geo.geoMercator().scale(1/(2*Math.PI)).translate([0.5,0.5]);
const yN = unit([0, VIEW_N])[1], yS = unit([0, VIEW_S])[1];
const S0 = Math.max(W, H/(yS-yN));
const projection = d3geo.geoMercator().scale(S0/(2*Math.PI)).translate([S0/2, S0/2]);

console.log('S0=',S0,'yN=',yN,'yS=',yS,'yS-yN=',yS-yN);

// default desktop "all/game" view: k=1, tx = -projection([GLOBAL_LEFT_LON,0])[0], ty = H - projection([0,VIEW_S])[1]
const GLOBAL_LEFT_LON = -155; // from code comment: 西經155度
const k = 1;
const tx = -projection([GLOBAL_LEFT_LON, 0])[0];
const ty = H - projection([0, VIEW_S])[1];

function screenXY(lon, lat) {
  const p = projection([lon, lat]);
  let x = p[0]*k + tx;
  if (x < -40) x += S0*k;
  const y = p[1]*k + ty;
  return [x, y];
}

const csz = Math.max(24, Math.min(44, 16 + k*5));

const lmPlaced = [];
const results = [];
for (const d of landmarks) {
  const size = csz;
  const z = size * (d.s || 1);
  const [x0, y0] = screenXY(d.lon, d.lat);
  const x = x0, y = y0;
  const lr = { x: x - z*0.5, y: y - z, w: z, h: z };
  function inter(a,b){
    const x1=Math.max(a.x,b.x), y1=Math.max(a.y,b.y);
    const x2=Math.min(a.x+a.w,b.x+b.w), y2=Math.min(a.y+a.h,b.y+b.h);
    return Math.max(0,x2-x1)*Math.max(0,y2-y1);
  }
  const outOfView = x < -size*3 || x > W + size*3 || y < -size*2 || y > H + size*2;
  const overlapped = lmPlaced.some(q => inter(lr,q)/(lr.w*lr.h) > 0.55);
  const hide = outOfView || overlapped;
  if (!hide) lmPlaced.push(lr);
  results.push({src: d.src, lon: d.lon, lat: d.lat, x: x.toFixed(1), y: y.toFixed(1), outOfView, overlapped, hide});
}
require('fs').writeFileSync('sim_result.json', JSON.stringify(results, null, 1));
console.log('hidden by overlap:', results.filter(r=>r.overlapped).length);
console.log('out of view:', results.filter(r=>r.outOfView).length);
for (const r of results.filter(r=>r.overlapped)) console.log('OVERLAP-HIDDEN:', r.src, r.lon, r.lat);
for (const r of results.filter(r=>r.outOfView)) console.log('OUT-OF-VIEW:', r.src, r.lon, r.lat);
