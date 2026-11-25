/* Biblioteca de cartas de San Martín. Impresiones originales, CC BY-SA 4.0.
 * Ver references.json para autores, fotos y límites de la interpretación.
 * Se instancia un maestro por tipología; las copias comparten TODOS los materiales.
 */
import { boxFold, prismFold, makeCard } from 'papercraft/lib/paperkit-3d.js';
import { shade } from 'papercraft/lib/paperkit-2d.js';
import { stock, wood, stones, layerRect as rect, rearFlap, printedExteriors, composeFollow, chimney } from '../architecture.js';
import { TYPE_BY_ID } from './typologies.js';
import { stabilizeFold } from '../paper-fold.js';

const chimneyPrints=new WeakMap();
const edgeInks=new WeakMap();
// Misma lámina, distinta posición en el pliego. Ajustar UV una vez permite
// compartir el material exacto, no sólo la imagen, y ahorrar draw calls.
function reuseArt(source,target){
  const a=source.material[0],b=target.material[0],am=a.map,bm=b.map;
  if(!am||!bm)return;
  const uv=target.geometry.attributes.uv;
  for(let i=0;i<uv.count;i++)uv.setXY(i,
    (uv.getX(i)*bm.repeat.x+bm.offset.x-am.offset.x)/am.repeat.x,
    (uv.getY(i)*bm.repeat.y+bm.offset.y-am.offset.y)/am.repeat.y);
  uv.needsUpdate=true;target.material=[a,source.material[1],a];
}
const firstMesh=group=>group.children.find(c=>c.isMesh);

function opening(P, x, y, w, h, palette, { door = false, split = 1 } = {}) {
  const b = Math.min(w, h) * .085;
  rect(P, x-b, y-b, w+2*b, h+2*b, palette.timber, { depth: .6, lip: .5, shadow: .75 });
  rect(P, x, y, w, h, palette.trim, { depth: .35, lip: .4 });
  rect(P, x+b, y+b, w-2*b, h-2*b, palette.glass, { depth: .2, lip: .2 });
  P.draw(g => {
    g.fillStyle = '#aebfb5';
    g.beginPath(); g.moveTo(x+b, y+h-b); g.lineTo(x+w*.55, y+h-b); g.lineTo(x+b, y+h*.3); g.fill();
    g.fillStyle = palette.trim;
    for (let i=1;i<split;i++) g.fillRect(x+w*i/split-b*.3, y+b, b*.6, h-b*2);
    if (door) { g.fillStyle=palette.timber; g.fillRect(x+w*.8, y+h*.45, b*.65, b); }
  });
  rect(P, x-b*1.5, y-b*1.8, w+b*3, b*.8, palette.trim, { depth: .55 });
}

function siding(P, t) {
  const b=P.box, p=t.palette, upper=t.wallH*.48;
  P.fill(p.facade); P.felt(.26);
  if(t.surface==='timber') wood(P,{color:p.timber,logs:12,vertical:t.frontGable});
  if(t.surface==='mixed') {
    rect(P,b.x0,upper,b.w,b.y1-upper,p.timber,{depth:.25,lip:.25});
    P.draw(g=>{g.fillStyle=shade(p.timber,-.13);for(let y=upper;y<b.y1;y+=.17)g.fillRect(b.x0,y,b.w,.024);});
  }
  stones(P,{bottom:0,top:t.wallH*t.plinth,color:p.stone,rows:3});
  rect(P,b.x0,t.wallH-.10,b.w,.10,p.timber,{depth:.45,lip:.4});
  if(t.storeys>1)rect(P,b.x0,t.wallH/t.storeys-.045,b.w,.09,p.timber,{depth:.5,lip:.4});
  if(t.halfTimber) {
    P.draw(g=>{
      g.strokeStyle=p.timber;g.lineWidth=.075;
      const floor=t.wallH/t.storeys;
      for(let i=0;i<=4;i++){const x=b.x0+i*b.w/4;g.beginPath();g.moveTo(x,floor);g.lineTo(x,t.wallH);g.stroke();}
      for(let i of [0,3]) {const x=b.x0+i*b.w/4;g.beginPath();g.moveTo(x,floor);g.lineTo(x+b.w/4,t.wallH);g.moveTo(x,t.wallH);g.lineTo(x+b.w/4,floor);g.stroke();}
    });
  }
}

