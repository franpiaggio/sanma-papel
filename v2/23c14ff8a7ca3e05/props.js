// Original small paper constructions for the San Martín de los Andes diorama.
// All constructors return local groups; x/z select the harness's print resolution.
// Walker dimensions: 1.65 high, +z facing, 0.022 card stock, independently swept limbs.
import { makeCard, crossCard, platform } from './lib/paperkit-3d.js';

const rect = (x, y, w, h) => [[x,y],[x+w,y],[x+w,y+h],[x,y+h]];
const ellipse = (x,y,rx,ry,n=20) => Array.from({length:n},(_,i)=>{
  const a=i*Math.PI*2/n; return [x+Math.cos(a)*rx,y+Math.sin(a)*ry];
});
const INK='#344d4e', CREAM='#f0e4c8', WOOD='#ab7e50', WOOD_LIGHT='#cba574';
const unfold=(p,a=.12,b=.86)=>{const t=Math.max(0,Math.min(1,(p-a)/(b-a)));return t*t*(3-2*t);};
const finish=P=>P.felt(.35);
const opts=(H,x,z,seed,t=.035)=>({
  ...H.cardOpts(x,z), thickness:t, edgeWidth:t*.64, seed,
  contact:{amount:.09,height:.15,color:'#405b52'}, back:'mirror'
});

function woodPrint(P,{base=WOOD,horizontal=true}={}) {
  const {x0,y0,w,h}=P.box;
  P.fill('#705740');
  const n=Math.max(2,Math.ceil((horizontal?h:w)/.35));
  for(let i=0;i<n;i++){
    const k=(horizontal?h:w)/n, c=[base,WOOD_LIGHT,'#bc9161'][i%3];
    P.layer(horizontal?rect(x0+.015,y0+i*k+.018,w-.03,k-.036):rect(x0+i*k+.018,y0+.015,k-.036,h-.03),c,{depth:.25});
  }
  P.layer(g=>{
    g.fillStyle='#ead3a3';
    if(horizontal) for(let i=0;i<n;i++) g.fillRect(x0+w*.12,y0+(i+.72)*h/n,w*.62,.024);
    else for(let i=0;i<n;i++) g.fillRect(x0+(i+.24)*w/n,y0+h*.12,.025,h*.65);
  },'#ead3a3',{depth:.13,alpha:.65});
  finish(P);
}

