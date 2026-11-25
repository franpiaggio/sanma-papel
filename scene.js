/* PAPER SPEC — San Martín de los Andes, Lago Lácar.
   Geography: OpenStreetMap geometries, 0.06 paper units per metre, origin at muelle.
   View: from the lake (SW) towards town (NE); +x SE, +z SW.
   Ground: mapped shoreline, sand, actual street paths, parks and Pocahullo.
   Buildings: interpreted illustrated cardstock on mapped footprints; scale retained.
   Matte honey timber, terracotta/slate roofs, cream edges, vivid turquoise and summer greens.
   Motion: 24-second coast-to-plaza camera route; hinged cards; small birds and boats.
   Lens: 28 degrees, oblique pitch 33-34, a closer final plaza view and tactile orbit.
   No skyline wall, invented grid, glossy water, or oversized civic landmarks.
*/
import * as THREE from 'three';
import * as P2 from 'papercraft/lib/paperkit-2d.js';
import {makeCard, crossCard} from 'papercraft/lib/paperkit-3d.js';
import {createHarness} from './harness.js';
import {createLife} from 'papercraft/lib/paper-life.js';
import {makeChalet,makeLaninLodge,makeClockTower,makeBusTerminal} from './architecture.js';
import {createNature} from './nature.js';
import {makeWalker,makeSailboat,makePier,makeBench,makeLamp} from './props.js';
import {createGeoLayout,createWideLayout} from './geo-layout.js';
import {applyCozyEnvironment,COZY_VIEW,COZY_VIEWS} from './cozy-environment.js';
import {createCinematicTour,routeAt,TOUR_DURATION} from './cinematic-route.js?v=fold-5';
import {createBatcher} from './batcher.js';
import {fixShadows} from './shadow-control.js';
import {createTapFold} from './interact.js';
import {makePlazaMonument,makeFlowerPlanter} from './cinematic-landmarks.js';
// The build is synchronous work (~10 s of printing cards). Yield to the browser
// between stages so the loader paints its progress instead of freezing.
// A frame when visible (so the bar paints), but never wait on rAF alone: a
// hidden tab throttles it and the build would stall.
const stageT=[];let stageLast=performance.now();
const stage=async(text,pct)=>{const now=performance.now();stageT.push([text,Math.round(now-stageLast)]);stageLast=now;window.__loading?.(text,pct);await new Promise(r=>{let done=false;const go=()=>{if(!done){done=true;setTimeout(r,0);}};requestAnimationFrame(go);setTimeout(go,60);});};
await stage('Leyendo el mapa',5);

const response=await fetch('./geography.json');
if(!response.ok) throw new Error(`Geography could not load (${response.status})`);
const geography=await response.json();
export const layout=createGeoLayout(geography,{scale:.06});
// Real surroundings (OSM): the Lácar arm is narrow and both shores are forested
// slopes down to the water. The town data alone used to leave them invented.
const wideResponse=await fetch('./geography-wide.json');
if(!wideResponse.ok) throw new Error(`Wide geography could not load (${wideResponse.status})`);
const W=createWideLayout(await wideResponse.json(),layout,geography.bbox);
if(W.lake.length)layout.waterPolygon=W.lake.reduce((a,b)=>b.outer.length>a.outer.length?b:a).outer;
const inPoly=(p,poly)=>{let c=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])c=!c;}return c;};
const inWood=(x,z)=>W.woods.some(w=>inPoly([x,z],w.outer)&&!w.inner.some(r=>inPoly([x,z],r)));
const L=layout, pt=L.points, mobile=matchMedia('(max-width:680px)').matches;
// Phones and low-memory devices get a lighter town (same map, same ridges):
// fewer infill houses and trees, a smaller shadow map. ?lite forces it, ?full disables it.
const QS=new URLSearchParams(location.search);
const lite=!QS.has('full')&&!QS.has('bake')&&!QS.has('baked')&&(QS.has('lite')||matchMedia('(pointer:coarse)').matches||mobile||(navigator.deviceMemory&&navigator.deviceMemory<=4));
// Spatial index of densified road points (1-unit cells): proximity checks for
// ridges and trees look at nearby cells only (the full scan cost ~30 s of load).
const roadIndex=(()=>{const cells=new Map(),key=(x,z)=>(Math.floor(x)+512)*4096+(Math.floor(z)+2048);
  for(const r of [...L.streets,...W.roads])for(let i=1;i<r.points.length;i++){const a=r.points[i-1],b=r.points[i],n=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/.5));
    for(let j=0;j<=n;j++){const x=a[0]+(b[0]-a[0])*j/n,z=a[1]+(b[1]-a[1])*j/n,k=key(x,z);let c=cells.get(k);if(!c)cells.set(k,c=[]);c.push(x,z);}}
  // any road point inside the box [x0,x1]x[z0,z1] (z beyond the page edge ignored)
  const any=(x0,x1,z0,z1)=>{for(let cx=Math.floor(x0);cx<=Math.floor(x1);cx++)for(let cz=Math.floor(z0);cz<=Math.floor(z1);cz++){const c=cells.get((cx+512)*4096+(cz+2048));if(!c)continue;
    for(let i=0;i<c.length;i+=2){const x=c[i],z=c[i+1];if(z>=-185&&x>=x0&&x<=x1&&z>=z0&&z<=z1)return true;}}return false;};
  return {any,near:(x,z,r)=>any(x-r,x+r,z-r,z+r)};})();
