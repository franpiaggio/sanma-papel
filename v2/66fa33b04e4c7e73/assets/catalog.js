import * as THREE from 'three';
import { paperTextures, paperMaterial } from 'papercraft/lib/paperkit-3d.js';
import { makeLocalBuilding } from './buildings.js';
import { TYPOLOGIES } from './typologies.js';
import { LANDMARKS } from './landmark-specs.js';
import { makeNamedLandmark } from './landmarks.js';
import { OrbitControls } from '../vendor/OrbitControls.js';

const stage=document.getElementById('stage');
try {
  const response=await fetch('./assets/references.json');
  if(!response.ok)throw new Error('No se pudieron cargar las referencias.');
  const references=(await response.json()).references;
  const namedResponse=await fetch('./assets/landmark-references.json');
  if(!namedResponse.ok)throw new Error('No se pudieron cargar las fuentes de los hitos.');
  const namedReferences=new Map((await namedResponse.json()).records.map(r=>[r.id,r]));
  const entries=[...LANDMARKS.filter(s=>s.form!=='monument'),...LANDMARKS.filter(s=>s.form==='monument'),...TYPOLOGIES];
  const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.shadowMap.enabled=true;
  renderer.shadowMap.type=THREE.PCFSoftShadowMap;stage.append(renderer.domElement);
  const scene=new THREE.Scene();
  const camera=new THREE.PerspectiveCamera(32,1,.1,100);camera.position.set(8,6,12);camera.lookAt(0,2,0);
  const controls=new OrbitControls(camera,renderer.domElement);
  controls.maxPolarAngle=Math.PI*.495;controls.minPolarAngle=.03;
  controls.cursorStyle='grab';controls.zoomSpeed=.8;
  renderer.domElement.tabIndex=0;
  renderer.domElement.setAttribute('aria-label','Inspeccionar edificio');
  renderer.domElement.setAttribute('aria-describedby','viewer-help');
  controls.listenToKeyEvents(renderer.domElement);
  const paper=paperTextures(renderer,{color:'#f3f0e4',seed:4,size:256,unitsPerTile:5});
  const H={THREE,paper,cardOpts:()=>({paper,pxPerUnit:72,effects:1})};
  scene.add(new THREE.HemisphereLight('#f7ebd2','#839270',2));
  const light=new THREE.DirectionalLight('#ffdeb3',3.2);light.position.set(-6,12,8);light.castShadow=true;
  light.shadow.mapSize.set(1024,1024);Object.assign(light.shadow.camera,{left:-10,right:10,top:10,bottom:-10,near:.1,far:40});scene.add(light);
  const ground=new THREE.Mesh(new THREE.PlaneGeometry(200,200),paperMaterial({color:'#eee8da',map:paper.map,normalMap:paper.normalMap}));ground.rotation.x=-Math.PI/2;ground.position.y=-.025;ground.receiveShadow=true;scene.add(ground);
  // Turn around the world's vertical axis, after the fold about local X.
  // With the default XYZ order, turning a closed model tilted the whole sheet.
  const group=new THREE.Group();group.rotation.order='YXZ';group.rotation.y=-24*Math.PI/180;scene.add(group);
  const models=new Map(),buttons=[];
  const bounds=new THREE.Box3(),sphere=new THREE.Sphere(),direction=new THREE.Vector3(5,5,12).normalize();
  let current;
  const draw=()=>renderer.render(scene,camera);
  controls.addEventListener('change',draw);
  const render=()=>{
    const p=Number(document.getElementById('fold').value)/100;
    current?.userData.follow(p);group.rotation.x=-(1-p)*Math.PI/2;
    group.updateMatrixWorld(true);draw();
  };
  function frameModel(){
    if(current){
      group.updateMatrixWorld(true);bounds.setFromObject(group);bounds.getBoundingSphere(sphere);
      const vertical=camera.fov*Math.PI/360,horizontal=Math.atan(Math.tan(vertical)*camera.aspect);
      camera.position.copy(sphere.center).addScaledVector(direction,sphere.radius/Math.sin(Math.min(vertical,horizontal))*1.12);
      controls.target.copy(sphere.center);controls.minDistance=Math.max(.3,sphere.radius*.18);
      controls.maxDistance=sphere.radius*12;camera.far=Math.max(100,sphere.radius*16);camera.updateProjectionMatrix();
      controls.update();controls.saveState();
    }
    draw();
  }
  renderer.domElement.addEventListener('dblclick',frameModel);
  renderer.domElement.addEventListener('pointerdown',()=>renderer.domElement.focus({preventScroll:true}));
  renderer.domElement.addEventListener('keydown',e=>{if(e.code==='KeyR'){e.preventDefault();frameModel();}});
  function select(t,index){
    if(current)group.remove(current);
    const individual=!!t.form;
    if(!models.has(t.id)){const node=individual?makeNamedLandmark(H,t):makeLocalBuilding(H,t.id);node.position.z=individual&&t.form==='monument'?0:t.d/2;models.set(t.id,node);}
    current=models.get(t.id);group.add(current);
    buttons.forEach((b,i)=>b.setAttribute('aria-pressed',String(i===index)));
    document.getElementById('name').textContent=t.name;
    const evidence=namedReferences.get(t.id);
    const refs=individual?[...evidence.references,...evidence.descriptive_sources]:references.filter(r=>r.typology===t.id);
    document.getElementById('description').textContent=individual?t.traits.join('. ')+'.':refs[0]?.observed||'';
    const mapLink=document.getElementById('view-on-map');mapLink.hidden=!individual;mapLink.href='./index.html?landmark='+encodeURIComponent(t.id);
    const sources=document.getElementById('sources');sources.replaceChildren();
    for(const r of refs){
      const li=document.createElement('li'),a=document.createElement('a'),p=document.createElement('p');
      a.href=r.url;a.target='_blank';a.rel='noopener noreferrer';a.textContent=r.id?.startsWith('mly:')?`Mapillary ${r.id.split(':')[1]} · ${r.author}`:r.author||r.source;
      p.textContent=[r.license,r.observed||r.description||r.id].filter(Boolean).join(' · ');li.append(a,p);sources.append(li);
    }
    const swatches=document.getElementById('swatches');swatches.replaceChildren();
    for(const [key,color] of Object.entries(t.palette)){const i=document.createElement('i');i.style.background=color;i.title=`${key}: ${color}`;swatches.append(i);}
    stage.setAttribute('aria-label',t.name);render();frameModel();
    window.__assetCatalog={current,type:t,renderer,scene,camera,controls,render,select,frameModel};
  }
  for(const [index,t] of entries.entries()){
    if(index===0||index===LANDMARKS.length){const label=document.createElement('p');label.className='group-label';label.textContent=index===0?'Edificios y monumentos':'Casas generales';document.getElementById('types').append(label);}
    const b=document.createElement('button'),n=document.createElement('small'),label=document.createElement('span');
    b.type='button';n.textContent=String(index+1).padStart(2,'0');label.textContent=t.name;b.append(n,label);b.setAttribute('aria-pressed','false');
    b.addEventListener('click',()=>select(t,index));buttons.push(b);document.getElementById('types').append(b);
  }
  const resize=()=>{const {width,height}=stage.getBoundingClientRect();renderer.setSize(width,height);camera.aspect=width/height;camera.updateProjectionMatrix();render();};
  new ResizeObserver(resize).observe(stage);
  document.getElementById('fold').addEventListener('input',render);
  const info=document.getElementById('info-dialog');
  document.getElementById('info').addEventListener('click',()=>info.showModal());
  info.addEventListener('click',e=>{if(e.target===info){const b=info.getBoundingClientRect();if(e.clientX<b.left||e.clientX>b.right||e.clientY<b.top||e.clientY>b.bottom)info.close();}});
  resize();select(entries[0],0);
} catch(error){
  const message=document.createElement('p');message.id='error';message.setAttribute('role','alert');message.textContent=`No se pudo abrir la vista: ${error.message}`;stage.append(message);
  console.error(error);
}