/** A backpacker assembled from 16 card panels, 1.65 units high. */
export function makeWalker(H,{coat='#b95e45',seed=1,x=0,z=0}={}) {
  const {THREE,P2}=H, g=new THREE.Group(); g.name='Trekking backpacker';
  const o={...opts(H,x,z,seed,.022),pxPerUnit:100,edgeWidth:.011,contact:null};
  let serial=0,reveal=1;const panels=[];
  const panel=(parent,name,pts,paint,at=[0,0,0],yaw=0,back='mirror')=>{
    const m=makeCard(pts,{...o,seed:seed+(++serial)*17,paint,back,folds:[]});
    m.name=name; m.position.set(...at);m.rotation.y=yaw;parent.add(m);
    panels.push({m,z:at[2],yaw,flatZ:.008+(serial-1)*.025});return m;
  };
  const shade=P2.mix(coat,'#633b35',.32), light=P2.mix(coat,'#edc887',.32);
  const fabric=(P,base)=>{
    const {x0,y0,w,h}=P.box;P.fill(base);
    P.layer(rect(x0+.018,y0+h*.1,w*.5,h*.79),P2.mix(base,CREAM,.26),{depth:.13});
    P.layer(rect(x0+w*.6,y0+h*.12,w*.25,h*.64),P2.mix(base,INK,.24),{depth:.12});finish(P);
  };
  const body=[[-.19,.65],[.19,.65],[.19,1.04],[.13,1.12],[.075,1.12],[.075,1.20],[-.075,1.20],[-.075,1.12],[-.13,1.12],[-.19,1.04]];
  panel(g,'coat front',body,P=>{
    P.fill(coat);
    P.layer(rect(-.19,.65,.38,.19),shade,{depth:.18});
    P.layer([[-.17,.89],[.16,.87],[.16,1.03],[.10,1.10],[-.10,1.10],[-.17,1.02]],light,{depth:.22});
    P.layer(rect(-.075,1.12,.15,.08),'#e6bd8d',{depth:.15});
    P.layer(rect(-.014,.67,.028,.43),CREAM,{depth:.10});
    P.layer(rect(-.145,.76,.09,.09),'#e5b46d',{depth:.15});
    P.layer(rect(.06,.76,.09,.09),shade,{depth:.12});
    P.layer(g2=>{g2.fillStyle=INK;g2.fillRect(-.135,.90,.04,.18);g2.fillRect(.095,.90,.04,.18);},INK,{depth:.18});
    finish(P);
  },[0,0,.10],0,P=>fabric(P,shade));
  // The side's front edge stays behind the front panel; the neck is only in front.
  panel(g,'coat profile',[[.04,.66],[.24,.66],[.24,1.05],[.18,1.11],[.04,1.11]],P=>fabric(P,shade),[0,0,.04],Math.PI/2);

  panel(g,'face',ellipse(0,1.355,.175,.185),P=>{
    P.fill('#e9c59a');
    P.layer(ellipse(-.038,1.37,.123,.145),'#f3d9af',{depth:.12});
    P.layer([[-.17,1.40],[-.15,1.51],[-.03,1.55],[.12,1.50],[.16,1.43],[.10,1.47],[-.07,1.46]],'#685245',{depth:.15});
    P.layer(g2=>{g2.fillStyle='#3b4240';g2.fillRect(-.077,1.363,.032,.036);g2.fillRect(.045,1.363,.032,.036);},INK,{depth:.07});
    P.layer(ellipse(.011,1.322,.028,.016),'#bd8a66',{depth:.07});
    P.layer(rect(-.035,1.263,.073,.018),'#865c4d',{depth:.04});finish(P);
  },[0,0,.16],0,P=>fabric(P,'#7c6250'));
  panel(g,'head profile',[[.035,1.20],[.18,1.22],[.205,1.39],[.15,1.52],[.035,1.52]],P=>{
    P.fill('#ba926f');P.layer(rect(.04,1.25,.12,.23),'#dbb88e',{depth:.13});
    P.layer(rect(.09,1.45,.11,.1),'#685245',{depth:.13});finish(P);
  },[0,0,.08],Math.PI/2);
  panel(g,'trekking cap',[[-.19,1.48],[.19,1.48],[.19,1.535],[.14,1.55],[.115,1.63],[-.10,1.65],[-.15,1.59],[-.15,1.535],[-.19,1.525]].map(([a,b])=>[a,b]),P=>{
    P.fill('#516b69');P.layer(rect(-.15,1.55,.25,.10),'#7e9180',{depth:.13});
    P.layer(rect(-.18,1.49,.36,.035),'#324d50',{depth:.12});
    P.layer(rect(.035,1.568,.055,.047),'#e7cb86',{depth:.09});finish(P);
  },[0,0,.21]);
  panel(g,'cap profile',[[.035,1.54],[.24,1.54],[.24,1.60],[.12,1.63],[.035,1.61]],P=>fabric(P,'#637d74'),[0,0,.10],Math.PI/2);

  const legs=[],arms=[];
  for(const side of [-1,1]){
    const leg=new THREE.Group();leg.name=side<0?'left hip':'right hip';leg.position.set(side*.105,.64,.04);g.add(leg);legs.push(leg);
    panel(leg,`${side} trouser front`,[[-.063,0],[.063,0],[.063,-.50],[.08,-.55],[.08,-.64],[-.08,-.64],[-.08,-.55],[-.063,-.50]],P=>{
      P.fill('#41535d');P.layer(rect(-.05,-.50,.052,.47),'#71808a',{depth:.14});
      P.layer(rect(-.078,-.64,.155,.13),'#705342',{depth:.14});
      P.layer(rect(-.078,-.64,.155,.025),'#c3ac7c',{depth:.09});
      P.layer(rect(-.032,-.575,.064,.021),'#e6d5b1',{depth:.08});finish(P);
    });
    panel(leg,`${side} trouser profile`,[[.04,-.045],[.115,-.045],[.115,-.535],[.15,-.565],[.15,-.625],[.04,-.625]],P=>{
      fabric(P,'#3d535c');P.layer(rect(.045,-.625,.10,.10),'#826045',{depth:.12});
    },[0,0,-.01],Math.PI/2);

    const arm=new THREE.Group();arm.name=side<0?'left shoulder':'right shoulder';arm.position.set(side*.285,1.075,.08);g.add(arm);arms.push(arm);
    panel(arm,`${side} sleeve front`,[[-.064,.035],[.064,.035],[.064,-.29],[.055,-.40],[-.055,-.40],[-.064,-.29]],P=>{
      fabric(P,coat);P.layer(rect(-.06,-.31,.12,.075),shade,{depth:.14});
      P.layer(ellipse(0,-.352,.051,.049),'#ebc79a',{depth:.13});finish(P);
    });
    panel(arm,`${side} sleeve profile`,[[.035,.004],[.105,.004],[.105,-.28],[.09,-.38],[.035,-.38]],P=>fabric(P,shade),[0,0,-.025],Math.PI/2);
  }

  panel(g,'backpack back',[[-.16,.71],[.16,.71],[.17,1.02],[.13,1.12],[-.13,1.12],[-.17,1.02]],P=>{
    P.fill('#416c70');P.layer(rect(-.13,.76,.26,.26),'#7c9a8d',{depth:.16});
    P.layer(rect(-.14,1.015,.28,.075),'#a8b38a',{depth:.15});
    P.layer(rect(-.09,.78,.18,.12),'#2d555a',{depth:.16});
    P.layer(g2=>{g2.fillStyle='#e2bf76';g2.fillRect(-.075,.95,.035,.10);g2.fillRect(.04,.95,.035,.10);},'#e2bf76',{depth:.12});finish(P);
  },[0,0,-.29]);
  panel(g,'backpack profile',[[.035,.74],[.16,.76],[.17,1.04],[.11,1.09],[.035,1.09]],P=>fabric(P,'#62847c'),[.032,0,-.325],Math.PI/2);

  g.userData.height=1.65;
  g.userData.stride=(walked=0,gait=0)=>{
    const a=Math.sin(walked*8.4)*Math.max(0,Math.min(1,gait))*reveal;
    legs[0].rotation.x=a*.32;legs[1].rotation.x=-a*.32;
    arms[0].rotation.x=-a*.20;arms[1].rotation.x=a*.20;
  };
  g.userData.follow=p=>{
    reveal=unfold(p);
    panels.forEach(({m,z,yaw,flatZ})=>{m.rotation.y=yaw*reveal;m.position.z=flatZ+(z-flatZ)*reveal;});
  };
  g.userData.follow(1);
  g.userData.stride(0,0);
  return g;
}