const reduced=matchMedia('(prefers-reduced-motion:reduce)').matches;
const C={forest:'#7d9a6a',ground:'#d8ddbc',lake:'#288fa1',deep:'#126d88',grass:'#a7bf72',sand:'#e7d2a3',road:'#c3c4b0',pavement:'#f0dfbb',ink:'#304d40'};
export const views=COZY_VIEWS;
const H=createHarness({
  bounds:{x0:-140,x1:140,z0:-185,z1:140},ground:C.ground,stock:'#f3f0e4',
  view:{pitch:COZY_VIEW.pitch,yaw:COZY_VIEW.yaw,dist:COZY_VIEW.dist,fov:28,target:[COZY_VIEW.x,COZY_VIEW.y,COZY_VIEW.z],closer:1.02,subjectY:.06},
  testView:{dist:26,target:[-.5,.4,-3]},heroHeight:.24,
  focus:[COZY_VIEW.x,COZY_VIEW.y,COZY_VIEW.z],subject:[COZY_VIEW.x,COZY_VIEW.z],rotate:true,
  light:{key:'#ffcf8c',keyIntensity:3.7,fill:'#c5e5ef',fillIntensity:1.05,sky:'#f8e5bd',ground:'#77934f',skyIntensity:.44,keyDir:[-.9,.68,.55],leak:'#7b6440',mapSize:2048,shadowExtent:48,maxPenumbra:.24},
  lens:{focusBand:.39,ramp:.36,maxBlur:12,taps:24,ao:mobile?0:.16,aoTint:'#3d6250',haze:'#bfd9d6',hazeAmount:.012,hazeStart:100,hazeEnd:200,tint:[1.015,1,.98],greenDesat:0,saturation:1.24,contrast:1.20,exposure:1.025,vignette:.045,vignetteColor:'#2a5b52',grain:.004},
  play:false,camBox:{x0:-25,x1:25,z0:-72,z1:12},walkArea:{x0:-10,x1:15,z0:-60,z1:0},walk:{step:.08,radius:.06}
});
// The guided route reaches the civic centre, so its distant print plates must
// have the same fidelity as those at the opening waterfront view.
H.flags.ROAM=true;
const N=createNature(H),rand=P2.rng(27113),buildings=[],chimneys=[],placements=[];
let waterMask;
const inside=(p,poly)=>{let c=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])c=!c;}return c;};
await stage('Trazando las manzanas',12);
const infill=makeInfill(L,lite?900:2300),apronPolygon=terminalApron(L);
const roadWidth=s=>['primary','secondary'].includes(s.highway)?.78:['tertiary','residential','living_street','unclassified'].includes(s.highway)?.59:['footway','path','steps','cycleway','corridor','pedestrian'].includes(s.highway)?.18:.34;
await stage('Imprimiendo el lago y las calles',20);
H.printGround(({g,ppu,X,Z,washes,torn,bandOf,line,water})=>{
  washes(['#b6c7b1','#d5ddc7','#a7bba6'],{scales:[[65,95,280,.11],[120,25,100,.07]]});
  for(const w of W.woods)torn(w.outer,C.forest,'#a3b88f');
  for(const park of L.parks)torn(park.points,C.grass,'#d9ddc4');
  for(const area of L.pedestrianAreas)torn(area.points,'#d7c5a2','#b8ad94');
  // The beach is a narrow sand margin; the promenade is a separate mapped surface.
  torn(bandOf(L.shoreline,.58),C.sand,'#d8d6bf');
  // The real arm is long and narrow: scaling it about its centroid (the
  // harness default) makes a diagonal deep band. Offset the shore instead.
  const offsetRing=(ring,d)=>{const a=ring.reduce((s,p,i)=>{const q=ring[(i+1)%ring.length];return s+p[0]*q[1]-q[0]*p[1];},0)>0?1:-1;
    return ring.map((p,i)=>{const prev=ring[(i-1+ring.length)%ring.length],next=ring[(i+1)%ring.length],tx=next[0]-prev[0],tz=next[1]-prev[1],n=Math.hypot(tx,tz)||1;return [p[0]-tz/n*d*a,p[1]+tx/n*d*a];});};
  waterMask=water(L.waterPolygon,{rimPts:offsetRing(L.waterPolygon,-.35),colors:[C.lake,null],flow:0,markColor:'rgba(219,231,211,0.32)',density:.26,foam:null});
  for(const r of L.waterways){
    // Sample to the water boundary so no clipped OSM river line crosses lake ink.
    const dry=[];let run=[];
    for(let i=1;i<r.points.length;i++){const a=r.points[i-1],b=r.points[i],n=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/.055));
      for(let j=0;j<=n;j++){const t=j/n,p=[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];if(waterMask(...p)){if(run.length>1)dry.push(run);run=[];}else run.push(p);}}
    if(run.length>1)dry.push(run);
    for(const p of dry){line(p,.66,'#aebfa9');line(p,.34,'#6c9a9e');line(p,.05,'#b9d0bf');}
  }
  for(const s of W.streams){const dry=s.points.filter(p=>!waterMask(...p));if(dry.length>1){line(dry,.3,'#9fb39a');line(dry,.14,'#5f97a0');}}
  for(const r of W.roads){const w=r.highway==='trunk'||r.highway==='primary'?.7:.5;line(r.points,w+.15,C.pavement);line(r.points,w,C.road);}
  for(const s of L.streets){if(s.points.length<2)continue;const w=roadWidth(s);line(s.points,w+.15,C.pavement);line(s.points,w,w<.25?'#d3d0b8':C.road);}
  for(const b of L.buildings)torn(b.points,'#b6bea8',null);
  // Actual central open spaces remain legible, including the plaza's crossing paths.
  for(const key of ['plazaSanMartin','plazaSarmiento']){
    const park=L.parks.find(p=>p.id===pt[key].sourceId);if(!park)continue;
    const xs=park.points.map(p=>p[0]),zs=park.points.map(p=>p[1]);
    const x=pt[key].x,z=pt[key].z;
    const ends=[[Math.min(...xs)+.45,z],[Math.max(...xs)-.45,z],[x,Math.min(...zs)+.45],[x,Math.max(...zs)-.45]];
    ends.forEach(e=>{if(inside(e,park.points))line([[x,z],e],.18,'#e0d9bf');});
    g.fillStyle='#d2d1b9';g.beginPath();g.ellipse(X(x),Z(z),.34*ppu,.34*ppu,0,0,Math.PI*2);g.fill();
  }
  const t=pt.terminal;
  torn(apronPolygon,'#b2b6ac',null);
  for(const s of L.streets.filter(s=>(s.name||'').startsWith('Plataforma')))line(s.points,.04,'#e5dfc7');
  for(const h of infill){const c=Math.cos(h.yaw),s=Math.sin(h.yaw),w=h.w+.3,d=h.d+.38;const q=[[-w/2,.12],[w/2,.12],[w/2,-d],[-w/2,-d]].map(([u,v])=>[h.x+u*c+v*s,h.z-u*s+v*c]);torn(q,h.buildingUse==='house'?'#bdc5a8':'#d0cbb7',null);}
},{ppu:13,seed:219});
H.walk.block(waterMask);
function nodeAt(node,x,z,{yaw=0,scale=1,height=node.userData.height||3,...opts}={}){
  return H.popup(null,null,{node,x,z,yaw,scale,height,order:Math.max(0,(5-z)/13),...opts});
}
// Oriented bounding rectangle keeps both placement and street alignment from OSM.
export function footprintBox(feature){
  const p=feature.points.slice(0,-1);let best=0,angle=0;
  for(let i=0;i<p.length;i++){const a=p[i],b=p[(i+1)%p.length],d=(b[0]-a[0])**2+(b[1]-a[1])**2;if(d>best){best=d;angle=Math.atan2(b[1]-a[1],b[0]-a[0]);}}
  let yaw=-angle;if(Math.cos(yaw)<0)yaw+=Math.PI;
  const c=Math.cos(yaw),s=Math.sin(yaw),us=p.map(([x,z])=>x*c-z*s),vs=p.map(([x,z])=>x*s+z*c);
  const u0=Math.min(...us),u1=Math.max(...us),v0=Math.min(...vs),v1=Math.max(...vs),u=(u0+u1)/2;
  return {x:u*c+v1*s,z:-u*s+v1*c,w:u1-u0,d:v1-v0,yaw,cx:u*c+(v0+v1)/2*s,cz:-u*s+(v0+v1)/2*c};
}

