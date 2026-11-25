/*
 * San Martín de los Andes: original illustrated architecture for the Papercraft kit.
 * Front faces look toward +z; each plan extends from z=0 back to z=-d.
 * Everything is cut card. The photographs inform silhouettes and materials,
 * while proportions are condensed for the miniature city.
 */
import { boxFold, prismFold, makeCard } from 'papercraft/lib/paperkit-3d.js';
import { shade, rng, shape, draw2 as D } from 'papercraft/lib/paperkit-2d.js';

// Helpers de impresión de la copia V2; la arquitectura original queda congelada.
export { stock, wood, stones, layerRect, rearFlap, printedExteriors, composeFollow, chimney };

const C = {
  honey: '#a87342', lightWood: '#c59962', darkWood: '#704d36',
  stone: '#91a2a2', stoneDark: '#667c80', stoneLight: '#bbc4b8',
  cream: '#efe4c8', glass: '#5e8992', glassLight: '#b4c9bd',
  trim: '#e3ca9d', green: '#42675b', slate: '#53656b',
  clay: '#a45e49', ink: '#3b3930'
};

const rect = (x, y, w, h) => [[x,y],[x+w,y],[x+w,y+h],[x,y+h]];
const layerRect = (P,x,y,w,h,col,opts={}) => P.layer(rect(x,y,w,h),col,opts);
const smooth = (a,b,x) => { const t=Math.min(1,Math.max(0,(x-a)/(b-a))); return t*t*(3-2*t); };

function stock(H, {x=0,z=0,seed=1,res=0.95}={}) {
  const print = H.cardOpts(x,z,1,null,res);
  return {paper:H.paper,seed,thickness:0.065,edgeWidth:0.045,
    pxPerUnit:print.pxPerUnit,effects:print.effects,print};
}

function wood(P, {color=C.honey, bottom=P.box.y0, top=P.box.y1, logs=7, vertical=false}={}) {
  const b=P.box, size=(vertical?b.w:top-bottom)/logs;
  P.gradient(shade(color,0.17),shade(color,-0.13),0.6);
  P.felt(0.32);
  for(let tone=0;tone<3;tone++) {
    const col=shade(color,[-0.1,0.02,0.16][tone]);
    P.layer(g=>{
      g.fillStyle=col;
      for(let i=tone;i<logs;i+=3) {
        if(vertical) g.fillRect(b.x0+i*size+0.025,bottom,size-0.05,top-bottom);
        else g.fillRect(b.x0-0.03,bottom+i*size+0.025,b.w+0.06,size-0.045);
      }
    },col,{lip:0.7,shadow:0.65,depth:0.45});
  }
  P.draw(g=>{
    g.fillStyle=shade(color,-0.34);
    if(!vertical) for(let i=0;i<logs;i++) {
      const yy=bottom+(i+0.62)*size;
      for(let j=0;j<2;j++) {
        const xx=b.x0+b.w*(0.14+j*0.52)+(i%3)*0.08;
        D.ell(g,xx,yy,0.14,0.025,0);
      }
    }
  });
}

function stones(P, {bottom=0,top=P.box.y1,color=C.stone,rows=5}={}) {
  const b=P.box, rowH=(top-bottom)/rows, block=Math.max(0.3,rowH*1.7);
  layerRect(P,b.x0,bottom,b.w,top-bottom,shade(color,-0.19),{shadow:0.2,lip:0.2});
  for(let tone=0;tone<3;tone++) {
    const col=shade(color,[-0.08,0.08,0.22][tone]);
    P.layer(g=>{
      g.fillStyle=col;
      for(let j=0;j<rows;j++) for(let i=-1;i<b.w/block+1;i++) {
        if(((i+j*2)%3+3)%3!==tone)continue;
        const xx=b.x0+i*block+(j%2)*block*0.48;
        const yy=bottom+j*rowH;
        D.poly(g,[[xx+0.035,yy+0.035],[xx+block-0.035,yy+0.045],
          [xx+block-0.055,yy+rowH-0.035],[xx+0.05,yy+rowH-0.02]]);
      }
    },col,{lip:0.55,shadow:0.45,depth:0.38});
  }
}

