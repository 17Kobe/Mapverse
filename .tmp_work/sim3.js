const d3geo = require('d3-geo');
const landmarks = require('./landmarks.json');
const VIEW_N = 80, VIEW_S = -58;
const GLOBAL_LEFT_LON = -155;
const W=1600,H=900;
const unit = d3geo.geoMercator().scale(1/(2*Math.PI)).translate([0.5,0.5]);
const yN = unit([0, VIEW_N])[1], yS = unit([0, VIEW_S])[1];
const S0 = Math.max(W, H/(yS-yN));
const projection = d3geo.geoMercator().scale(S0/(2*Math.PI)).translate([S0/2, S0/2]);
const k=1;
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
for (const d of landmarks) {
  const z = csz*(d.s||1);
  const [x,y]=screenXY(d.lon,d.lat);
  const lr={x:x-z*0.5,y:y-z,w:z,h:z};
  function inter(a,b){const x1=Math.max(a.x,b.x),y1=Math.max(a.y,b.y),x2=Math.min(a.x+a.w,b.x+b.w),y2=Math.min(a.y+a.h,b.y+b.h);return Math.max(0,x2-x1)*Math.max(0,y2-y1);}
  const blocker = lmPlaced.find(q=>inter(lr,q.lr)/(lr.w*lr.h)>0.55);
  if(!blocker) lmPlaced.push({src:d.src,lr});
  if(blocker) console.log(d.src.padEnd(30), '<-blocked by-', blocker.src, '  dist(lon,lat)=', d.lon,d.lat);
}