// Deterministic interpreted houses on empty street-front parcels, never a new grid.


// The bus apron follows the mapped access circulation, not a radial exclusion.
function terminalApron(L){
  const ids=new Set(['way/258402110','way/258402116','way/816348673']);
  const p=L.streets.filter(s=>ids.has(s.id)).flatMap(s=>s.points).sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
  if(p.length<3)return [];
  const cross=(o,a,b)=>(a[0]-o[0])*(b[1]-o[1])-(a[1]-o[1])*(b[0]-o[0]);
  const lower=[],upper=[];
  for(const q of p){while(lower.length>1&&cross(lower.at(-2),lower.at(-1),q)<=0)lower.pop();lower.push(q);}
  for(const q of [...p].reverse()){while(upper.length>1&&cross(upper.at(-2),upper.at(-1),q)<=0)upper.pop();upper.push(q);}
  return [...lower.slice(0,-1),...upper.slice(0,-1)];
}
function segmentDistance(p,a,b){const dx=b[0]-a[0],dz=b[1]-a[1],dd=dx*dx+dz*dz,t=dd?Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dz)/dd)):0;return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dz);}
function lotCorners(h,pad=0){const c=Math.cos(h.yaw),s=Math.sin(h.yaw),hw=h.w/2+pad,hd=h.d/2+pad;return [[-hw,-hd],[hw,-hd],[hw,hd],[-hw,hd]].map(([u,v])=>[h.cx+u*c+v*s,h.cz-u*s+v*c]);}
function lotsTouch(a,b,pad=.08){
  if(Math.hypot(a.cx-b.cx,a.cz-b.cz)>Math.hypot(a.w,a.d)/2+Math.hypot(b.w,b.d)/2+pad*2)return false;
  const aa=lotCorners(a,pad),bb=lotCorners(b,pad);
  for(const yaw of [a.yaw,b.yaw])for(const axis of [[Math.cos(yaw),-Math.sin(yaw)],[Math.sin(yaw),Math.cos(yaw)]]){
    const ap=aa.map(p=>p[0]*axis[0]+p[1]*axis[1]),bp=bb.map(p=>p[0]*axis[0]+p[1]*axis[1]);
    if(Math.max(...ap)<Math.min(...bp)||Math.max(...bp)<Math.min(...ap))return false;
  }return true;
}
// Dense street fronts, then rear garden buildings. Every row follows a mapped street.
function makeInfill(L,limit=2300){
  const apron=terminalApron(L),roadHalf=s=>['primary','secondary'].includes(s.highway)?.39:['tertiary','residential','living_street','unclassified'].includes(s.highway)?.295:.11;
  const roads=L.streets.flatMap(s=>s.points.slice(1).map((p,i)=>({a:s.points[i],b:p,r:roadHalf(s)})));
  const rivers=L.waterways.flatMap(s=>s.points.slice(1).map((p,i)=>[s.points[i],p]));
  const occupied=L.buildings.map(b=>b.points),parks=[...L.parks,...L.pedestrianAreas].map(b=>b.points),candidates=[];
  let serial=0;
  for(const street of L.streets){if(!['primary','secondary','tertiary','residential','living_street','unclassified'].includes(street.highway))continue;
    for(let j=1;j<street.points.length;j++){
      const a=street.points[j-1],b=street.points[j],dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz);if(len<.35)continue;
      const ux=dx/len,uz=dz/len;
      for(let t=.48;t<len;t+=1.13)for(const side of [-1,1])for(let tier=0;tier<3;tier++){
        const k=serial++,v=(k*37)%100,shore=(a[1]+uz*t)>-15;
        const hotel=tier===0&&shore&&v<21,apartment=!hotel&&tier===0&&v<48;
        const buildingUse=hotel?'hotel':apartment?'apartment':'house';
        const w=hotel?1.48+(k%4)*.16:apartment?1.18+(k%4)*.12:.88+(k%5)*.085;
        const d=hotel?1.08+(k%3)*.12:apartment?.93+(k%3)*.09:.79+(k%4)*.07;
        const off=roadHalf(street)+d/2+.12+tier*1.45;
        const cx=a[0]+ux*t-uz*off*side,cz=a[1]+uz*t+ux*off*side;
        if(cz>1.2||cz< -183||Math.abs(cx)>80)continue;   // the whole mapped street grid; forest is excluded below
        const storeys=hotel?(v%3===0?3:2):apartment?2:(k%4===0?2:1);
        const wallH=.17+storeys*.255,roofH=Math.min(.40,.19+d*.105);
        const yaw=Math.atan2(uz*side,-ux*side),variant=storeys>1?2+(k%3):(k%2);
        const band=cz> -15?0:cz> -32?1:cz> -48?2:cz> -70?3:cz> -120?4:5;
        const priority=band*100+tier*18+Math.abs(cx)*.3+Math.abs(cz+8)*.08;
        candidates.push({type:'chalet',kind:'building',sourceId:null,synthetic:true,buildingUse,storeys,modelId:`chalet_${variant}`,cx,cz,x:cx+Math.sin(yaw)*d/2,z:cz+Math.cos(yaw)*d/2,yaw,w,d,wallH,roofH,scale:1,variant,seed:12000+k*10+variant,roof:['#5a6a6b','#8d604d','#4b685a','#63716c','#9e6953'][variant],tier,priority});
      }
    }
  }
  candidates.sort((a,b)=>a.priority-b.priority);
  // Spatial grids (2-unit cells): each lot checks only nearby road segments and
  // already chosen lots. The full scans made this step ~6 s on load.
  const CELL=2,ck=(x,z)=>(Math.floor(x/CELL)+4096)*8192+(Math.floor(z/CELL)+4096);
  const segGrid=new Map();
  for(const r of roads){const pad=r.r+.1,x0=Math.min(r.a[0],r.b[0])-pad,x1=Math.max(r.a[0],r.b[0])+pad,z0=Math.min(r.a[1],r.b[1])-pad,z1=Math.max(r.a[1],r.b[1])+pad;
    for(let cx=Math.floor(x0/CELL);cx<=Math.floor(x1/CELL);cx++)for(let cz=Math.floor(z0/CELL);cz<=Math.floor(z1/CELL);cz++){const k=(cx+4096)*8192+(cz+4096);let c=segGrid.get(k);if(!c)segGrid.set(k,c=[]);c.push(r);}}
  const nearRoad=q=>{const c=segGrid.get(ck(q[0],q[1]));return !!c&&c.some(r=>segmentDistance(q,r.a,r.b)<r.r+.045);};
  const lotGrid=new Map(),addLot=h=>{const k=ck(h.cx,h.cz);let c=lotGrid.get(k);if(!c)lotGrid.set(k,c=[]);c.push(h);};
  const nearLots=h=>{const out=[],bx=Math.floor(h.cx/CELL),bz=Math.floor(h.cz/CELL);for(let dx=-2;dx<=2;dx++)for(let dz=-2;dz<=2;dz++){const c=lotGrid.get((bx+dx+4096)*8192+(bz+dz+4096));if(c)out.push(...c);}return out;};
  const chosen=[];
  for(const h of candidates){const p=[h.cx,h.cz],corners=lotCorners(h,.04),samples=[p,...corners,...corners.map((q,i)=>[(q[0]+corners[(i+1)%4][0])/2,(q[1]+corners[(i+1)%4][1])/2])];
    if(samples.some(q=>inside(q,L.waterPolygon)||inside(q,apron)))continue;
    if(inWood(h.cx,h.cz))continue;   // mapped forest: the slopes are wooded, not built
    if(samples.some(nearRoad))continue;
    if(rivers.some(([a,b])=>segmentDistance(p,a,b)<Math.max(h.w,h.d)/2+.55))continue;
    if(parks.some(poly=>samples.some(q=>inside(q,poly))||poly.some(q=>inside(q,corners))))continue;
    if(occupied.some(poly=>samples.some(q=>inside(q,poly))||poly.some(q=>inside(q,corners))))continue;
    if(nearLots(h).some(q=>lotsTouch(h,q,.065)))continue;
    chosen.push(h);addLot(h);if(chosen.length>=limit)break;
  }return chosen;
}
function makeUrbanTrees(L,plots,limit=1600){
  const apron=terminalApron(L),segments=lines=>lines.flatMap(l=>l.points.slice(1).map((p,i)=>[l.points[i],p]));
  const roads=segments(L.streets),rivers=segments(L.waterways),houses=plots.filter(p=>p.w&&p.d&&p.wallH),candidates=[];
  // Tall groups behind the promenade. Keep the entrance and sight line of the pier clear.
  L.shoreline.filter((_,i)=>i%2===0).forEach(([x,z],i)=>{if(z<9&&x>-25&&x<27&&Math.abs(x)>1.7)for(const shift of [1.05,1.8,2.65])candidates.push([x,z-shift,true]);});
  // Spread evenly over the whole town (a fixed hash order), not shore-first:
  // a shore-first order spent the limit before reaching the civic centre.
  const hash=h=>{const v=Math.sin(h.x*12.9898+h.z*78.233)*43758.5453;return v-Math.floor(v);};
  for(const h of [...houses].sort((a,b)=>hash(a)-hash(b))){
    const c=Math.cos(h.yaw||0),s=Math.sin(h.yaw||0);
    for(const [u,v] of [[h.w/2+.4,-h.d*.62],[-h.w/2-.4,-h.d*.62],[h.w*.25,-h.d-.45],[-h.w*.25,-h.d-.74],[h.w/2+.78,-h.d-.23]])candidates.push([h.x+u*c+v*s,h.z-u*s+v*c,false]);
  }
  const out=[];
  for(const [x,z,shore] of candidates){const p=[x,z];if(z< -135||z>8||Math.abs(x)>75||inside(p,L.waterPolygon)||inside(p,apron))continue;
    if(Math.abs(x)<1.4&&z>-2.6)continue;
    if(roads.some(([a,b])=>segmentDistance(p,a,b)<.44)||rivers.some(([a,b])=>segmentDistance(p,a,b)<.55))continue;
    if(L.parks.some(k=>inside(p,k.points))||L.pedestrianAreas.some(k=>inside(p,k.points)))continue;
    if(L.buildings.some(b=>inside(p,b.points)))continue;
    if(houses.some(h=>{const dx=x-h.x,dz=z-h.z,c=Math.cos(h.yaw||0),s=Math.sin(h.yaw||0),u=dx*c-dz*s,v=dx*s+dz*c;return Math.abs(u)<h.w/2+.10&&v<.10&&v>-h.d-.10;}))continue;
    if(out.some(q=>Math.hypot(q.x-x,q.z-z)<.61))continue;
    const i=out.length,scale=(shore?.23:.205)+(i%5)*.018,kind=i%3===0?'cypress':'coihue';
    out.push({type:'tree',kind,urban:true,shore,x,z,yaw:0,scale,height:6*scale,width:4*scale,seed:6100+i*17});
    if(out.length>=limit)break;
  }return out;
}
function makeParkTrees(L){
  const trees=[],pathSegments=L.streets.filter(s=>['footway','pedestrian','path'].includes(s.highway)).flatMap(s=>s.points.slice(1).map((p,i)=>[s.points[i],p]));
  for(const [j,park] of L.parks.entries()){
    const p=park.points.slice(0,-1),cx=p.reduce((a,q)=>a+q[0],0)/p.length,cz=p.reduce((a,q)=>a+q[1],0)/p.length;
    let n=0;
    for(let i=0;i<p.length;i++){const a=p[i],b=p[(i+1)%p.length],len=Math.hypot(b[0]-a[0],b[1]-a[1]);
      for(let t=.5;t<len;t+=1.0){const u=t/len,ex=a[0]+(b[0]-a[0])*u,ez=a[1]+(b[1]-a[1])*u,dx=cx-ex,dz=cz-ez,d=Math.hypot(dx,dz)||1;
        for(const inset of [.34,1.04]){const x=ex+dx/d*inset,z=ez+dz/d*inset;
          if(!inside([x,z],park.points)||inside([x,z],L.waterPolygon)||Math.hypot(x-cx,z-cz)<1.0)continue;
          if(pathSegments.some(([a,b])=>segmentDistance([x,z],a,b)<.25)||trees.some(q=>Math.hypot(q.x-x,q.z-z)<.69))continue;
          const scale=.22+(n%4)*.019;trees.push({type:'tree',park:true,kind:n%4===0?'cypress':'coihue',x,z,yaw:0,scale,height:scale*6,width:scale*4,seed:2000+j*100+n});n++;
          if(n>=24)break;
        }if(n>=24)break;
      }if(n>=24)break;
    }
  }return trees;
}
function buildingProportions(f,b,i){
  const hotel=['hotel','guest_house','apartment'].includes(f.tourism)||/hoster|hotel|posta|apart|cabañas/i.test(f.name||'');
  const tiny=b.w*b.d<.32,commercial=['restaurant','bar','cafe'].includes(f.amenity);
  const storeys=Math.max(1,Math.min(3,Number(f['building:levels'])||(hotel?2:tiny?1:(!commercial&&i%4===0?2:1))));
  const wallH=tiny?.23:hotel?.18+storeys*.275:.17+storeys*.255;
  return {storeys,buildingUse:hotel?'hotel':storeys>1?'apartment':commercial?'commercial':'house',wallH,roofH:Math.min(.62,Math.max(tiny?.12:.23,b.d*.25)),modelId:`chalet_${(30+i*13)%5}`};
}

