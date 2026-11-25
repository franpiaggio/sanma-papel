/** Original paper forms based on the municipality's plaza photograph.
 * San Martín in a poncho, riding a walking horse, on a low stone plinth.
 */
import { makeCard, crossCard } from 'papercraft/lib/paperkit-3d.js';
import { stabilizeFold } from './paper-fold.js';

export function makePlazaMonument(H, { x, z }) {
  const { THREE } = H;
  const structuralFolds=[];
  const group = new THREE.Group();
  group.name = 'Monumento a San Martín · caballo caminando';
  const opts = { ...H.cardOpts(x,z), thickness:.009, edgeWidth:.006,
    pxPerUnit:220, contact:null, seed:1879 };
  const stock = color => P => {
    P.fill(color); P.felt(.16);
    const b = P.box;
    P.layer(g => { g.fillRect(b.x0+b.w*.16,b.y0+b.h*.1,b.w*.13,b.h*.76); },
      '#8b9b81', { depth:.18, lip:.25, shadow:.35 });
  };
  const rect = (w,h) => [[-w/2,0],[w/2,0],[w/2,h],[-w/2,h]];
  const circle=(radius,count=48)=>Array.from({length:count},(_,i)=>{
    const a=i/count*Math.PI*2;return [Math.cos(a)*radius,Math.sin(a)*radius];
  });
  const fountain=makeCard(circle(1.02),{...opts,paint:P=>{
    P.fill('#d9d5b8');
    P.layer(circle(.81),'#b9c18a',{depth:.2,lip:.25,shadow:.25});
    P.layer(circle(.62),'#9ca76f',{depth:.2,lip:.2,shadow:.25});
    P.felt(.18);
  }});
  fountain.rotation.x=-Math.PI/2;fountain.position.y=.004;group.add(fountain);
  structuralFolds.push(p=>{fountain.rotation.x=-Math.PI/2*p;});
  // The real plaza has pavement jets around the central bed, not a tiered basin.
  for(let i=0;i<10;i++){
    const a=i/10*Math.PI*2;
    const jet=crossCard([[-.014,0],[-.012,.15],[0,.27],[.014,.17],[.02,0]],
      {...opts,thickness:.004,paint:P=>{P.fill('#b3dfe0');P.layer([[-.004,0],[.003,.23],[.01,0]],'#eef1cf',{depth:.1,lip:.1});}});
    jet.position.set(Math.cos(a)*.91,.012,Math.sin(a)*.91);group.add(jet);
  }
  const stone = P => {
    P.fill('#928c72'); P.felt(.25);
    const b=P.box;
    for(let r=0;r<3;r++) P.layer(g=>{
      for(let k=0;k<5;k++)g.fillRect(b.x0+(k+(r%2)*.35)*b.w/5,b.y0+r*b.h/3,b.w*.18,b.h*.27);
    },['#adab91','#bbb49a','#797f6d'][r],{depth:.22,lip:.3,shadow:.4});
  };
  const w=.58,d=.35,h=.16;
  for(const side of [-1,1]) {
    const face=makeCard(rect(w,h),{...opts,paint:stone});
    face.position.z=side*d/2; if(side<0)face.rotation.y=Math.PI; group.add(face);
    const end=makeCard(rect(d,h),{...opts,paint:stone});
    end.position.x=side*w/2;end.rotation.y=side*Math.PI/2;group.add(end);
    structuralFolds.push(p=>{end.rotation.y=side*Math.PI/2*p;});
  }
  const cap=makeCard([[-w/2,-d/2],[w/2,-d/2],[w/2,d/2],[-w/2,d/2]],
    {...opts,paint:stock('#bab49a')});
  cap.rotation.x=-Math.PI/2;cap.position.y=h;group.add(cap);
  structuralFolds.push(p=>{cap.rotation.x=-Math.PI/2*p;});
  const horse=new THREE.Group();horse.position.y=h+.008;
  // Four legs have weight-bearing hooves and one stepping knee, never a rear-up.
  const body=[[-.21,.16],[-.19,.25],[-.1,.29],[.09,.27],[.12,.32],[.16,.39],
    [.2,.4],[.245,.35],[.29,.33],[.285,.29],[.235,.285],[.205,.31],
    [.18,.245],[.16,.18],[.08,.16],[-.08,.14]];
  for(const depth of [-.035,.035]) {
    const card=makeCard(body,{...opts,paint:stock(depth<0?'#465a50':'#607363')});
    card.position.z=depth;horse.add(card);
  }
  const legs=[
    [[-.17,.19],[-.115,.18],[-.13,.07],[-.11,.013],[-.165,.008],[-.18,.055]],
    [[-.105,.17],[-.065,.17],[-.045,.075],[-.005,.02],[-.055,.012],[-.1,.065]],
    [[.12,.2],[.165,.19],[.15,.105],[.145,.014],[.09,.014],[.105,.11]],
    [[.07,.2],[.11,.18],[.075,.08],[.035,.035],[-.005,.05],[.04,.115]],
  ];
  legs.forEach((shape,i)=>{const c=makeCard(shape,{...opts,paint:stock(i%2?'#465a50':'#5b6d5e')});c.position.z=i%2?.048:-.048;horse.add(c);});
  const tail=makeCard([[-.185,.26],[-.245,.235],[-.275,.12],[-.25,.055],[-.235,.12],[-.21,.22]],
    {...opts,paint:stock('#45564c')});horse.add(tail);
  // Layered poncho, boots, head and cap preserve a readable small rider.
  const poncho=makeCard([[-.06,.275],[-.075,.42],[-.02,.455],[.065,.425],[.11,.29],[.055,.245]],
    {...opts,paint:stock('#5c6d5c')});poncho.position.z=.055;horse.add(poncho);
  const head=crossCard([[-.026,.43],[.018,.43],[.038,.472],[.025,.512],[-.017,.515],[-.04,.485]],
    {...opts,paint:stock('#74816b')});head.position.z=.018;horse.add(head);
  const hat=makeCard([[-.05,.496],[.038,.496],[.032,.53],[-.034,.537]],
    {...opts,paint:stock('#4b5d50')});hat.position.z=.034;horse.add(hat);
  const boot=makeCard([[-.02,.29],[.018,.288],[.033,.185],[.075,.17],[.069,.145],[.008,.147],[-.022,.2]],
    {...opts,paint:stock('#3c5148')});boot.position.z=.068;horse.add(boot);
  const telescope=makeCard([[-.035,.33],[.09,.315],[.097,.34],[-.03,.355]],
    {...opts,paint:stock('#8a8c6d')});telescope.position.z=.078;horse.add(telescope);
  group.add(horse);
  group.userData.height=.71;
  group.userData.follow=p=>{
    const a=Math.min(1,Math.max(0,p)),open=a*a*(3-2*a);
    structuralFolds.forEach(follow=>follow(open));
    group.traverse(o=>{if(o!==group)o.userData.follow?.(p);});
  };
  return stabilizeFold(group,THREE);
}