function windowPrint(P,x,y,w,h,{shutters=false,shutter=C.green,split=2,glow=false,warm=false}={}) {
  const border=Math.max(0.055,w*0.075);
  layerRect(P,x-border,y-border,w+border*2,h+border*2,C.darkWood,{lip:0.7,shadow:0.9});
  layerRect(P,x,y,w,h,C.trim,{lip:0.6,shadow:0.65,depth:0.6});
  layerRect(P,x+border,y+border,w-border*2,h-border*2,warm?'#d9b478':C.glass,{lip:0.25,shadow:0.4,depth:0.2});
  P.draw(g=>{
    g.fillStyle=warm?'#f5dca6':C.glassLight;
    D.poly(g,[[x+border,y+h-border],[x+w*0.47,y+h-border],[x+border,y+h*0.44]]);
    g.fillStyle=C.cream;
    for(let k=1;k<split;k++)g.fillRect(x+w*k/split-border*0.35,y+border,border*0.7,h-border*2);
    g.fillRect(x+border,y+h*0.52,w-border*2,border*0.65);
  });
  if(shutters) for(const xx of [x-w*0.31-border,x+w+border]) {
    layerRect(P,xx,y,w*0.27,h,shutter,{lip:0.6,depth:0.7});
    P.draw(g=>{
      g.fillStyle=shade(shutter,0.25);
      for(let k=1;k<4;k++)g.fillRect(xx+0.035,y+k*h/4,w*0.27-0.07,0.035);
    });
  }
  layerRect(P,x-border*1.8,y-border*1.8,w+border*3.6,border*0.9,C.cream,{depth:0.6});
  if(glow)P.glow(g=>{g.fillStyle='#bdbdbd';g.fillRect(x+border,y+border,w-border*2,h-border*2);});
}

function doorPrint(P,x,y,w,h,{double=false,glass=true}={}) {
  layerRect(P,x-0.075,y,w+0.15,h+0.085,C.darkWood,{lip:0.7});
  layerRect(P,x,y,w,h,C.lightWood,{lip:0.7,shadow:0.8});
  if(glass) {
    const panes=double?2:1;
    for(let k=0;k<panes;k++)windowPrint(P,x+0.11+k*w/panes,y+h*0.49,w/panes-0.22,h*0.38,{split:1});
  }
  P.draw(g=>{
    g.fillStyle=C.darkWood;
    g.fillRect(x+w*(double?0.49:0.14),y+0.1,0.035,h-0.18);
    g.fillRect(x+w*0.82,y+h*0.43,0.07,0.07);
    if(double)g.fillRect(x+w*0.39,y+h*0.43,0.07,0.07);
  });
}

function roofPrint(color=C.green,{rows=7}={}) {
  return P=>{
    const b=P.box,r=P.r;
    P.fill(shade(color,-0.16)); P.felt(0.27);
    const rowH=b.h/rows;
    for(let j=0;j<rows;j++) {
      const yy=b.y0+j*rowH, tone=shade(color,[-0.06,0.05,0.16][j%3]);
      P.layer(g=>{
        g.fillStyle=tone;
        const n=Math.max(4,Math.ceil(b.w/0.46)),dx=b.w/n;
        for(let k=-1;k<=n;k++) {
          const xx=b.x0+k*dx+(j%2)*dx/2;
          D.poly(g,[[xx+0.02,yy],[xx+dx-0.012,yy+0.01],
            [xx+dx-0.028,yy+rowH+0.06],[xx+0.025,yy+rowH+0.055]]);
        }
      },tone,{lip:0.75,shadow:0.65,depth:0.45});
    }
    P.draw(g=>{g.fillStyle=shade(color,0.3);g.fillRect(b.x0,b.y0,b.w,0.06);});
  };
}

function composeFollow(node, additions=[]) {
  const own=node.userData.follow;
  node.userData.follow=p=>{
    own?.(p);
    additions.forEach(fn=>fn(p));
  };
  node.userData.follow(1);
}