const roofs=['#596a70','#426b5b','#9b604b','#6d7373','#73866d'];
const osmPrefab=[];
function placeHouse(feature,i){
  const b=footprintBox(feature);if(b.w<.13||b.d<.13||waterMask(b.cx,b.cz)||b.cz>9||b.cz< -104||Math.abs(b.cx)>63)return;
  const sc=.23,w=Math.min(b.w,5.2),d=Math.min(b.d,4.0);
  const profile=buildingProportions(feature,{...b,w,d},i),{wallH,roofH,storeys}=profile;
  buildings.push([b.cx,b.cz,Math.max(w,d)/2]);
  // Ordinary mapped houses share the five illustrated master models (placed
  // below, once the prefab cache exists): their cards then batch into a few
  // draw calls. Large or unusual footprints keep their own print.
  if(w<=3.2&&d<=3.2){
    const variant=storeys>1?2+(i%3):(i%2);
    osmPrefab.push({type:'chalet',kind:'building',sourceId:feature.id,variant,roof:['#5a6a6b','#8d604d','#4b685a','#63716c','#9e6953'][variant],storeys,x:b.x,z:b.z,yaw:b.yaw,w,d,wallH,roofH});
    placements.push({kind:'building',...profile,sourceId:feature.id,x:b.x,z:b.z,yaw:b.yaw,w,d,wallH,roofH,variant,prefab:true});
    return;
  }
  const node=makeChalet(H,{x:b.x,z:b.z,seed:30+i*13,roof:roofs[i%5],w:w/sc,d:d/sc,wallH:wallH/sc,roofH:roofH/sc,storeys,res:.7});
  nodeAt(node,b.x,b.z,{yaw:b.yaw,scale:sc});
  placements.push({kind:'building',...profile,sourceId:feature.id,x:b.x,z:b.z,yaw:b.yaw,w,d,wallH,roofH,seed:30+i*13,roof:roofs[i%5]});
  if(i%19===1&&node.userData.chimneyTop)chimneys.push({object:node.userData.chimneyTop});
}
const special=new Set([pt.intendencia.sourceId,pt.municipalidad.sourceId,pt.terminal.sourceId,pt.pierShelter?.sourceId]);
await stage('Recortando los edificios',34);
L.buildings.filter(b=>!special.has(b.id)).forEach(placeHouse);