/** Two folded sails, printed planks and a shallow paper hull. Long axis is x. */
export function makeSailboat(H,{seed=1,color='#e2ce9c',x=0,z=0}={}) {
  const {THREE,P2}=H,g=new THREE.Group();g.name='Lácar paper sailboat';
  const o=opts(H,x,z,seed,.035);
  const add=(name,pts,paint,at=[0,0,0],rx=0,ry=0)=>{
    const m=makeCard(pts,{...o,seed:seed+g.children.length*19,paint,folds:[],back:'mirror'});
    m.name=name;m.position.set(...at);m.rotation.set(rx,ry,0);g.add(m);return m;
  };
  const hull=[[-1.2,.43],[-.91,.08],[.86,.08],[1.2,.43]];
  const hullPaint=P=>{
    P.fill('#3e747b');P.layer([[-1.13,.37],[-.94,.14],[.88,.14],[1.11,.37]],'#71a2a2',{depth:.35});
    P.layer(rect(-1.2,.33,2.4,.075),'#eee0b7',{depth:.25});
    P.layer(rect(-.79,.19,1.58,.038),'#c57755',{depth:.20});finish(P);
  };
  add('near hull',hull,hullPaint,[0,0,.30]);add('far hull',hull,hullPaint,[0,0,-.30]);
  add('level boat deck',[[-1.12,0],[1.12,0],[.9,.60],[-.9,.60]],P=>woodPrint(P),[0,.448,.30],-Math.PI/2);
  // Two separated panels around the mast keep the individual triangular cuts visible.
  const sailPaint=P=>{
    const {x0,y0,w,h}=P.box;P.fill(color);
    P.layer([[x0+w*.08,y0+h*.05],[x0+w*.92,y0+h*.05],[x0+w*.10,y0+h*.85]],P2.mix(color,'#fff1cc',.45),{depth:.33});
    P.layer(rect(x0,y0+h*.12,w,h*.095),'#bb7351',{depth:.25});
    P.layer(rect(x0,y0+h*.27,w,h*.035),'#516f77',{depth:.20});finish(P);
  };
  add('main sail',[[-.025,.64],[1.03,.72],[-.025,2.93]],sailPaint,[0,0,.025]);
  add('jib',[[-.23,.68],[-1.08,.68],[-.23,2.72]],sailPaint,[0,0,-.035]);
  const mast=crossCard(rect(-.05,.47,.10,2.53),{...o,paint:P=>{
    P.fill('#835d3e');P.layer(rect(-.027,.46,.035,2.50),'#d3b079',{depth:.14});finish(P);
  }});mast.name='slotted mast';mast.position.x=-.13;g.add(mast);
  add('paper pennant',[[-.18,2.95],[-.18,3],[.22,2.975]],P=>{P.fill('#b76348');P.layer(rect(-.15,2.96,.10,.03),'#e2bc83',{depth:.12});finish(P);},[0,0,.11]);
  // A hinge calls only its direct child's follow(), so the mast's crossed
  // planes and the deck need to follow the boat's fold explicitly.
  const panels=g.children.map((m,i)=>({m,z:m.position.z,rx:m.rotation.x,flatZ:.012+i*.042}));
  g.userData.follow=p=>{
    const k=unfold(p);
    panels.forEach(({m,z,rx,flatZ})=>{m.position.z=flatZ+(z-flatZ)*k;m.rotation.x=rx*k;});
    mast.userData.follow(p);
  };
  g.userData.follow(1);
  g.userData.length=2.4;g.userData.height=3;
  return g;
}