// Planter prints are shared: one tub print and one bloom print per colour
// (crossCard reuses the first card's print via `materials`). Ten planters used
// to issue ~540 draw calls with a unique print per bloom; shared, they batch.
const PLANTER_PRINTS=new Map();
export function makeFlowerPlanter(H,{x,z,seed=1}) {
  const {THREE}=H, group=new THREE.Group();
  group.name='Jardinera de papel';
  const opts={...H.cardOpts(x,z),thickness:.006,edgeWidth:.004,pxPerUnit:180,contact:null,seed};
  const tubKey='tub', bloomKey='bloom'+(seed%3);
  const tub=crossCard([[-.16,0],[.16,0],[.14,.11],[-.14,.11]],{
    ...opts,materials:PLANTER_PRINTS.get(tubKey)||null,paint:P=>{P.fill('#aa603f');P.layer([[-.15,.07],[.15,.07],[.16,.1],[-.16,.1]],'#de9b55',{depth:.2});P.felt(.18);}});
  if(!PLANTER_PRINTS.has(tubKey))PLANTER_PRINTS.set(tubKey,tub.children[0].material);
  group.add(tub);
  for(let i=0;i<5;i++){
    const bloom=crossCard([[-.065,.07],[-.085,.14],[-.045,.21],[0,.18],[.045,.215],[.08,.15],[.055,.08]],{
      ...opts,materials:PLANTER_PRINTS.get(bloomKey)||null,paint:P=>{P.fill(['#df8253','#d15769','#eeb958'][seed%3]);P.layer([[-.025,.12],[.025,.12],[.035,.16],[0,.185],[-.035,.16]],'#f6ce73',{depth:.2});P.felt(.12);}});
    if(!PLANTER_PRINTS.has(bloomKey))PLANTER_PRINTS.set(bloomKey,bloom.children[0].material);
    bloom.position.set((i-2)*.063,0,(i%2-.5)*.05);group.add(bloom);
  }
  group.userData.height=.23;
  group.userData.follow=p=>group.children.forEach(o=>o.userData.follow?.(p));
  return group;
}