// Five illustrated master models share their geometry and textures across infill.
// Linked children copy the master's fold pose, preserving the paper mechanism.



const prefabCache=new Map();
function infillModel(p){
  const key=p.variant;
  if(!prefabCache.has(key))prefabCache.set(key,makeChalet(H,{x:0,z:-25,w:4,d:3.2,wallH:2.6,roofH:1.55,roof:p.roof,seed:30+key*13,storeys:p.storeys,res:.6}));
  const master=prefabCache.get(key),pairs=[];
  const clone=source=>{const out=source.isMesh?new THREE.Mesh(source.geometry,source.material):new THREE.Group();out.name=source.name;out.position.copy(source.position);out.quaternion.copy(source.quaternion);out.scale.copy(source.scale);out.castShadow=source.castShadow;out.receiveShadow=source.receiveShadow;pairs.push([source,out]);source.children.forEach(ch=>out.add(clone(ch)));return out;};
  const copy=clone(master);copy.scale.set(p.w/4,(p.wallH+p.roofH)/4.15,p.d/3.2);
  const wrapper=new THREE.Group();wrapper.add(copy);wrapper.userData.height=p.wallH+p.roofH+.15;
  wrapper.userData.follow=t=>{master.userData.follow(t);for(let i=1;i<pairs.length;i++){const [a,b]=pairs[i];b.position.copy(a.position);b.quaternion.copy(a.quaternion);b.scale.copy(a.scale);}};
  return wrapper;
}

await stage('Armando las casas',46);
for(const p of osmPrefab)nodeAt(infillModel(p),p.x,p.z,{yaw:p.yaw});
for(const p of infill){nodeAt(infillModel(p),p.x,p.z,{yaw:p.yaw});placements.push(p);buildings.push([p.cx,p.cz,Math.max(p.w,p.d)/2]);}

function landmark(key,constructor,defaults){
  const p=pt[key],feature=L.buildings.find(b=>b.id===p.sourceId),b=feature?footprintBox(feature):{x:p.x,z:p.z,w:defaults.w,d:defaults.d,yaw:0};
  const sc=.23,w=b.w,d=b.d,node=constructor(H,{x:b.x,z:b.z,w:w/sc,d:d/sc,wallH:defaults.wallH/sc,roofH:defaults.roofH/sc,seed:defaults.seed});
  nodeAt(node,b.x,b.z,{yaw:b.yaw,scale:sc});buildings.push([p.x,p.z,Math.max(w,d)/2]);
  placements.push({kind:key,sourceId:p.sourceId,...b,wallH:defaults.wallH,roofH:defaults.roofH});return b;
}
landmark('intendencia',makeLaninLodge,{w:2.2,d:1.1,wallH:.57,roofH:.4,seed:400});
landmark('terminal',makeBusTerminal,{w:3.8,d:1.4,wallH:.33,roofH:.17,seed:811});
const m=pt.municipalidad,municipal=L.buildings.find(b=>b.id===m.sourceId),mb=footprintBox(municipal);
const wing=makeChalet(H,{x:mb.x,z:mb.z,w:mb.w/.22,d:mb.d/.22,wallH:1.85,roofH:.85,roof:'#8d6653',seed:841});
nodeAt(wing,mb.x,mb.z,{scale:.22,yaw:mb.yaw});
const tower=makeClockTower(H,{x:m.x,z:m.z,seed:409});nodeAt(tower,m.x,m.z+.42,{scale:.17,yaw:mb.yaw});
placements.push({kind:'municipalidad',sourceId:m.sourceId,...mb,wallH:.41,roofH:.19,towerHeight:.87});

