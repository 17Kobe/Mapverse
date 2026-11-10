const d3geo = require('d3-geo');
const fs = require('fs');
const landmarks = JSON.parse(fs.readFileSync('landmarks.json','utf8'));
const VIEW_N = 80, VIEW_S = -58;
const GLOBAL_LEFT_LON = -155;
const sizes = [[1366,768],[1440,820],[1600,900],[1920,1080]];
function proj(W,H){
  const unit = d3geo.geoMercator().scale(1/(2*Math.PI)).translate([0.5,0.5]);
  const yN = unit([0, VIEW_N])[1], yS = unit([0, VIEW_S])[1];
  const S0 = Math.max(W, H/(yS-yN));
  const projection = d3geo.geoMercator().scale(S0/(2*Math.PI)).translate([S0/2, S0/2]);
  const k=1;
  const tx = -projection([GLOBAL_LEFT_LON, 0])[0];
  const ty = H - projection([0, VIEW_S])[1];
  return function(lon, lat) {
    const p = projection([lon, lat]);
    let x = p[0]*k + tx;
    if (x < -40) x += S0*k;
    return [x, p[1]*k + ty];
  };
}
const projs = sizes.map(([W,H])=>({W,H,fn:proj(W,H)}));
const csz = 24;
function inter(a,b){const x1=Math.max(a.x,b.x),y1=Math.max(a.y,b.y),x2=Math.min(a.x+a.w,b.x+b.w),y2=Math.min(a.y+a.h,b.y+b.h);return Math.max(0,x2-x1)*Math.max(0,y2-y1);}
function checkVisible(coords, idx){
  for(const {W,H,fn} of projs){
    const lmPlaced=[]; let hidden=false;
    for(let i=0;i<=idx;i++){
      const [lon,lat]=coords[i];
      const z=csz*(landmarks[i].s||1);
      const [x,y]=fn(lon,lat);
      const lr={x:x-z*0.5,y:y-z,w:z,h:z};
      const out = x<-csz*3||x>W+csz*3||y<-csz*2||y>H+csz*2;
      const ov = lmPlaced.some(q=>inter(lr,q)/(lr.w*lr.h)>0.55);
      if(i===idx&&ov) hidden=true;
      if(!ov&&!out) lmPlaced.push(lr);
    }
    if(hidden) return false;
  }
  return true;
}
const coordsBase = landmarks.map(d=>[d.lon,d.lat]);
let hiddenIdx=[]; for(let i=0;i<landmarks.length;i++) if(!checkVisible(coordsBase,i)) hiddenIdx.push(i);
let coords = coordsBase.map(c=>c.slice());
const CAP = parseFloat(process.argv[2]||'1.2');
const results=[];
for(const idx of hiddenIdx){
  const [lon0,lat0]=coordsBase[idx];
  let found=null;
  for(let radius=0.2; radius<=CAP+0.001 && !found; radius+=0.2){
    for(let ang=0; ang<360 && !found; ang+=15){
      const rad=ang*Math.PI/180;
      const cand=[lon0+Math.cos(rad)*radius, lat0+Math.sin(rad)*radius*0.7];
      coords[idx]=cand;
      if(checkVisible(coords, idx)) found=cand;
    }
  }
  if(!found){ coords[idx]=[lon0,lat0]; results.push({src:landmarks[idx].src, ok:false, from:[lon0,lat0]}); }
  else results.push({src:landmarks[idx].src, ok:true, from:[lon0,lat0], to:found, dist: Math.hypot(found[0]-lon0,found[1]-lat0).toFixed(2)});
}
results.forEach(r=>console.log((r.ok?'OK  ':'FAIL'), r.src.padEnd(30), r.ok? `${r.from.map(v=>v.toFixed(2))} -> ${r.to.map(v=>v.toFixed(2))} (Δ${r.dist})` : r.from));
