// Cartas fijas sobre los cordones: laterales paralelos al valle, fondo mirando
// hacia el pueblo. Las mismas bases transformadas se usan al validar caminos.
export function hillYaw(x,z){return z < -150 ? 0 : x < 0 ? Math.PI/2 : -Math.PI/2;}

export function hillLayer(x,z,w,layer=0){
  const yaw=hillYaw(x,z),c=Math.cos(yaw),s=Math.sin(yaw);
  return {x:x+c*layer*.25+s*layer*2,z:z-s*layer*.25+c*layer*2,w:w*(1-layer*.055),yaw};
}

export function hillPoint(h,u){return [h.x+Math.cos(h.yaw)*u,h.z-Math.sin(h.yaw)*u];}

export function hillCardsConflict(a,b,gap=.22){
  if(Math.abs(Math.sin(a.yaw-b.yaw))>1e-6)return false;
  const dx=a.x-b.x,dz=a.z-b.z,c=Math.cos(a.yaw),s=Math.sin(a.yaw);
  return Math.abs(dx*s+dz*c)<gap&&Math.abs(dx*c-dz*s)<(a.w+b.w)/2+.1;
}

export function hillFamilyConflicts(a,b){
  return [0,1,2].some(i=>[0,1,2].some(j=>hillCardsConflict(hillLayer(a[0],a[1],a[2],i),hillLayer(b[0],b[1],b[2],j))));
}

export function hillBaseBounds(h){
  const c=Math.abs(Math.cos(h.yaw)),s=Math.abs(Math.sin(h.yaw)),hw=h.w/2+.6;
  const ex=c*hw+s*.9,ez=s*hw+c*.9;
  return {x0:h.x-ex,x1:h.x+ex,z0:h.z-ez,z1:h.z+ez};
}

export function hillFamilyBounds(x,z,w){
  const boxes=[0,1,2].map(layer=>hillBaseBounds(hillLayer(x,z,w,layer)));
  return {x0:Math.min(...boxes.map(b=>b.x0)),x1:Math.max(...boxes.map(b=>b.x1)),z0:Math.min(...boxes.map(b=>b.z0)),z1:Math.max(...boxes.map(b=>b.z1))};
}

export function hillFamiliesOverlap(a,b){
  const p=hillFamilyBounds(a[0],a[1],a[2]),q=hillFamilyBounds(b[0],b[1],b[2]);
  return p.x0<q.x1+1&&p.x1>q.x0-1&&p.z0<q.z1+1&&p.z1>q.z0-1;
}
