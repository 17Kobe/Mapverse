const d3geo = require('d3-geo');
const fs = require('fs');
const landmarks = JSON.parse(fs.readFileSync('landmarks.json','utf8'));
const VIEW_N = 80, VIEW_S = -58;
const GLOBAL_LEFT_LON = -155;
const sizes = [[1200,700],[1366,768],[1440,820],[1600,900],[1920,1080],[1920,1200]];

function proj(W,H){
  const unit = d3geo.geoMercator().scale(1/(2*Math.PI)).translate([0.5,0.5]);
  const yN = unit([0, VIEW_N])[1], yS = unit([0, VIEW_S])[1];
  const S0 = Math.max(W, H/(yS-yN));
  const projection = d3geo.geoMercator().scale(S0/(2*Math.PI)).translate([S0/2, S0/2]);
  const k=1;
  const tx = -projection([GLOBAL_LEFT_LON, 0])[0];
  const ty = H - projection([0, VIEW_S])[1];
  return function screenXY(lon, lat) {
    const p = projection([lon, lat]);
    let x = p[0]*k + tx;
    if (x < -40) x += S0*k;
    const y = p[1]*k + ty;
    return [x, y];
  };
}
const projs = sizes.map(([W,H])=>({W,H,fn:proj(W,H)}));
const csz = Math.max(24, Math.min(44, 16 + 1*5));

function inter(a,b){const x1=Math.max(a.x,b.x),y1=Math.max(a.y,b.y),x2=Math.min(a.x+a.w,b.x+b.w),y2=Math.min(a.y+a.h,b.y+b.h);return Math.max(0,x2-x1)*Math.max(0,y2-y1);}

// returns true if, using given coordinate overrides, item at index idx is NOT hidden in ANY tested size
function checkVisible(coords, idx){
  for(const {W,H,fn} of projs){
    const lmPlaced = [];
    let hiddenAtThisSize = false;
    for(let i=0;i<landmarks.length;i++){
      const lon = coords[i] ? coords[i][0] : landmarks[i].lon;
      const lat = coords[i] ? coords[i][1] : landmarks[i].lat;
      const z = csz*(landmarks[i].s||1);
      const [x,y] = fn(lon,lat);
      const lr = {x:x-z*0.5,y:y-z,w:z,h:z};
      const outOfView = x < -csz*3 || x > W + csz*3 || y < -csz*2 || y > H + csz*2;
      const overlapped = lmPlaced.some(q=>inter(lr,q)/(lr.w*lr.h)>0.55);
      if(i===idx && overlapped) hiddenAtThisSize = true;
      if(!overlapped && !outOfView) lmPlaced.push(lr);
      if(i===idx) break; // only need up to idx since placement order matters only for earlier items
    }
    if(hiddenAtThisSize) return false;
  }
  return true;
}

// find all currently-hidden indices (robust across sizes) using default coords
const coordsBase = landmarks.map(d=>[d.lon,d.lat]);
let hiddenIdx = [];
for(let i=0;i<landmarks.length;i++){
  if(!checkVisible(coordsBase, i)) hiddenIdx.push(i);
}
console.log('initially hidden (any size):', hiddenIdx.length);

// iterative fix: process in array order, nudge away from nearest earlier landmark
let coords = coordsBase.map(c=>c.slice());
const nudgeLog = [];
for(const idx of hiddenIdx){
  const [lon0,lat0] = coordsBase[idx];
  // find nearest earlier landmark (by lon/lat euclidean) as the likely blocker direction reference
  let best=null,bestDist=Infinity;
  for(let j=0;j<idx;j++){
    const dx = coordsBase[j][0]-lon0, dy=coordsBase[j][1]-lat0;
    const dist = Math.hypot(dx,dy);
    if(dist<bestDist){bestDist=dist; best=j;}
  }
  let dx = lon0 - coords[best][0], dy = lat0 - coords[best][1];
  let len = Math.hypot(dx,dy);
  let ux,uy;
  if(len < 1e-6){ ux=0.3; uy=0.95; } // default: nudge south-east-ish if exactly same point
  else { ux = dx/len; uy = dy/len; }
  let factor = 0.3;
  let ok=false;
  for(let iter=0; iter<40; iter++){
    const cand = [lon0 + ux*factor, lat0 + uy*factor];
    coords[idx] = cand;
    if(checkVisible(coords, idx)){ ok=true; break; }
    factor += 0.3;
  }
  nudgeLog.push({src: landmarks[idx].src, from:[lon0,lat0], to: coords[idx], ok, blocker: landmarks[best].src});
}
fs.writeFileSync('nudge_log.json', JSON.stringify(nudgeLog,null,1));
nudgeLog.forEach(n=>console.log((n.ok?'OK  ':'FAIL'), n.src.padEnd(30), n.from.map(v=>v.toFixed(2)).join(','), '->', n.to.map(v=>v.toFixed(2)).join(','), ' (was blocked by', n.blocker+')'));
