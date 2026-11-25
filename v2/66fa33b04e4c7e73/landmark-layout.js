const main=new Set(['municipalidad','san-jose','intendencia','primeros-pobladores','teatro-san-jose','terminal']);

// Slight cartographic emphasis in the map only; gallery masters keep their
// authored proportions. The lot and its geographic centre are never enlarged.
export function landmarkFit(spec,lot,isClear=()=>true){
  const base=Math.min(lot.w/spec.w,lot.d/spec.d),important=main.has(spec.id);
  const desired=important?.10:.06;
  let boost=0;
  for(const k of [1,.75,.5,.25]){
    const factor=1+desired*k;
    if(isClear(spec.w*base*factor,spec.d*base*factor)){boost=desired*k;break;}
  }
  return {horizontalScale:base*(1+boost),height:spec.heightScene*(important?1.20:1.12),horizontalBoost:boost,verticalBoost:important?.20:.12};
}

export const MONUMENT_SCALE=.72; // previously .55: a readable civic focal point