function balcony(P, t, y) {
  const b=P.box, x=b.x0+b.w*.08, w=b.w*.84, h=.32, p=t.palette;
  rect(P,x-.05,y-.07,w+.1,.1,p.trim,{depth:.8,shadow:.75});
  P.layer(g=>{
    g.fillStyle=p.timber;g.fillRect(x,y+h,w,.055);
    for(let i=0;i<=12;i++)g.fillRect(x+w*i/12,y,.027,h);
  },p.timber,{depth:.65,lip:.5});
}

function facade(t,{main=false,peak=false}={}) {
  return P=>{
    siding(P,t);
    const b=P.box,p=t.palette,fh=t.wallH/t.storeys;
    if(main&&t.shop){
      for(let i=0;i<3;i++) opening(P,b.x0+b.w*(.065+i*.30),.12,b.w*.265,fh*.62,p,{door:i===1,split:i===1?1:2});
      // Cartel sin marca inventada; trazos gráficos de tinta de la maqueta.
      rect(P,b.x0+b.w*.04,fh*.80,b.w*.92,fh*.15,p.timber,{depth:.55,lip:.5});
      P.draw(g=>{g.fillStyle=p.trim;for(let i=0;i<7;i++)g.fillRect(b.x0+b.w*(.25+i*.075),fh*.858,b.w*(i%3===0?.043:.030),.035);});
    } else {
      const count=main?3:2;
      for(let i=0;i<count;i++) {
        const ww=b.w*(count===3?.18:.24),x=b.x0+b.w*(count===3?.09+i*.32:.14+i*.48);
        opening(P,x,main&&i===1?.04:fh*.27,ww,main&&i===1?fh*.77:fh*.47,p,{door:main&&i===1,split:main&&i!==1?2:1});
      }
    }
    for(let row=1;row<t.storeys;row++){
      const n=t.id==='low-apartment'?3:2;
      for(let i=0;i<n;i++)opening(P,b.x0+b.w*(.10+i*(.8/n)),row*fh+fh*.23,b.w*(n===3?.20:.26),fh*.49,p,{split:2});
      if(t.balcony&&main)balcony(P,t,row*fh+fh*.18);
    }
    if(peak){
      const ww=b.w*.18;opening(P,b.x0+(b.w-ww)/2,t.wallH+t.roofH*.16,ww,t.roofH*.28,p,{split:1});
    }
  };
}

function corrugatedRoof(t) {
  return P=>{
    const b=P.box,c=t.palette.roof;
    P.fill(c);P.felt(.24);
    // Chapa plegada: juntas de pie longitudinales, no tejas de chalet genérico.
    P.layer(g=>{
      g.fillStyle=shade(c,.13);
      for(let x=b.x0;x<b.x1;x+=.23)g.fillRect(x,b.y0,.025,b.h);
    },shade(c,.13),{depth:.28,lip:.45,shadow:.35});
    P.draw(g=>{
      g.fillStyle=shade(c,-.14);
      for(let x=b.x0+.035;x<b.x1;x+=.23)g.fillRect(x,b.y0,.016,b.h);
      g.fillStyle=shade(c,.22);g.fillRect(b.x0,b.y0,b.w,.045);
    });
  };
}