// A narrow gangway and the lateral head follow the actual L-shaped pier footprint.
const base=pt.pierBase,tip=pt.pierTip,dx=tip.x-base.x,dz=tip.z-base.z,length=Math.hypot(dx,dz)+.18,pierYaw=Math.atan2(-dx,-dz),pierScale=.15;
const pier=makePier(H,{w:.23/pierScale,d:length/pierScale,h:.18/pierScale,seed:700});
nodeAt(pier,base.x,base.z,{yaw:pierYaw,scale:pierScale,height:2,level:true});
const shelter=pt.pierShelter||tip,headScale=.15;
const head=makePier(H,{w:1.18/headScale,d:1.45/headScale,h:.18/headScale,seed:701});
nodeAt(head,shelter.x+.725,shelter.z,{yaw:Math.PI/2,scale:headScale,height:2,level:true});
function roofedHead(){
  const group=new THREE.Group(),w=1.0,d=.55,h=.45,o={...H.cardOpts(shelter.x,shelter.z),thickness:.014,edgeWidth:.012,pxPerUnit:90,contact:null};
  const paint=(color)=>P=>{P.fill(color);P.layer(g=>{const b=P.box;for(let i=0;i<5;i++)g.fillRect(b.x0,b.y0+i*b.h/5,b.w,b.h*.06);},P2.shade(color,.2),{depth:.22});P.felt(.28);};
  for(const x of [-w/2+.05,w/2-.05])for(const z of [-d/2+.05,d/2-.05]){const post=crossCard([[-.025,0],[.025,0],[.025,h],[-.025,h]],{...o,paint:paint('#93744f')});post.position.set(x,.18,z);group.add(post);}
  const roof=makeCard([[-w/2,-d/2],[w/2,-d/2],[w/2,d/2],[-w/2,d/2]],{...o,paint:paint('#566a61')});roof.rotation.x=-Math.PI/2;roof.position.y=h+.18;group.add(roof);
  group.userData.follow=p=>group.children.forEach(ch=>ch.userData.follow?.(p));group.userData.height=.65;
  nodeAt(group,shelter.x,shelter.z,{height:.65,level:true});
}
roofedHead();
await stage('Plantando los árboles',58);
const urbanTrees=makeUrbanTrees(L,placements,lite?500:1600);
for(const p of urbanTrees){N.tree(p.x,p.z,{kind:p.kind,seed:p.seed,scale:p.scale});placements.push(p);}

// A measured avenue of smaller planted trees carries the route inland. The old
// coastal-priority tree budget left these centre blocks almost entirely bare.
const avenueTrees=[];
for(let z=-13,i=0;z>-43;z-=1.8,i++)for(const side of [-1,1]){
  const roadX=-10.2164+(-z-9.7775)*.4023;
  for(const offset of [.57,1.08,1.55]){
    const x=roadX+side*offset,q=[x,z];
    if(inside(q,L.waterPolygon)||L.buildings.some(b=>inside(q,b.points))||infill.some(h=>inside(q,lotCorners(h,.07))))continue;
    if(L.parks.some(p=>inside(q,p.points))||urbanTrees.some(p=>Math.hypot(p.x-x,p.z-z)<.65)||avenueTrees.some(p=>Math.hypot(p.x-x,p.z-z)<.72))continue;
    const p={type:'tree',kind:i%4===0?'cypress':'coihue',x,z,scale:.19+(i%3)*.012,seed:18500+i*11+(side+1)};
    N.tree(x,z,p);avenueTrees.push(p);placements.push(p);break;
  }
}

function makeHillPlacements(){
  const out=[],colors=['#6b8d88','#78937a','#476d5b'];
  // Left: the far side of the valley. Right: the Comandante Díaz / Arrayán
  // slope that rises straight from the east shore, with RN40 (mapped at
  // x 12-26, z -1..12) running along its foot: a chain of ridges stepping back
  // from the lake and growing taller toward the north-east, where the town
  // thins out (no mapped streets east of x ~30 between the shore and z -40).
  // Left: Curru Huinca / Bandurrias side, its forested foot running straight
  // into the lake along the west shore (x ~ -21). Right: Arrayán / Comandante
  // Díaz side above RN40 on the east shore. Positions follow the mapped shores.
  // The valley closes at the back: Curru Huinca (NW) and Comandante Díaz (NE)
  // rise at the top corners of the wide shot; the centre stays open where the
  // valley and RN40 run on to the north. The camera looks down (no horizon),
  // so the ring has to stand inside the frame to be read.
  const ranges=[[-33,22,22,9.5],[-35,9,26,12],[-41,-7,30,15],[-55,-26,34,18],[-68,-46,38,21],
                [34,6,26,12],[37,-8,30,15],[41,-24,34,18],[45,-42,38,21],
                [-50,-70,36,22],[-46,-96,40,26],[-30,-122,44,28],
                [72,-58,40,24],[66,-80,44,27],[52,-104,46,29],
                [-20,-192,70,44],[50,-197,70,46]];   // the far end of the valley, at the page edge where the roads stop
  // Keep every road readable: a ridge card stands on a straight base line, so
  // slide it away from the town (left chain left, right chain right) until no
  // mapped street or road crosses any of its three layers' bases; narrow it if
  // sliding is not enough.
  const blocked=(x,z,w)=>{for(let layer=0;layer<3;layer++){const lx=x+layer*.25,lz=z+layer*2,hw=w*(1-layer*.055)/2;
    if(roadIndex.any(lx-hw-.6,lx+hw+.6,lz-.9,lz+.9))return true;}return false;};
  // Where roads lace a slope (the RN40 hairpins), fill the forest gaps between
  // them with smaller ridges instead: candidates on a grid over mapped forest,
  // widest first, kept apart, never on a road, the lake or the built town.
  const extra=[];
  // Where the tour camera passes (landscape and portrait framing), no ridge may
  // stand: a card near the lens would cover the shot.
  // A ridge is rejected only if, from some tour camera within 45 units, its crest
  // rises into the frame (depression angle smaller than pitch + half the fov).
  const cams=[];for(let t=0;t<=TOUR_DURATION;t+=.5){const v=routeAt(t);for(const k of [1,1.17]){const yr=v.yaw*Math.PI/180,pr=v.pitch*Math.PI/180,d=v.dist*k;cams.push({x:v.x+d*Math.cos(pr)*Math.sin(yr),z:v.z+d*Math.cos(pr)*Math.cos(yr),y:d*Math.sin(pr),edge:(v.pitch+10)*Math.PI/180});}}
  const nearCam=(cx,z,w,h)=>cams.some(c=>{const dx=Math.max(0,Math.abs(c.x-cx)-w/2),dz=c.z-z,d=Math.hypot(dx,dz);if(d>45)return false;return Math.atan2(c.y-h,Math.max(d,.1))<c.edge;});
  // Both shores carry their forested slopes down the lake arm (to the SW, +z).
  // One shared list across the searches: overlapping searches used to drop two
  // ridges almost on the same spot, coplanar cards that z-fight (flicker).
  const placed=[...ranges.map(([x,z,w,h])=>[x,z,w,h])];
  for(const [x0,x1,z0,z1,dir] of [[30,72,-62,95,1],[-74,-26,-60,95,-1],[-120,-60,20,95,-1]]){
    let count=0;
    for(const w of [20,16,13])for(let z=z1;z>=z0;z-=4)for(let x=dir>0?x0:x1;dir>0?x<=x1:x>=x0;x+=dir*3){
      if(count>=12)break;
      const cx=x+dir*w/2;
      if(!inWood(cx,z)||!inWood(cx-w/2,z)||!inWood(cx+w/2,z)||waterMask?.(cx,z))continue;
      if(placed.some(p=>Math.abs(p[1]-z)<5&&Math.abs(p[0]-cx)<(p[2]+w)/2+1))continue;
      if(blocked(cx,z,w)||nearCam(cx,z,w,w*.72))continue;
      placed.push([cx,z,w,w*.72]);extra.push([cx,z,w,w*.72]);count++;
    }
  }
  const clear=[...ranges.map(([x,z,w,h])=>{const dir=x<0?-1:1;
    for(let k=0;k<=40;k++){const nx=x+dir*k*.75;if(!blocked(nx,z,w))return [nx,z,w,h];}
    for(let ww=w*.9;ww>=w*.5;ww*=.9){const nx=x+dir*(w-ww)/2;if(!blocked(nx,z,ww))return [nx,z,ww,h];}
    return null;}).filter(Boolean),...extra];
  clear.forEach(([x,z,w,h],side)=>{
    for(let layer=0;layer<3;layer++){
      const width=w*(1-layer*.055),height=h*(1-layer*.18),outline=[[-width/2,0]];
      for(let i=0;i<=40;i++){const u=i/40,y=Math.pow(Math.sin(u*Math.PI),.78)*height*(.93+.045*Math.sin(u*8+side*.8)+.025*Math.sin(u*17+layer));outline.push([-width/2+width*u,y]);}
      outline.push([width/2,0]);
      out.push({type:'hill',x:x+layer*.25,z:z+layer*2,yaw:0,color:colors[layer],outline,w:width,height,scale:1,seed:8200+side*10+layer,layer});
    }
  });return out;
}