const postsOutline=(w,h,p=.16,beam=.13)=>[
  [-w/2,0],[-w/2+p,0],[-w/2+p,h-beam],[w/2-p,h-beam],
  [w/2-p,0],[w/2,0],[w/2,h],[-w/2,h]
];

/** Deck entrance at z=0, extending to -d; platform keeps the walk frame level. */
export function makePier(H,{x=0,z=0,w=2.7,d=9,h=.48,seed=1}={}) {
  const o=opts(H,x,z,seed,.045);
  const facePts=postsOutline(w,h,.19,.14);
  const p=platform({w,d,h,paper:H.paper,seed,thickness:.045,edgeWidth:.026,
    facePts,supportPts:facePts.map(([a,b])=>[a,b-h]),
    print:o,paints:{face:P=>woodPrint(P,{base:'#8d6f52',horizontal:false}),
      support:P=>woodPrint(P,{base:'#8d6f52',horizontal:false}),deck:P=>woodPrint(P,{base:'#bd9d70'})}});
  p.name='Open Lácar timber pier';const deck=p.userData.deck,supports=[],rails=[];
  for(const fraction of [1/3,2/3]){
    const supportHeight=Math.max(.1,h-.024);
    const support=makeCard(facePts.map(([a,b])=>[a,(b-h)*supportHeight/h]),{...o,paint:P=>woodPrint(P,{base:'#8d6f52',horizontal:false}),folds:['bottom','top']});
    support.name='pier open cross support';support.position.set(0,-.046,-d*fraction);deck.add(support);supports.push(support);
  }
  const rail=(side)=>{
    const rh=.62,pw=.11,beam=.085,positions=[0,d*.25,d*.50,d*.75,d-pw];
    // A top rail with four open bottom gaps; no solid apron under the deck.
    const q=[];
    for(let j=0;j<positions.length;j++){
      const a=positions[j],b=Math.min(d,a+pw);q.push([a,0],[b,0]);
      if(j<positions.length-1)q.push([b,rh-beam],[positions[j+1],rh-beam]);
    }
    q.push([d,rh],[0,rh]);
    const m=makeCard(q,{...o,seed:seed+(side>0?70:80),paint:P=>{
      P.fill('#668c87');P.layer(rect(0,rh-beam,d,beam),CREAM,{depth:.25});
      P.layer(g=>{g.fillStyle='#c9d0b3';for(const a of positions)g.fillRect(a+.015,.025,pw*.40,rh-beam-.02);},CREAM,{depth:.18});finish(P);
    },folds:['bottom']});
    m.name=side<0?'pier left handrail':'pier right handrail';m.rotation.order='YXZ';m.rotation.y=Math.PI/2;m.position.set(side*(w/2-.055),.025,0);deck.add(m);rails.push([m,side]);
  };
  rail(-1);rail(1);
  const followPlatform=p.userData.follow;
  p.userData.follow=progress=>{
    followPlatform(progress);
    const k=unfold(progress),a=p.parent?p.parent.rotation.x:0;
    // The deck stays level during the rise; its rail cards therefore need their
    // own crease rotation. Cross supports stay parallel to the front posts.
    supports.forEach(m=>{m.rotation.x=a;m.position.y=.03*(1-k)-.046*k;});
    rails.forEach(([m,side])=>{m.rotation.x=-side*Math.PI/2*(1-k);m.position.y=.025+.025*(1-k);});
  };
  p.userData.follow(1);
  p.userData.railBounds=[{x:-w/2+.055,z0:-d,z1:0},{x:w/2-.055,z0:-d,z1:0}];
  p.userData.clearWalkWidth=w-.32;
  return p;
}