export function makeLocalBuilding(H,id) {
  const t=TYPE_BY_ID.get(id);
  if(!t)throw new Error(`Tipología desconocida: ${id}`);
  const {w,d,wallH,roofH}=t,seed=20000+[...TYPE_BY_ID.keys()].indexOf(id)*101;
  const s=stock(H,{x:0,z:-25,seed,res:.6});
  let body,chimneyNode;
  if(t.flat){
    body=prismFold([[-w/2,0],[w/2,0],[w/2,-d],[-w/2,-d]],{
      ...s,h:wallH+roofH,roof:'flat',paints:{wall:[facade(t,{main:true}),facade(t),facade(t),facade(t)],roof:corrugatedRoof(t)},
    });
  }else{
    const bw=t.frontGable?d:w,bd=t.frontGable?w:d;
    body=boxFold({...s,w:bw,d:bd,wallH,roofH,overhang:.17,
      paints:{front:facade(t,{main:!t.frontGable}),gable:facade(t,{main:t.frontGable,peak:true}),roof:corrugatedRoof(t)}});
    const additions=[rearFlap(H,body,s,{w:bw,d:bd,wallH,paint:facade(t),seed})];
    if(t.chimney){
      additions.push(chimney(H,body,s,{x:-bw*.22,w:.34,d:.30,h:.63}));
      chimneyNode=body.userData.ridge.children.at(-1);
    }
    if(t.dormers){
      for(const x of [-bw*.25,bw*.25]){
        const h=.73,ww=bw*.23;
        const dormer=makeCard([[-ww/2,0],[ww/2,0],[ww/2,h*.67],[0,h],[-ww/2,h*.67]],{
          ...s,seed:seed+17,paint:P=>{
            P.fill(t.palette.timber);P.felt(.25);
            opening(P,-ww*.29,.13,ww*.58,h*.40,t.palette,{split:2});
            P.draw(g=>{g.strokeStyle=t.palette.trim;g.lineWidth=.04;g.beginPath();g.moveTo(-ww/2,h*.67);g.lineTo(0,h);g.lineTo(ww/2,h*.67);g.stroke();});
          }});
        dormer.position.set(x,-roofH*.70,bd*.29);body.userData.ridge.add(dormer);
      }
    }
    composeFollow(body,additions);
    if(t.frontGable){body.rotation.y=Math.PI/2;body.position.set(w/2,0,-d/2);}
  }
  printedExteriors(body);
  if(!t.flat){
    const parts=body.userData.parts;
    reuseArt(firstMesh(parts.right),firstMesh(parts.left));
    reuseArt(firstMesh(parts.roofFront),firstMesh(parts.roofBack));
  }
  if(chimneyNode){
    const cards=[];chimneyNode.traverse(o=>{if(o.isMesh)cards.push(o);});
    const shared=chimneyPrints.get(H);
    if(shared)cards.forEach((card,i)=>reuseArt(shared[i],card));
    else{reuseArt(cards[0],cards[2]);reuseArt(cards[1],cards[3]);chimneyPrints.set(H,cards);}
  }
  const node=new H.THREE.Group();node.add(body);
  let canopy;
  if(t.canopy){
    canopy=makeCard([[-w*.49,0],[w*.49,0],[w*.49,.60],[-w*.49,.60]],{...s,seed:seed+37,paint:corrugatedRoof(t),back:'mirror'});
    canopy.position.set(0,wallH/t.storeys*.81,.07);node.add(canopy);
  }
  // Tres tintas de canto para toda la biblioteca: cartulina clara, media y
  // oscura. El canto es minúsculo; compartirlo ahorra decenas de materiales.
  if(!edgeInks.has(H))edgeInks.set(H,new Map());
  const inks=edgeInks.get(H);
  node.traverse(o=>{
    if(!o.isMesh||!Array.isArray(o.material))return;
    const m=o.material[1],c=m.color,l=.2126*c.r+.7152*c.g+.0722*c.b;
    const bucket=l<.08?0:l<.18?1:2;
    if(!inks.has(bucket))inks.set(bucket,m);
    o.material=[o.material[0],inks.get(bucket),o.material[2]];
  });
  node.name=t.name;node.userData.follow=p=>{
    body.userData.follow(p);
    if(t.frontGable){
      const a=Math.min(1,Math.max(0,(p-.12)/.7)),open=a*a*(3-2*a);
      body.rotation.y=Math.PI/2*open;body.position.set(w/2*open,0,-d/2*open);
    }
    if(canopy)canopy.rotation.x=-Math.PI*.46*p;
  };
  node.userData.follow(1);
  node.userData.dimensions={w,d,wallH,roofH};node.userData.height=wallH+roofH+.15;
  node.userData.typology=id;
  return stabilizeFold(node,H.THREE);
}