await stage('Levantando los cerros',68);
const hillCards=makeHillPlacements();
for(const hill of hillCards){
  const paint=P=>{
    const b=P.box,r=P2.rng(hill.seed);P.fill(hill.color);P.felt(.32);
    for(let band=0;band<3;band++)P.layer(g=>{g.beginPath();g.moveTo(b.x0,b.y0);for(let j=0;j<=25;j++){const u=j/25;g.lineTo(b.x0+u*b.w,b.y0+b.h*(.12+band*.16+.09*Math.sin(u*7+hill.layer)));}g.lineTo(b.x1,b.y0);g.closePath();g.fill();},P2.shade(hill.color,-.16+band*.09),{depth:.35,lip:.4,rim:0});
    const patches=Array.from({length:23},()=>({x:b.x0+r()*b.w,y:b.y0+b.h*(.12+r()*.64),rx:.3+r()*.5,ry:.4+r()*.8}));
    P.layer(g=>{for(const p of patches){g.beginPath();g.ellipse(p.x,p.y,p.rx,p.ry,0,0,Math.PI*2);g.fill();}},P2.shade(hill.color,.18),{depth:.25,lip:.3,rim:0});
    P.layer(g=>{for(let i=0;i<patches.length;i+=3){const p=patches[i];g.beginPath();g.ellipse(p.x+p.rx*.25,p.y-p.ry*.15,p.rx*.55,p.ry*.7,0,0,Math.PI*2);g.fill();}},'#b0b99a',{depth:.18,lip:.2,rim:0});
  };
  const hh=H.popup(hill.outline,paint,{x:hill.x,z:hill.z,yaw:0,height:hill.height,order:1.8+hill.layer*.18,level:true,res:.5});hh.hill=true;hh.layer=hill.layer;placements.push(hill);
}

await stage('Llenando el bosque',76);
// Native woodland where OSM maps forest: both shores of the lake arm and the
// valley sides. A jittered grid keeps it dense near the shore and the town edge
// (what the tour sees) and sparser further out, where the ridges take over.
{
  let i=0;
  for(let z=-100;z<=95;z+=2.1)for(let x=-90;x<=80;x+=2.1){
    const jx=x+(rand()-.5)*1.6,jz=z+(rand()-.5)*1.6;
    if(!inWood(jx,jz)||waterMask(jx,jz))continue;
    const edge=Math.min(Math.abs(jx+22),Math.abs(jx-30));       // near the shores / town edge
    if(edge>14&&rand()<.55)continue;
    if(lite&&rand()<.55)continue;
    if(roadIndex.near(jx,jz,.9))continue;
    N.tree(jx,jz,{kind:i%3===0?'cypress':'coihue',seed:1100+i,scale:.24+rand()*.14});
    if(i%11===0)N.rocks(jx+.55,jz+.3,{seed:49+i,scale:.13});
    i++;
  }
  console.info('[woodland] trees',i);
}
// The valley floor north of the dressed town (up to the page edge) gets an
// open scatter of trees, so the wide shot shows country, not blank paper.
{
  const near=(x,z,r)=>buildings.some(([bx,bz,br])=>Math.abs(bx-x)<br+r&&Math.abs(bz-z)<br+r);
  let i=0;
  if(!lite)for(let z=-184;z<=-120;z+=2.6)for(let x=-80;x<=95;x+=2.6){
    const jx=x+(rand()-.5)*2,jz=z+(rand()-.5)*2;
    if(rand()<.45||waterMask(jx,jz))continue;
    if(roadIndex.near(jx,jz,1))continue;
    if(near(jx,jz,.8))continue;
    N.tree(jx,jz,{kind:i%3===0?'cypress':'coihue',seed:5100+i,scale:.24+rand()*.12});i++;
  }
}
// Trees within mapped parks and alongside the river are smaller planted groups.
const parkTrees=makeParkTrees(L);
for(const p of parkTrees){N.tree(p.x,p.z,{kind:p.kind,seed:p.seed,scale:p.scale});placements.push(p);}
for(const r of L.waterways)r.points.filter((_,i)=>i%7===0).forEach(([x,z],i)=>{if(z< -95||Math.abs(x)>70||waterMask(x,z))return;N.tree(x+.65,z,{seed:2800+i,scale:.21,kind:i%2?'coihue':'cypress'});});
const plaza=pt.plazaSanMartin;
const monument=makePlazaMonument(H,plaza);
nodeAt(monument,plaza.x,plaza.z,{yaw:-.38,height:.71,scale:.55,level:true});
placements.push({type:'monument',x:plaza.x,z:plaza.z,yaw:-.38,height:.39,scale:.55,source:'Municipal Culture photograph, Leonardo Guevara'});
const gardenLocations=[[-2.7,-1.1],[-6,-1.2],[-10.2,-3],[-7.9,-16.1],[-4.4,-23.3],[-1.8,-30.2],
  [plaza.x-1.7,plaza.z+1.35],[plaza.x+1.7,plaza.z+1.35],[plaza.x-1.75,plaza.z-1.3],[plaza.x+1.75,plaza.z-1.3]];
