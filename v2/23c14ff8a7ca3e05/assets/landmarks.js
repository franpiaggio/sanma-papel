/* Arquitectura individual de San Martín. Cartas unitarias compartidas entre
 * edificios: piedra, madera, ventanas y cubiertas se instancian aunque cambie
 * el ancho de la fachada. Referencias y rasgos en landmark-references.json.
 */
import { makeCard } from 'papercraft/lib/paperkit-3d.js';
import { shade } from 'papercraft/lib/paperkit-2d.js';
import { LANDMARKS } from './landmark-specs.js';
import { makePlazaMonument } from '../cinematic-landmarks.js';
import { stabilizeFold } from '../paper-fold.js';

const cache=new WeakMap(),edges=new WeakMap();
const rect=[[-.5,0],[.5,0],[.5,1],[-.5,1]],tri=[[-.5,0],[.5,0],[0,1]];
const smooth=p=>{const t=Math.max(0,Math.min(1,p));return t*t*(3-2*t);};
function stamp(H,kind,color='#e7dfca'){
  if(!cache.has(H))cache.set(H,new Map());
  const stamps=cache.get(H),key=kind+color;
  if(stamps.has(key))return stamps.get(key);
  const circle=Array.from({length:24},(_,i)=>{const a=i/24*Math.PI*2;return [Math.cos(a)*.5,.5+Math.sin(a)*.5];});
  const shape=kind==='triangle'?tri:kind==='hip-roof'?[[-.5,0],[.5,0],[.25,1],[-.25,1]]:kind==='gambrel'?[[-.5,0],[.5,0],[.38,.65],[0,1],[-.38,.65]]:kind==='round'||kind==='clock'?circle:rect;
  const arch=[[-.25,.12],[.25,.12],[.25,.64],...Array.from({length:13},(_,i)=>{const a=i/12*Math.PI;return [Math.cos(a)*.25,.64+Math.sin(a)*.23];})];
  const card=makeCard(shape,{paper:H.paper,thickness:.025,edgeWidth:kind==='stone'?0:.018,pxPerUnit:112,seed:1930,back:'mirror',contact:null,holes:kind==='belfry'?[arch]:null,paint:P=>{
    P.fill(color);P.felt(.22);
    const gRect=(x,y,w,h,c)=>P.layer([[x,y],[x+w,y],[x+w,y+h],[x,y+h]],c,{depth:.28,lip:.3,shadow:.25});
    if(kind==='stone'){
      for(let row=0;row<6;row++)for(let col=-1;col<4;col++){
        const x=-.5+col*.32+(row%2)*.16,y=row/6;
        gRect(x+.014,y+.012,.292,.14,shade(color,[-.12,.12,.04][(row+col+4)%3]));
      }
    }
    if(kind==='timber'||kind==='vertical'||kind==='roof'||kind==='hip-roof'){
      P.draw(g=>{for(let i=0;i<13;i++){
        g.fillStyle=shade(color,i%3===0?.13:-.12);
        if(kind==='timber')g.fillRect(-.5,i/13,.999,.025);
        else g.fillRect(-.5+i/13,0,kind==='roof'?.013:.025,1);
      }});
    }
    if(['window','door','arch-window','shop','round'].includes(kind)){
      const b=.085;gRect(-.5+b,b,1-b*2,1-b*2,'#52747b');
      P.draw(g=>{
        g.fillStyle='#b4c5bc';g.beginPath();g.moveTo(-.41,.91);g.lineTo(.17,.91);g.lineTo(-.41,.31);g.fill();
        g.fillStyle=color;g.fillRect(-.018,.09,.036,.82);
        if(kind!=='door'&&kind!=='shop')g.fillRect(-.41,.48,.82,.035);
        if(kind==='arch-window'){g.strokeStyle=color;g.lineWidth=.075;g.beginPath();g.ellipse(0,.66,.36,.25,0,0,Math.PI);g.stroke();}
      });
    }
    if(kind==='clock')P.draw(g=>{
      g.fillStyle='#3d433a';for(let i=0;i<12;i++){const a=i*Math.PI/6;g.save();g.translate(Math.sin(a)*.37,.5+Math.cos(a)*.37);g.rotate(-a);g.fillRect(-.014,-.04,.028,.08);g.restore();}
      g.strokeStyle='#3d433a';g.lineWidth=.035;g.beginPath();g.moveTo(-.18,.67);g.lineTo(0,.5);g.lineTo(.24,.58);g.stroke();
    });
  }});
  // Todas las cartas comparten dos tintas de canto. Las caras y geometrías
  // unitarias se reutilizan sin crear una textura o geometría por ventana.
  if(!edges.has(H))edges.set(H,new Map());
  const ink=edges.get(H),dark=card.material[1].color.getHSL({}).l<.12;
  if(!ink.has(dark))ink.set(dark,card.material[1]);
  card.material=[card.material[0],ink.get(dark),card.material[0]];
  stamps.set(key,card);return card;
}
function sheet(H,parent,kind,color,x,y,w,h,z=0){
  const proto=stamp(H,kind,color),m=new H.THREE.Mesh(proto.geometry,proto.material);
  m.userData.card=proto.userData.card;
  m.name=kind;
  m.castShadow=m.receiveShadow=true;m.position.set(x,y,z);m.scale.set(w,h,1);parent.add(m);return m;
}
function sign(H,parent,text,x,y,w,h,z){
  const m=makeCard(rect,{paper:H.paper,thickness:.022,edgeWidth:.014,pxPerUnit:260,seed:1962,back:'mirror',contact:null,paint:P=>{
    P.fill('#4a5e51');P.felt(.18);P.draw(g=>{g.save();g.translate(0,.5);g.scale(1,-1);g.fillStyle='#eee6cc';g.textAlign='center';g.textBaseline='middle';g.font='600 .16px sans-serif';g.fillText(text,0,0,.92);g.restore();});
  }});m.position.set(x,y,z);m.scale.set(w,h,1);m.material=[m.material[0],m.material[1],m.material[0]];parent.add(m);
}
function railing(H,parent,p,x,y,w,h=.42,z=.1){
  sheet(H,parent,'plain',p.timber,x,y+h,w,.055,z);
  sheet(H,parent,'plain','#ddd9cb',x,y-.045,w+.1,.07,z);
  for(let i=0;i<=10;i++)sheet(H,parent,'plain',p.timber,x-w/2+i*w/10,y,.028,h,z);
}
function facade(H,group,p,{w,h,floors=2,columns=4,material='plaster',commercial=false,balconies=false,halfTimber=false,round=false,blank=false}={}){
  if(material==='stone'){
    const nx=Math.ceil(w/1.2),ny=Math.ceil(h/1.2),dx=w/nx,dy=h/ny;
    for(let y=0;y<ny;y++)for(let x=0;x<nx;x++)sheet(H,group,'stone',p.stone,-w/2+(x+.5)*dx,y*dy,dx,dy);
  }else sheet(H,group,material,p[material==='timber'?'timber':'facade'],0,0,w,h);
  if(blank)return;
  if(material!=='stone')sheet(H,group,'stone',p.stone,0,0,w,h*.13,.025);
  const fh=h/floors;
  for(let row=0;row<floors;row++){
    for(let col=0;col<columns;col++){
      const x=-w/2+w*(col+.5)/columns,door=!round&&row===0&&col===Math.floor(columns/2),ww=w/columns*(commercial&&row===0?.82:.60);
      const kind=round?'round':commercial&&row===0?'shop':door?'door':'window';
      const diameter=Math.min(ww,fh*.43);
      sheet(H,group,kind,'#ece5d2',x,row*fh+(round?fh*.42:door?.04:fh*.23),round?diameter:ww,round?diameter:door?fh*.77:fh*.52,.045);
    }
    if(row>0){
      sheet(H,group,'plain',p.timber,0,row*fh-.035,w,.075,.055);
      if(balconies)railing(H,group,p,0,row*fh+fh*.12,w*.96,.35,.15);
    }
  }
  if(halfTimber){
    for(let i=0;i<=columns;i++)sheet(H,group,'plain',p.timber,-w/2+w*i/columns,0,.065,h,.075);
    for(let row=1;row<floors;row++)sheet(H,group,'plain',p.timber,0,row*fh,w,.07,.075);
    for(let row=1;row<floors;row++)for(let col=0;col<columns;col++){
      const cell=w/columns,beam=sheet(H,group,'plain',p.timber,-w/2+cell*col,row*fh,.055,Math.hypot(cell,fh),.083);
      beam.rotation.z=-Math.atan2(cell,fh);
    }
  }
}