function chimney(H,node,s,{x=0,w=0.55,h=1.05,d=0.47}={}) {
  const ch=prismFold([[-w/2,0],[w/2,0],[w/2,-d],[-w/2,-d]],{
    ...s,h,roof:'flat',paints:{wall:P=>stones(P,{rows:4,color:C.stoneDark}),roof:P=>{
      P.fill(C.ink); const b=P.box;
      layerRect(P,b.x0+0.06,b.y0+0.06,b.w-0.12,b.h-0.12,'#675e4b',{depth:0.5});
    }}
  });
  ch.position.set(x,-0.04,0.11);
  node.userData.ridge.add(ch);
  const smoke=new H.THREE.Object3D();smoke.position.set(0,h,-d/2);ch.add(smoke);
  node.userData.chimneyTop=smoke;
  return p=>ch.userData.follow(p);
}


// The kit's box is open at the rear. Close it with a hinged printed rear wall,
// and print both faces of every exposed sheet for oblique city views.
function printedExteriors(node){
  // The native Canvas rasterizer can empty an entirely negative-x gable clip.
  // Its opposite gable has the identical silhouette and valid print: share that
  // image, retaining the left sheet's UV translation. This also saves a texture.
  node.traverse(g=>{
    const parts=g.userData.parts;
    if(!parts?.left||!parts?.right)return;
    const left=parts.left.children.find(m=>m.isMesh),right=parts.right.children.find(m=>m.isMesh);
    if(!left?.material?.[0]?.map||!right?.material?.[0]?.map)return;
    const good=right.material[0],uv=left.material[0].map;
    const face=good.clone();face.map=good.map.clone();
    face.map.repeat.copy(uv.repeat);face.map.offset.copy(uv.offset);face.map.needsUpdate=true;
    left.material=[face,left.material[1],face];
  });
  node.traverse(m=>{if(m.isMesh&&Array.isArray(m.material)&&m.material.length>2)m.material=[m.material[0],m.material[1],m.material[0]];});
}
function rearFlap(H,node,s,{w,d,wallH,paint,seed=1}){
  const pivot=new H.THREE.Group();pivot.position.set(d,0,0);node.userData.parts.right.add(pivot);
  const card=makeCard(shape.rect(w,wallH),{...s,seed:seed+421,paint,back:'mirror',folds:['bottom','left','right']});card.position.x=w/2;pivot.add(card);
  return p=>{pivot.rotation.y=Math.PI/2*smooth(.18,.82,p);};
}