/** A two-metre timber waterfront bench with open folded side supports. */
export function makeBench(H,{seed=1,x=0,z=0}={}) {
  const {THREE}=H,g=new THREE.Group(),o=opts(H,x,z,seed,.04);g.name='Costanera bench';
  const side=[[-.29,0],[-.16,0],[-.13,.39],[.24,.39],[.27,0],[.40,0],[.35,.48],[-.26,.48]];
  for(const s of [-1,1]){
    const m=makeCard(side,{...o,paint:P=>{
      P.fill('#3e6968');P.layer(rect(-.25,.40,.57,.07),'#89a393',{depth:.22});
      P.layer(rect(-.22,.05,.04,.31),'#abc0a5',{depth:.17});finish(P);
    },folds:['bottom']});m.rotation.y=Math.PI/2;m.position.x=s*.73;m.name='bench folded side';g.add(m);
  }
  const seat=makeCard(rect(-1,0,2,.68),{...o,paint:P=>woodPrint(P,{base:'#c39764'}),folds:[]});
  seat.rotation.x=-Math.PI/2;seat.position.set(0,.505,.30);seat.name='bench seat';g.add(seat);
  const back=makeCard(rect(-1,.65,2,.45),{...o,paint:P=>woodPrint(P,{base:'#bd925e'}),folds:[]});
  back.position.z=-.375;back.name='bench back';g.add(back);
  // Two rear uprights are separate from the low seat side cards.
  for(const s of [-1,1]){
    const m=makeCard(rect(-.045,.49,.09,.58),{...o,paint:P=>{
      P.fill('#3c6966');P.layer(rect(-.03,.52,.025,.50),'#93aa8e',{depth:.12});finish(P);
    },folds:[]});m.position.set(s*.73,0,-.415);m.name='bench back upright';g.add(m);
  }
  const panels=g.children.map((m,i)=>({m,ry:m.rotation.y,rx:m.rotation.x,z:m.position.z,flatZ:.012+i*.045}));
  g.userData.follow=p=>{
    const k=unfold(p);
    panels.forEach(({m,ry,rx,z,flatZ})=>{m.rotation.y=ry*k;m.rotation.x=rx*k;m.position.z=flatZ+(z-flatZ)*k;});
  };
  g.userData.follow(1);
  g.userData.height=1.1;return g;
}

/** A slotted painted-metal paper lantern, 2.8 high; call H.glowing(group) if desired. */
export function makeLamp(H,{seed=1,x=0,z=0}={}) {
  const q=[[-.18,0],[.18,0],[.18,.14],[.075,.25],[.075,2.08],[.20,2.12],[.25,2.48],
    [.31,2.50],[.20,2.64],[.06,2.73],[.045,2.80],[-.045,2.80],[-.06,2.73],[-.20,2.64],[-.31,2.50],[-.25,2.48],[-.20,2.12],[-.075,2.08],[-.075,.25],[-.18,.14]];
  const paint=P=>{
    P.fill('#365e61');P.layer(rect(-.052,.23,.041,1.87),'#8baca0',{depth:.22});
    P.layer([[-.16,2.17],[.16,2.17],[.19,2.44],[-.19,2.44]],'#e8ce8d',{depth:.25});
    P.layer(rect(-.017,2.16,.034,.29),'#547876',{depth:.18});
    P.layer([[-.23,2.51],[.23,2.51],[.08,2.65],[-.08,2.65]],'#6a9185',{depth:.25});
    P.layer(rect(-.15,.05,.30,.04),'#c5bb8c',{depth:.19});
    P.glow(g=>g.fillRect(-.15,2.20,.30,.21));finish(P);
  };
  const g=crossCard(q,{...opts(H,x,z,seed,.04),paint});g.name='Costanera lantern';g.userData.height=2.8;
  return g;
}