// Same folding net as boxFold, made from shared unit rectangles/triangles.
function volume(H,p,{w=8,d=4,h=3,r=1.4,floors=2,columns=4,material='plaster',commercial=false,balconies=false,halfTimber=false,round=false,frontGable=false,roof,roofShape='gable',blank=false,overhang=.17}={}){
  const T=H.THREE,root=new T.Group(),body=new T.Group();root.add(body);
  const bw=frontGable?d:w,bd=frontGable?w:d;
  const front=new T.Group(),right=new T.Group(),left=new T.Group(),rear=new T.Group();body.add(front,right,left);
  right.position.set(bw/2,0,-.03);left.position.set(-bw/2,0,-.03);rear.position.x=bd;right.add(rear);
  const wall=(g,width,main,xShift=0)=>{
    const panel=new T.Group();panel.position.x=xShift;g.add(panel);
    facade(H,panel,p,{w:width,h,floors,columns:main?columns:Math.max(1,Math.round(columns*width/bw)),material,commercial:main&&commercial,balconies:main&&balconies,halfTimber,round:main&&round,blank});
  };
  wall(front,bw,!frontGable);wall(right,bd,frontGable,bd/2);wall(left,bd,frontGable,-bd/2);wall(rear,bw,!frontGable,bw/2);
  const gableColor=material==='timber'||material==='vertical'?p.timber:p.facade;
  if(r>.01&&roofShape==='gable'){sheet(H,right,'triangle',gableColor,bd/2,h,bd,r);sheet(H,left,'triangle',gableColor,-bd/2,h,bd,r);}
  if(roofShape==='gambrel'){sheet(H,right,'gambrel',gableColor,bd/2,h,bd,r);sheet(H,left,'gambrel',gableColor,-bd/2,h,bd,r);}
  const roofFront=new T.Group(),roofBack=new T.Group();roofFront.position.set(0,h,.04);body.add(roofFront);
  const slope=Math.hypot(bd/2,r),phi=Math.atan2(r,bd/2);
  sheet(H,roofFront,'roof',roof||p.roof,0,-overhang,bw+overhang*2,slope+overhang);
  roofBack.position.y=slope;roofFront.add(roofBack);
  sheet(H,roofBack,'roof',roof||p.roof,0,0,bw+overhang*2,slope+overhang);
  const hip=[],roofJoints=[];
  if(roofShape==='gambrel'){
    body.remove(roofFront);
    const low=Math.hypot(bd*.12,r*.65),high=Math.hypot(bd*.38,r*.35),al=Math.atan2(bd*.12,r*.65),ah=Math.atan2(bd*.38,r*.35);
    let parent=body;
    for(const [i,length,angle] of [[0,low,-al],[1,high,al-ah],[2,high,-Math.PI+2*ah],[3,low,al-ah]]){
      const g=new T.Group();g.position.set(0,i?roofJoints.at(-1).length:h,i?0:.04);parent.add(g);
      sheet(H,g,'roof',roof||p.roof,0,0,bw+overhang*2,length);roofJoints.push({g,length,angle});parent=g;
    }
  }
  if(roofShape==='hip'){
    body.remove(roofFront);
    const width=bw+overhang*2,depth=bd+overhang*2;
    for(let i=0;i<4;i++){
      const g=new T.Group(),side=i%2===1,dx=[0,width/2,0,-width/2][i],z=[overhang,-bd/2,-bd-overhang,-bd/2][i];
      g.position.set(dx,h,z);body.add(g);
      const reach=side?width/4:depth/2,card=sheet(H,g,side?'triangle':'hip-roof',roof||p.roof,0,0,side?depth:width,Math.hypot(reach,r));
      hip.push({g,card,z,yaw:i*Math.PI/2,tilt:-Math.atan2(reach,r)});
    }
  }
  root.userData.front=front;root.userData.body=body;
  root.userData.follow=value=>{
    const a=smooth((value-.1)/.5),b=smooth((value-.42)/.55);
    right.rotation.y=Math.PI-Math.PI/2*a;left.rotation.y=-Math.PI+Math.PI/2*a;rear.rotation.y=Math.PI/2*a;
    roofFront.rotation.x=-(Math.PI/2-phi)*b;roofBack.rotation.x=-2*phi*b;
    for(const o of hip){o.g.position.z=o.z*a;o.g.rotation.y=o.yaw*a;o.card.rotation.x=o.tilt*b;}
    for(const o of roofJoints)o.g.rotation.x=o.angle*b;
    if(frontGable){body.rotation.y=Math.PI/2*a;body.position.set(w/2*a,0,-d/2*a);}
  };
  root.userData.follow(1);return root;
}
function pyramid(H,parent,p,{x=0,y=0,z=0,w=1.8,d=w,h=2}={}){
  const holders=[];
  for(let side=0;side<4;side++){
    const group=new H.THREE.Group(),width=side%2?d:w,depth=side%2?w:d;
    const dx=[0,w/2,0,-w/2][side],dz=[0,-d/2,-d,-d/2][side];
    group.position.set(x+dx,y,z+dz);parent.add(group);
    const card=sheet(H,group,'triangle',p.roof,0,0,width,Math.hypot(h,depth/2));
    holders.push({group,card,dx,dz,angle:side*Math.PI/2,tilt:-Math.atan2(depth/2,h)});
  }
  return value=>{const a=smooth(value);for(const o of holders){o.group.position.z=(z+o.dz)*a;o.group.rotation.y=o.angle*a;o.card.rotation.x=o.tilt*a;}};
}