/** Five warm facade families; one/two storeys and fully printed exterior walls. */
export function makeChalet(H,opts={}) {
  const {w=4,d=3.2,wallH=2.4,roofH=1.6,seed=1}=opts;
  const s=stock(H,opts),r=rng(seed),variant=((seed%5)+5)%5;
  const template=((Math.round((seed-30)/13)%5)+5)%5;
  const storeys=opts.storeys??(wallH>=2.5&&template>=2?2:1),floorH=wallH/storeys;
  const roof=opts.roof||[C.green,C.clay,C.slate,'#657762','#855747'][variant];
  const timber=[C.honey,'#af8053','#a57a51','#bb9465','#917052'][variant];
  const stucco=['#d9d1b4','#dfcfab','#c6c1a7','#e3d5b5','#d6c5a5'][variant];
  const surface=P=>{
    if(variant===1||variant===3||variant===4){
      P.fill(stucco);P.felt(.27);
      const b=P.box;layerRect(P,b.x0,0,b.w,wallH*.46,shade(stucco,-.055),{depth:.28,lip:.2});
      layerRect(P,b.x0,wallH*.78,b.w,wallH*.22,shade(timber,.14),{depth:.35,lip:.4});
      for(let i=0;i<4;i++)layerRect(P,b.x0,wallH*(.79+i*.05),b.w,wallH*.026,shade(timber,-.05+i*.045),{depth:.18,lip:.2});
    }else wood(P,{color:timber,logs:storeys===2?12:8});
    stones(P,{bottom:0,top:wallH*(variant===2?.31:.16),color:C.stone,rows:variant===2?3:2});
    const b=P.box;layerRect(P,b.x0+.035,wallH-.12,b.w-.07,.11,C.darkWood,{depth:.55});
    if(storeys>1)layerRect(P,b.x0+.035,floorH-.075,b.w-.07,.10,C.darkWood,{depth:.6});
  };
  const front=P=>{
    surface(P);
    const ww=w*.17,wh=floorH*.43,y=floorH*.30;
    windowPrint(P,-w*.36,y,ww,wh,{shutters:variant===0||variant===2,warm:true});
    windowPrint(P,w*.19,y,ww,wh,{shutters:variant===0||variant===2,warm:variant!==3});
    doorPrint(P,-w*.075,.03,w*.15,floorH*.78);
    if(storeys>1){
      const count=variant===4?3:2;
      for(let i=0;i<count;i++){const xx=count===3?-w*.34+i*w*.27:-w*.30+i*w*.43;windowPrint(P,xx,floorH*1.27,ww,floorH*.43,{shutters:variant===2,warm:true});}
      if(variant===1||variant===3||variant===4){
        const bx=-w*.37,by=floorH*1.18,bw=w*.74,bh=floorH*.23;
        layerRect(P,bx-.04,by-.045,bw+.08,.09,C.cream,{depth:.8});
        layerRect(P,bx,by+bh,bw,.06,C.darkWood,{depth:.7});
        P.layer(g=>{for(let j=0;j<9;j++)g.fillRect(bx+j*bw/8,by,.045,bh);},shade(timber,-.15),{depth:.65,lip:.45});
      }
    }
    layerRect(P,-w/2+.035,.06,.065,wallH-.12,shade(timber,-.28),{depth:.4});
    layerRect(P,w/2-.10,.06,.065,wallH-.12,shade(timber,-.28),{depth:.4});
    if(variant===1||variant===4){
      layerRect(P,-w*.35,y-.13,w*.19,.11,C.clay,{depth:.7});
      P.parts((g,ink)=>{for(let i=0;i<5;i++){g.fillStyle=ink(i%2?'#e9bf79':'#9eaa73');D.ell(g,-w*.33+i*w*.033,y-.005,.055,.06,0);}},{depth:.4});
    }
  };
  const gable=P=>{
    surface(P);const cx=P.box.x0+P.box.w/2;
    for(let row=0;row<storeys;row++)for(const sign of [-1,1])windowPrint(P,cx+sign*d*.25-d*.085,row*floorH+floorH*.31,d*.17,floorH*.41,{warm:variant!==3,shutters:variant===2});
    windowPrint(P,cx-d*.07,wallH+roofH*.15,d*.14,roofH*.25,{split:1,warm:true});
  };
  const rear=P=>{surface(P);const b=P.box;for(let row=0;row<storeys;row++)for(let col=0;col<3;col++)windowPrint(P,b.x0+w*.13+col*w*.27,row*floorH+floorH*.30,w*.14,floorH*.42,{warm:col!==1});};
  const node=boxFold({w,d,wallH,roofH,overhang:.2,...s,paints:{front,gable,roof:roofPrint(roof)}});
  node.name=storeys>1?'Casa patagónica de dos plantas':'Chalet patagónico';
  const follows=[rearFlap(H,node,s,{w,d,wallH,paint:rear,seed})];
  if(variant!==3)follows.push(chimney(H,node,{...s,seed:seed+91},{x:(r()-.5)*w*.42,h:.8,w:.44,d:.39}));
  composeFollow(node,follows);printedExteriors(node);
  node.userData.dimensions={w,d,wallH,roofH};node.userData.height=wallH+roofH+.8;node.userData.storeys=storeys;
  return node;
}

