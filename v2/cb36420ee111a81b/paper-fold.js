// At the end of a fold, overlapping cards need separate paper layers. Assign
// layers only where their closed outlines overlap in exactly the same plane;
// this keeps the stack thin and avoids camera-dependent depth ties.
export function stabilizeFold(root,THREE,{step=.0063}={}){
  const follow=root.userData.follow;
  if(!follow)return root;
  follow(0);root.updateMatrixWorld(true);
  const cards=[];
  root.traverse(mesh=>{
    if(!mesh.isMesh||mesh.isInstancedMesh)return;
    const box=new THREE.Box3().setFromObject(mesh),z=(box.min.z+box.max.z)/2;
    const used=new Set();
    for(const c of cards)if(Math.abs(c.z-z)<1e-4&&box.min.x<c.box.max.x-1e-5&&box.max.x>c.box.min.x+1e-5&&box.min.y<c.box.max.y-1e-5&&box.max.y>c.box.min.y+1e-5)used.add(c.layer);
    let layer=0;while(used.has(layer))layer++;
    const direction=mesh.parent.matrixWorld.elements[10];
    cards.push({mesh,box,z,layer,offset:Math.abs(direction)>.9?layer*step/direction:0,last:0});
  });
  follow(1);
  root.userData.foldLayers=Math.max(0,...cards.map(c=>c.layer))+1;
  root.userData.follow=value=>{
    for(const c of cards)c.mesh.position.z-=c.last;
    follow(value);
    const a=Math.min(1,Math.max(0,value/.16)),weight=1-a*a*(3-2*a);
    for(const c of cards){c.last=c.offset*weight;c.mesh.position.z+=c.last;}
  };
  return root;
}