gardenLocations.forEach(([x,z],i)=>nodeAt(makeFlowerPlanter(H,{x,z,seed:150+i}),x,z,{height:.23,level:true}));
[[plaza.x-1.8,plaza.z],[plaza.x+1.8,plaza.z],[-3,-1],[-7,-.3]].forEach(([x,z],i)=>{
  nodeAt(makeBench(H,{seed:91+i,x,z}),x,z,{scale:.13,height:1.1});
  nodeAt(makeLamp(H,{seed:130+i,x:x+.4,z}),x+.4,z,{scale:.16,height:2.8});
});
const boats=[];
[[-5,9,.55,.16],[8,12,-.35,.19],[-12,17,.3,.14]].forEach(([x,z,yaw,sc],i)=>{
  if(!waterMask(x,z))return;const b=nodeAt(makeSailboat(H,{seed:81+i,color:i===1?'#cf7654':'#e2ce9c'}),x,z,{yaw,scale:sc,height:3,sway:.025});boats.push([b,yaw,i]);
});
H.onStep(t=>boats.forEach(([b,yaw,i])=>b.group.rotation.y=yaw+Math.sin(t*.19+i)*.018));
[[plaza.x+.7,plaza.z+.4,'#b95e45'],[-3.5,-.4,'#d8ba68'],[.5,-5,'#668a96'],[plaza.x-1,plaza.z-1,'#486d81']].forEach(([x,z,coat],i)=>{
  const person=makeWalker(H,{coat,seed:490+i,x,z}),h=nodeAt(person,x,z,{height:1.65,scale:.14,yaw:(i-2)*.22});if(i===0)H.setHero(h,{stride:person.userData.stride});
});
await stage('Soltando los pájaros',88);
const life=createLife({scene:H.scene,camera:H.camera,heroHeight:.24,seed:77,wind:[.1,.04]});
life.flock({size:4,height:3.1,colors:['#eee8ce','#859b96']});
life.cloudShadows({count:2});
if(chimneys.length)life.puffs({at:chimneys.slice(0,4),perEmitter:2,life:5.5,rise:.07,size:[.04,.07],colors:['#e2e2d1','#cbd4c4']});
life.reset(H.target);H.onStep((t,dt)=>life.update(dt,H.target));H.onRestart(()=>life.reset(H.target));
H.spots.pier=[0,0,79];H.spots.square=[plaza.x,plaza.z,39];
// The baked detail plate predates the mapped lake and forests; the live print
// carries them, so the plate stays off until it is rebaked from this data.
const cozy=applyCozyEnvironment(H,{textureURL:null});
await stage('Encuadernando la maqueta',94);
H.start();
const batcher=createBatcher(H);
const shadows=fixShadows(H,{mapSize:lite?2048:4096});
const tapFold=createTapFold(H);
cozy.setView('city');
H.renderer.domElement.setAttribute('aria-label','Maqueta de papel de San Martín de los Andes: costa, calles y plazas en su ubicación geográfica.');
H.renderer.domElement.setAttribute('role','img');
const api=window.__papercraft,listeners=[];
// Keep the opening hinges visible. The camera waits while the city unfolds.
// Only the visitor's reduced-motion preference starts with settled pieces.
api.restart();
// Pieces stay flat and still until the page has warmed up (index.html starts
// the tour): no rise while shaders compile and textures upload.
for(const h of H.hinges)h.reset(0);
const tour=createCinematicTour(H,{reducedMotion:reduced,autoplay:false});
let paused=false,folded=false;
const foldButton=document.getElementById('fold'),pauseButton=document.getElementById('pause');
const label=(button,text)=>{const span=button?.querySelector('span');if(span)span.textContent=text;};
const listen=(element,type,fn)=>{if(element){element.addEventListener(type,fn);listeners.push(()=>element.removeEventListener(type,fn));}};
listen(window,'sanmartin-tour',event=>{if(event.detail?.running){paused=false;pauseButton?.setAttribute('aria-pressed','false');label(pauseButton,'Pausa');}});
const setActiveView=name=>document.querySelectorAll('[data-view]').forEach(b=>{b.classList.toggle('active',b.dataset.view===name);b.setAttribute('aria-pressed',String(b.dataset.view===name));});
function unpause(){if(paused){paused=false;api.resume();pauseButton?.setAttribute('aria-pressed','false');label(pauseButton,'Pausa');}}
export function setView(name){const v=views[name];if(!v)return;tour.stop();unpause();cozy.setView(name);setActiveView(name);}
export function cleanup(){listeners.splice(0).forEach(fn=>fn());tour.dispose();cozy.dispose();api.step(0);}
document.querySelectorAll('[data-view]').forEach(b=>listen(b,'click',()=>setView(b.dataset.view)));
listen(foldButton,'click',()=>{unpause();api.toggle();folded=!folded;label(foldButton,folded?'Desplegar':'Plegar');});
listen(document.getElementById('replay'),'click',()=>{unpause();tour.stop();api.restart();tour.restart();folded=false;label(foldButton,'Plegar');setActiveView('city');});
listen(pauseButton,'click',()=>{paused=!paused;if(paused)api.step(0);else api.resume();pauseButton?.setAttribute('aria-pressed',String(paused));label(pauseButton,paused?'Seguir':'Pausa');});

const syncFold=()=>{const open=H.hinges[0]?.open??1;folded=open<.5;label(foldButton,folded?'Desplegar':'Plegar');};
H.onStep(syncFold);
listen(window,'pointerup',()=>queueMicrotask(syncFold));
window.__sanMartin={stageT,lite,batcher,H,layout:L,geography,placements,infill,urbanTrees,avenueTrees,waterMask,buildings,views,setView,cleanup,cozy,tour,startTour:()=>tour.restart()};
if(reduced){tour.stop();for(const hinge of H.hinges)hinge.reset(1);api.step(0);paused=true;pauseButton?.setAttribute('aria-pressed','true');label(pauseButton,'Seguir');}