/** A miniature interpretation of the old Lanín park headquarters, after its photographed facade. */
export function makeLaninLodge(H,opts={}) {
  const {w=9,d=4,wallH=3.6,roofH=2,seed=401}=opts,s=stock(H,{...opts,seed});
  const roof=opts.roof||C.slate, lower=wallH*.47;
  const facade=P=>{
    wood(P,{color:C.honey,logs:11});
    stones(P,{bottom:0,top:lower,color:C.stone,rows:5});
    layerRect(P,-w/2,lower-.06,w,.15,C.darkWood,{depth:.7});
    for(const xx of [-w*.36,-w*.2,w*.19,w*.35]) {
      windowPrint(P,xx-w*.055,wallH*.17,w*.11,wallH*.24,{shutters:true,shutter:'#38594b'});
    }
    doorPrint(P,-w*.085,.03,w*.17,lower*.84,{double:true});
    for(const xx of [-w*.11,0,w*.11])windowPrint(P,xx-w*.045,lower+.29,w*.09,wallH*.24,{split:2});
    for(const xx of [-w/2+.08,w/2-.2])layerRect(P,xx,lower,.12,wallH-lower,C.lightWood,{depth:.6});
  };
  const gable=P=>{
    wood(P,{color:shade(C.honey,-.1),logs:14});
    stones(P,{bottom:0,top:lower,color:C.stone,rows:5});
    const x=P.box.x0+P.box.w/2;
    for(const xx of [x-d*.22,x+d*.22]) {
      windowPrint(P,xx-d*.1,.4,d*.2,lower*.55,{shutters:true});
      windowPrint(P,xx-d*.09,lower+.4,d*.18,.92,{split:2});
    }
    windowPrint(P,x-.25,wallH+.23,.5,.48,{split:1});
  };
  const node=boxFold({w,d,wallH,roofH,overhang:.28,...s,paints:{front:facade,gable,roof:roofPrint(roof,{rows:9})}});
  node.name='Antigua Intendencia del Parque Nacional Lanín';
  const dormerW=w*.145,dormerH=roofH*.8;
  for(let i=0;i<4;i++) {
    const dw=dormerW,dh=dormerH;
    const pts=[[-dw/2,0],[dw/2,0],[dw/2,dh*.65],[0,dh],[-dw/2,dh*.65]];
    const dormer=makeCard(pts,{...s,seed:seed+i*19+30,folds:['bottom'],paint:P=>{
      wood(P,{color:C.honey,logs:7});
      windowPrint(P,-dw*.31,dh*.08,dw*.62,dh*.48,{split:3});
      P.layer([[-dw*.58,dh*.62],[-dw*.49,dh*.58],[0,dh*.93],[dw*.49,dh*.58],[dw*.58,dh*.62],[0,dh*1.04]],C.lightWood,{lip:.8,shadow:.8});
    }});
    dormer.position.set([-0.36,-0.2,0.2,0.36][i]*w,wallH-.27,.115);
    node.add(dormer);
  }
  // A shallow sloping porch roof on two broad timber posts, also cut from sheets.
  const porchRoof=makeCard(shape.rect(w*.37,.93),{...s,seed:seed+201,paint:roofPrint(roof,{rows:3}),folds:['bottom']});
  porchRoof.position.set(0,lower+.16,.02);node.add(porchRoof);
  const postPts=[[-w*.2,0],[-w*.17,0],[-w*.17,lower*.95],[w*.17,lower*.95],[w*.17,0],[w*.2,0],[w*.2,lower*1.03],[-w*.2,lower*1.03]];
  const porchPosts=makeCard(postPts,{...s,seed:seed+205,paint:P=>wood(P,{color:C.lightWood,logs:3,vertical:true}),folds:['bottom']});
  porchPosts.position.z=.82;node.add(porchPosts);
  const follows=[chimney(H,node,{...s,seed:seed+308},{x:w*.12,w:.67,d:.55,h:1.28}),p=>{
    porchRoof.rotation.x=(Math.PI/2+.18)*smooth(.42,.95,p);
    porchPosts.position.z=.03+.79*smooth(.2,.7,p);
  }];
  follows.push(rearFlap(H,node,s,{w,d,wallH,paint:facade,seed}));
  composeFollow(node,follows);printedExteriors(node);
  node.userData.dimensions={w,d,wallH,roofH};node.userData.height=wallH+roofH+1.25;
  return node;
}