export function makeNamedLandmark(H,spec){
  if(spec.form==='monument'){
    const node=makePlazaMonument(H,{x:0,z:0});node.name=spec.name;node.userData.landmark=spec.id;return node;
  }
  const T=H.THREE,root=new T.Group(),p=spec.palette,parts=[],extra=[];
  const add=(options,x=0,y=0,z=0)=>{
    const node=volume(H,p,options);node.position.set(x,y,z);root.add(node);parts.push({node,z});return node;
  };
  const label=(text,x,y,w,z)=>sign(H,root,text,x,y,w,.25,z);
  const dormer=(x,y,z,w=1.15,h=.95)=>{
    const node=new T.Group();node.position.set(x,y,z);root.add(node);
    sheet(H,node,'timber',p.timber,0,0,w,h*.67);sheet(H,node,'triangle',p.roof,0,h*.67,w*1.1,h*.36);
    sheet(H,node,'window','#eee4cf',0,.12,w*.65,h*.43,.04);
    extra.push(v=>{node.position.z=z*smooth(v);});
  };
  const porch=(x,y,z,w,d=.75)=>{
    const node=add({w,d,h:y,r:.3,floors:1,columns:2,blank:true},x,0,z);
    // Open gallery: replace opaque front and side walls with narrow paper posts.
    for(const group of node.userData.body.children.slice(0,3))group.clear();
    const posts=new T.Group();root.add(posts);posts.position.set(x,0,z+.03);
    for(const sx of [-1,1])sheet(H,posts,'timber',p.timber,sx*w*.44,0,.17,y);
    extra.push(v=>{posts.position.z=(z+.03)*smooth(v);});return node;
  };
  switch(spec.form){
    case 'municipal':{
      add({w:8.1,d:4.2,h:4.35,r:.14,blank:true,overhang:.64},-.35,0,-.18);
      sheet(H,root,'timber','#995a38',-.35,3.05,8.2,1.28,.055);
      for(let row=0;row<2;row++)for(let i=0;i<6;i++)sheet(H,root,'window','#714c38',-3.72+i*1.35,.38+row*1.48,.94,1.02,.10);
      // Exposed rafter ends are a defining part of the unusually deep eave.
      for(let i=0;i<14;i++)sheet(H,root,'plain','#825235',-4.13+i*.59,4.16,.055,.34,.16);
      const tower=add({w:1.75,d:1.8,h:7.5,r:.05,floors:1,material:'stone',blank:true},2.65,0,.12);
      sheet(H,tower.userData.front,'arch-window','#604d3c',0,.1,.78,1.3,.05);
      sheet(H,tower.userData.front,'door','#614b38',0,1.8,.85,1.23,.055);
      sheet(H,tower.userData.front,'clock','#eee7d3',0,5.87,.30,.30,.05);
      sheet(H,tower.userData.body.children[1],'clock','#eee7d3',.90,5.87,.30,.30,.05);
      railing(H,tower.userData.front,{...p,timber:'#4b5146'},0,1.75,1.4,.35,.18);
      sheet(H,tower.userData.front,'plain','#85816d',0,7.44,1.91,.095,.045);
      // Small clocks, three vents, shallow cap: distinct from the church spire.
      for(let i=-1;i<=1;i++)sheet(H,tower.userData.front,'plain','#45443b',i*.43,7.12,.15,.18,.05);
      porch(2.7,1.45,1.05,2.6,1.1);label('MUNICIPALIDAD',-.6,1.48,3.1,.12);
      const deer=new T.Group();deer.position.set(-2.0,.05,1.0);root.add(deer);
      const outline=[[-.53,.32],[-.45,.62],[.08,.65],[.27,1.02],[.39,1.13],[.55,1.05],[.53,.94],[.39,.91],[.3,.61],[.21,.37],[.12,.03],[.04,.03],[.08,.38],[-.27,.35],[-.35,.03],[-.43,.03],[-.38,.38]];
      const statue=makeCard(outline,{paper:H.paper,thickness:.035,edgeWidth:.018,pxPerUnit:90,seed:1962,paint:P=>{P.fill('#667369');P.felt(.2);},back:'mirror'});deer.add(statue);
      for(const sign of [-1,1])for(let i=0;i<3;i++){const antler=sheet(H,deer,'plain','#667369',.30+sign*.08,1.03+i*.1,.025,.24);antler.rotation.z=sign*(.35+i*.2);}
      extra.push(v=>{deer.position.z=smooth(v);});break;
    }
    case 'church':{
      const nave=add({w:9.2,d:3.5,h:3.85,r:1.05,floors:1,columns:5,material:'stone',round:true,overhang:.28},-.3,0,-.15);
      for(const x of [-4.0,-2.2,-.4,1.4,3.2]){
        sheet(H,nave.userData.front,'stone',p.stone,x,0,.19,3.74,.075);
        sheet(H,nave.userData.front,'plain','#e1e0d4',x-.015,3.7,.27,.10,.08);
      }
      sheet(H,nave.userData.front,'plain','#e1e0d4',0,3.80,9.35,.09,.09);
      const tp={...p,facade:'#e6e5dc',roof:'#4d5557'};
      const base=volume(H,tp,{w:1.6,d:1.7,h:5.8,r:0,blank:true});base.position.set(-4.05,0,.15);root.add(base);parts.push({node:base,z:.15});
      for(const x of [-.27,.27])sheet(H,base.userData.front,'door','#e9e7da',x,2.55,.15,.76,.045);
      for(const [x,y] of [[-.21,4.47],[.21,4.47],[0,4.73],[0,4.21]])sheet(H,base.userData.front,'round','#e6e5d8',x,y,.25,.25,.045);
      for(const y of [.13,3.99,5.71])sheet(H,base.userData.front,'plain','#eeebdf',0,y,1.79,.11,.06);
      for(const x of [-.73,.73])sheet(H,base.userData.front,'plain','#f0ece1',x,0,.10,5.8,.055);
      const bell=new T.Group();bell.position.set(-4.05,5.8,.15);root.add(bell);
      for(let i=0;i<4;i++){
        const face=new T.Group(),dz=[0,-.85,-1.7,-.85][i];face.position.set([0,.8,0,-.8][i],0,dz);face.rotation.y=i*Math.PI/2;bell.add(face);sheet(H,face,'belfry','#eeece0',0,0,i%2?1.7:1.6,1.4);
        sheet(H,face,'plain','#f0ecdf',0,-.08,1.92,.13,.04);
        sheet(H,face,'plain','#f0ecdf',0,1.30,1.92,.12,.04);
        extra.push(v=>{face.rotation.y=i*Math.PI/2*smooth(v);face.position.z=dz*smooth(v);});
      }
      extra.push(pyramid(H,root,tp,{x:-4.05,y:7.2,z:.15,w:1.95,d:2.05,h:1.8}));
      porch(2.05,3.0,.5,2.4,1.0);
      for(const x of [1.15,2.05,2.95])sheet(H,root,'plain','#e9e7db',x,0,.16,3.05,.92);
      label('PARROQUIA SAN JOSÉ',1.3,3.08,3.2,.96);extra.push(v=>{bell.position.z=.15*smooth(v);});break;
    }
    case 'lanin':{
      add({w:8.8,d:4.5,h:3.45,r:2.0,columns:5,material:'stone',roofShape:'hip',overhang:.30},0,0,0);
      sheet(H,root,'timber',p.timber,0,1.75,8.8,1.7,.04);
      for(let i=0;i<5;i++)sheet(H,root,'window','#e9dfc8',-3.5+i*1.75,2.03,.8,.95,.075);
      for(const x of [-3,-1.3,1.3,3])dormer(x,4.12,-.6,1.2,1.25);
      for(let i=0;i<16;i++)sheet(H,root,'plain',p.timber,-4.35+i*.58,3.35,.05,.30,.075);
      porch(0,1.75,.85,3.2,1.2);add({w:.6,d:.6,h:1.55,r:0,blank:true,material:'stone'},1.3,4.7,-1.5);label('PARQUE NACIONAL LANÍN',0,1.42,3.3,.97);break;
    }
    case 'museum':{
      add({w:5.8,d:3.8,h:2.4,r:1.4,floors:1,columns:4,material:'vertical'},0,0,-.05);
      add({w:1.75,d:1.1,h:2.2,r:1.1,floors:1,columns:1,material:'timber',frontGable:true},-1.15,0,.9);
      for(const x of [-2.03,-.27])for(let i=0;i<7;i++)sheet(H,root,'round','#b48b5c',x,.16+i*.29,.19,.19,1.02);
      railing(H,root,p,0,.1,5.7,.55,1.15);label('MUSEO PRIMEROS POBLADORES',1.12,1.9,2.5,.08);break;
    }
    case 'theatre':{
      add({w:5.3,d:3.5,h:2.75,r:1.7,floors:1,columns:3,material:'timber',frontGable:true,blank:true},1.1,0,0);
      sheet(H,root,'door','#e7d8bd',1.1,.05,1.0,1.78,.07);
      for(const x of [-.55,2.75])sheet(H,root,'window','#e7d8bd',x,.62,.68,1.05,.07);
      sheet(H,root,'round','#e7d8bd',1.1,3.12,.62,.62,.07);
      add({w:2.5,d:3.6,h:3.5,r:1.4,floors:2,columns:2,material:'plaster',roof:'#606861'},-2.75,0,-.15);
      sheet(H,root,'plain','#789267',-2.75,0,2.5,3.45,.05);
      for(const x of [-3.45,-2.1])sheet(H,root,'window','#e7d7b5',x,1.9,.55,.85,.09);
      label('TEATRO SAN JOSÉ',1.8,2.50,2.8,.15);break;
    }
    case 'terminal':{
      add({w:10.7,d:3.9,h:2.5,r:.18,floors:1,columns:8,material:'stone',commercial:true});
      add({w:5.0,d:2,h:1.1,r:.1,floors:1,columns:6,material:'plaster'},-2.5,2.3,-1.2);
      sheet(H,root,'vertical','#438078',0,2.1,10.8,.7,.07);porch(0,1.9,.68,10.8,1.2);
      for(const x of [-3.6,-1.8,0,1.8,3.6])sheet(H,root,'plain','#426b60',x,0,.10,1.90,.74);
      label('TERMINAL DE ÓMNIBUS',-.7,2.26,5.4,.13);break;
    }
    case 'patagonia':{
      add({w:8.7,d:5.6,h:6.0,r:1.55,floors:4,columns:6,commercial:true});
      for(const x of [-2.9,0,2.9])add({w:1.8,d:1.45,h:6.4,r:1.5,floors:4,columns:1,frontGable:true},x,0,.65);
      sheet(H,root,'stone','#73766e',0,0,8.8,1.5,.06);for(let i=0;i<6;i++)sheet(H,root,'shop','#c8cebd',-3.6+i*1.45,.12,1.1,1.16,.10);
      for(const x of [-4.3,-2.2,2.2,4.3])sheet(H,root,'stone','#656e61',x,0,.25,1.5,.15);
      label('PATAGONIA PLAZA',0,1.26,5.0,.78);break;
    }
    case 'tunqueley':
    case 'chapelco':{
      add({w:spec.w,d:4,h:4.6,r:spec.form==='chapelco'?.7:.35,floors:3,columns:7,balconies:true});
      for(const y of [1.5,3.0,4.45])sheet(H,root,'plain','#e9e6d9',0,y,spec.w+.08,.22,.12);
      for(const y of [1.74,3.24])for(let i=0;i<7;i++)sheet(H,root,'shop','#845939',-spec.w/2+spec.w*(i+.5)/7,y,spec.w/7*.86,.95,.14);
      for(const y of [1.5,3.0])railing(H,root,{...p,timber:'#4a5144'},0,y,spec.w,.35,.21);
      if(spec.form==='chapelco')porch(0,1.9,1.05,2.4,1.1);
      label(spec.form==='chapelco'?'CHAPELCO SKI HOTEL':'HOTEL TUNQUELEY',0,1.1,5,.23);break;
    }
    case 'chatelet':{
      add({w:8.8,d:4.6,h:3.6,r:1.65,floors:2,columns:5,halfTimber:true});
      add({w:1.8,d:1.9,h:5.5,r:.35,floors:3,columns:1,halfTimber:true},.35,0,.45);
      extra.push(pyramid(H,root,p,{x:.35,y:5.85,z:.45,w:2.05,h:1.1}));porch(-2,1.45,1.1,4.0,1.0);
      label('LE CHÂTELET',.35,1.5,2.6,.55);break;
    }
    case 'walkirias':{
      add({w:5.0,d:4.8,h:3.9,r:2.5,floors:2,columns:2,material:'timber',frontGable:true},-1.9,0,0);
      add({w:3.5,d:4.4,h:3.4,r:2.1,floors:2,columns:2,material:'timber',frontGable:true},2.6,0,-.15);
      add({w:.8,d:.8,h:6.2,r:0,material:'stone',blank:true},-.75,0,.16);
      for(const x of [-3.1,-1.45,1.85,3.25])sheet(H,root,'arch-window','#e9dec7',x,.35,.95,1.4,.12);
      sheet(H,root,'arch-window','#e9dec7',2.6,3.96,1.25,.72,.12);
      label('LAS WALKIRIAS',2.2,1.7,2.5,.14);break;
    }
    case 'rosa':{
      add({w:7.7,d:4,h:4.8,r:1.1,floors:3,columns:5,material:'timber',commercial:true});
      add({w:1.8,d:.8,h:5.25,r:.9,floors:3,columns:1,frontGable:true},.2,0,.5);
      for(let i=0;i<5;i++)sheet(H,root,'shop','#a96a42',-3.15+i*1.32,3.23,1.22,.98,.15);
      for(const x of [-2.7,2.6])dormer(x,4.8,-.4,1.2,1.0);porch(0,1.5,.7,7.8,.7);label('ROSA DE LOS VIAJES',0,1.21,4.4,.82);break;
    }
    case 'caupolican':{
      add({w:7.8,d:4.5,h:5.7,r:1.25,floors:4,columns:6,balconies:true});
      // Characteristic glazed belt across the two central levels.
      for(let row=0;row<2;row++)for(let i=0;i<8;i++)sheet(H,root,'shop','#756653',-3.4+i*.97,1.5+row*1.5,.93,1.36,.20);
      for(const x of [-2.2,0,2.2])dormer(x,5.8,-.5,1.3,1.1);label('CAUPOLICÁN',0,1.12,4.2,.24);break;
    }
    case 'ville':{
      add({w:9.8,d:4.8,h:4.4,r:1.1,floors:3,columns:6,balconies:true});
      for(const x of [-3.4,-.4])add({w:1.7,d:1.2,h:4.7,r:1.3,floors:3,columns:1,frontGable:true},x,0,.55);
      add({w:1.1,d:1.4,h:6.8,r:.7,floors:4,columns:1,material:'timber'},2.5,0,.8);porch(0,1.6,1.0,3.1,1.0);label('LE VILLE',2.5,1.36,1.4,.96);break;
    }
    case 'cumelen':{
      for(const [x,w,h] of [[-2.6,3.7,2.8],[1.4,5.2,3.1]])add({w,d:4.6,h,r:2.0,floors:2,columns:w<4?2:3,material:'timber',frontGable:true,roofShape:'gambrel'},x,0,0);
      sheet(H,root,'plaster','#e1d9b9',-.1,0,8.8,1.35,.08);
      for(const x of [-3.1,-1.7,.05,1.6,3.25])sheet(H,root,'window','#7e5a40',x,.23,.75,.83,.12);
      railing(H,root,p,1.5,1.6,4.5,.4,.2);label('CUMELÉN',1.5,1.0,3,.25);break;
    }
    case 'esquiador':{
      add({w:9.6,d:4.6,h:3.5,r:.35,floors:2,columns:6,commercial:true,balconies:true});
      sheet(H,root,'plain','#c4b57f',0,2.92,9.7,.12,.08);
      add({w:2.1,d:3.0,h:5.3,r:.6,floors:4,columns:2,material:'timber'},3.8,0,-.2);porch(-.7,1.35,.65,8.5,.8);label('EL VIEJO ESQUIADOR',-.7,1.1,5.5,.78);break;
    }
    default:throw new Error(`Forma individual desconocida: ${spec.form}`);
  }
  root.name=spec.name;root.userData.landmark=spec.id;
  root.userData.height=spec.height;root.userData.dimensions={w:spec.w,d:spec.d};
  const articulated=new Set(parts.map(p=>p.node));
  const planes=root.children.filter(c=>!articulated.has(c)).map(node=>({node,z:node.position.z}));
  root.userData.follow=value=>{
    for(const {node,z} of parts){node.userData.follow(value);node.position.z=z*smooth(value);}
    for(const {node,z} of planes)node.position.z=z*smooth(value);
    for(const follow of extra)follow(value);
  };
  root.userData.follow(1);return stabilizeFold(root,T);
}

export const NAMED_LANDMARKS=LANDMARKS;