function clockPrint(P,cx,cy,r) {
  P.layer(g=>{g.fillStyle=C.ink;D.ell(g,cx,cy,r,r,0);},C.ink,{lip:.5,shadow:.8});
  P.layer(g=>{g.fillStyle=C.cream;D.ell(g,cx,cy,r*.87,r*.87,0);},C.cream,{lip:.6,shadow:.5,depth:.6});
  P.draw(g=>{
    g.fillStyle=C.ink;
    for(let k=0;k<12;k++) {
      const a=k*Math.PI/6;
      g.save();g.translate(cx+Math.sin(a)*r*.68,cy+Math.cos(a)*r*.68);g.rotate(-a);
      g.fillRect(-r*.035,-r*.11,r*.07,r*.22);g.restore();
    }
    D.poly(g,[[cx-.035,cy-.04],[cx-.34*r,cy+.28*r],[cx-.28*r,cy+.37*r],[cx+.04,cy+.035]]);
    D.poly(g,[[cx-.02,cy-.04],[cx+.44*r,cy+.33*r],[cx+.48*r,cy+.27*r],[cx+.035,cy+.03]]);
    D.ell(g,cx,cy,r*.1,r*.1,0);
  });
}

/** Stone municipal clock tower, with the low overhanging crown seen in the reference. */
export function makeClockTower(H,opts={}) {
  const {w=2.3,d=2.3,wallH=5,roofH=.7,seed=601}=opts,s=stock(H,{...opts,seed});
  const towerWall=index=>P=>{
    stones(P,{top:wallH,rows:14,color:'#a6a58e'});
    const b=P.box,cx=b.x0+b.w/2;
    layerRect(P,b.x0,wallH-.19,b.w,.13,'#715640',{depth:.6});
    for(let k=0;k<3;k++)layerRect(P,b.x0+b.w*(.16+k*.27),wallH-.41,b.w*.13,.15,C.ink,{depth:.2,lip:.2});
    if(index<2)clockPrint(P,cx,wallH*.73,b.w*.18);
    if(index===0) {
      doorPrint(P,cx-b.w*.18,.06,b.w*.36,wallH*.29,{glass:true});
      windowPrint(P,cx-b.w*.16,wallH*.35,b.w*.32,wallH*.15,{split:1});
    }
  };
  const node=prismFold([[-w/2,0],[w/2,0],[w/2,-d],[-w/2,-d]],{
    h:wallH,roof:'flat',...s,paints:{wall:[0,1,2,3].map(towerWall),roof:roofPrint('#765e4c',{rows:5})}
  });
  const cap=makeCard(shape.rect(w+.27,d+.27),{...s,seed:seed+80,paint:roofPrint('#765e4c',{rows:5})});
  cap.rotation.x=-Math.PI/2;cap.position.set(0,.045,(d+.27)/2);node.userData.top.add(cap);
  node.name='Torre del reloj municipal';
  printedExteriors(node);
  node.userData.dimensions={w,d,wallH,roofH:.1};node.userData.height=wallH+.13;
  return node;
}

/**
 * Existing lakeside bus terminal (Villegas 252): a low station hall with stone
 * facades, a shallow dark roof and a long boarding canopy. The open bus apron
 * belongs in front (+z). This is the current building, not the proposed new one.
 */
export function makeBusTerminal(H,opts={}) {
  const {w=10,d=3.8,wallH=2.1,roofH=.75,seed=811}=opts;
  const s=stock(H,{...opts,seed}), node=new H.THREE.Group();
  const roof=opts.roof||'#566064', limestone='#a3a699', trim='#537464';
  const front=P=>{
    stones(P,{top:wallH,rows:7,color:limestone});
    // Repeated glass door bays, protected by the actual station's long canopy.
    for(let i=0;i<5;i++) {
      const cx=-w*.4+i*w*.2;
      windowPrint(P,cx-w*.061,.12,w*.122,wallH*.66,{split:2});
    }
    layerRect(P,-w*.36,wallH*.77,w*.72,.3,'#547f91',{depth:.6,shadow:.55});
    layerRect(P,-w*.22,wallH*.78,w*.44,.28,'#ca8050',{depth:.35,shadow:.3});
    P.draw(g=>{
      g.save();
      g.translate(0,wallH*.81+.1);g.scale(1,-1);
      g.fillStyle=C.cream;g.font=`bold ${Math.max(.11,w*.016)}px sans-serif`;
      g.textAlign='center';g.textBaseline='middle';g.fillText('TERMINAL DE ÓMNIBUS',0,0,w*.4);
      g.restore();
    });
  };
  const side=P=>{
    stones(P,{top:wallH,rows:7,color:limestone});
    const b=P.box,cx=b.x0+b.w/2;
    layerRect(P,b.x0,wallH-.18,b.w,.17,trim,{depth:.65});
    windowPrint(P,cx-d*.15,wallH*.38,d*.3,wallH*.35,{split:2});
  };
  const hall=boxFold({w,d,wallH,roofH,overhang:.24,...s,
    paints:{front,gable:side,roof:roofPrint(roof,{rows:5})}});
  composeFollow(hall,[rearFlap(H,hall,s,{w,d,wallH,paint:front,seed})]);
  node.add(hall);

  // A small light-coloured upper service volume behind the platform facade.
  const upperW=w*.48,upperD=d*.46,upperH=wallH*.35;
  const upper=prismFold([[-upperW/2,0],[upperW/2,0],[upperW/2,-upperD],[-upperW/2,-upperD]],{
    ...s,seed:seed+60,h:upperH,roof:'flat',paints:{wall:P=>{
      P.gradient('#e8e5d5','#c9cbbd',.5);P.felt(.28);
      const b=P.box;
      layerRect(P,b.x0,0,b.w,.1,'#89958a',{depth:.5});
      const n=Math.max(2,Math.round(b.w/.95));
      for(let i=0;i<n;i++)windowPrint(P,b.x0+(i+.5)*b.w/n-.15,upperH*.33,.3,upperH*.33,{split:1});
    },roof:roofPrint(roof,{rows:3})}
  });
  upper.position.set(w*.12,wallH+roofH*.44,-d*.38);node.add(upper);

  // Open platform canopy: five wide bays, six stone posts, one thin folded lid.
  const canopyW=w*.96,canopyD=d*.34,canopyH=wallH*.77,postW=.13,bays=5;
  const posts=[[-canopyW/2,0],[-canopyW/2,canopyH],[canopyW/2,canopyH],[canopyW/2,0]];
  for(let i=bays;i>=0;i--) {
    const cx=-canopyW/2+i*canopyW/bays;
    if(i===bays)posts.push([cx-postW,0],[cx-postW,canopyH-.14]);
    else if(i===0)posts.push([cx+postW,canopyH-.14],[cx+postW,0]);
    else posts.push([cx+postW/2,canopyH-.14],[cx+postW/2,0],[cx-postW/2,0],[cx-postW/2,canopyH-.14]);
  }
  const postCard=makeCard(posts,{...s,seed:seed+91,paint:P=>{
    P.fill(limestone);P.felt(.25);
    layerRect(P,-canopyW/2,canopyH-.16,canopyW,.16,trim,{depth:.65});
    P.draw(g=>{
      g.fillStyle=C.cream;
      for(let i=0;i<=bays;i++)g.fillRect(-canopyW/2+i*canopyW/bays-.025,.12,.035,canopyH-.4);
    });
  },folds:['bottom']});
  const canopyRoof=makeCard(shape.rect(canopyW+.2,canopyD+.13),{
    ...s,seed:seed+94,paint:roofPrint(trim,{rows:3}),folds:['bottom']});
  node.add(postCard,canopyRoof);
  node.userData.follow=p=>{
    hall.userData.follow(p);upper.userData.follow(p);
    const e=smooth(.34,.93,p),back=smooth(.2,.8,p);
    upper.position.z=-d*.38*back;
    postCard.position.z=canopyD*back;
    canopyRoof.position.set(0,canopyH+.035,canopyD*back+.035);
    canopyRoof.rotation.x=-Math.PI/2*e;
  };
  node.userData.follow(1);
  node.name='Terminal de Ómnibus de San Martín de los Andes';
  printedExteriors(node);
  node.userData.dimensions={w,d,wallH,roofH,canopyD};
  node.userData.height=wallH+Math.max(roofH,roofH*.44+upperH)+.08;
  return node;
}
