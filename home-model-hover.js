import * as THREE from 'three';

// Hit testing uses resting bounds so a moving storey cannot repeatedly enter
// and leave the pointer. All geometry and shader buffers remain unchanged.
export function installModelHover(home,floors,camera,interaction) {
  const raycaster=new THREE.Raycaster(),ndc=new THREE.Vector2();
  const inverse=new THREE.Matrix4(),ray=new THREE.Ray(),hit=new THREE.Vector3();
  const entries=[...floors.entries()].filter(([key])=>/^level[1-5]$/.test(key)||key==='spire');
  entries.sort(([a],[b])=>(a==='spire'?6:Number(a.slice(5)))-(b==='spire'?6:Number(b.slice(5))));
  const boxes=entries.map(([key,floor])=>{
    const box=new THREE.Box3();
    for(const part of floor.parts)for(const mesh of part.children){
      box.union(mesh.geometry.boundingBox.clone().translate(part.userData.center));
    }
    return {key,floor,box:box.expandByScalar(.012)};
  });
  const envelope=new THREE.Box3();boxes.forEach(({box})=>envelope.union(box));
  const storeyGap=.09; // The assembled model is normalized to a height of 1.
  const maximumLift=(boxes.length-1)*storeyGap;
  const state=interaction.state;
  state.modelHover=false;state.modelSplit=0;state.hoveredFloor=null;
  let lastFloor=null;

  function update(enabled,damping){
    const pointer=enabled?interaction.getPointer():null;
    let hovered=false,hoveredFloor=null;
    if(pointer){
      home.updateWorldMatrix(true,false);
      inverse.copy(home.matrixWorld).invert();
      ndc.set(pointer.x/innerWidth*2-1,1-pointer.y/innerHeight*2);
      raycaster.setFromCamera(ndc,camera);
      ray.copy(raycaster.ray).applyMatrix4(inverse);
      // Retain the expanded silhouette while open, including the gaps.
      const bounds=envelope.clone();bounds.max.y+=state.modelSplit*maximumLift;
      hovered=!!ray.intersectBox(bounds,hit);
      if(hovered){
        let closest=Infinity;
        boxes.forEach(({key,box})=>{
          if(ray.intersectBox(box,hit)){
            const distance=hit.distanceToSquared(ray.origin);
            if(distance<closest){closest=distance;hoveredFloor=key;}
          }
        });
        hoveredFloor=hoveredFloor||lastFloor||'level3';
      }
    }
    lastFloor=hoveredFloor;
    state.modelHover=hovered;state.hoveredFloor=hoveredFloor;
    const target=hovered?1:0;
    state.modelSplit=THREE.MathUtils.lerp(state.modelSplit,target,damping);
    // Finish the movement exactly instead of continually nudging dense faces
    // by fractions smaller than a depth-buffer step while the pointer rests.
    if(Math.abs(state.modelSplit-target)<.001)state.modelSplit=target;
    // Cumulative vertical gaps separate complete storeys without intersecting
    // their own roofs, walls or beams. The plinth stays anchored in the snow.
    boxes.forEach(({floor},index)=>{floor.hoverLift=index*storeyGap*state.modelSplit;});
  }
  return {update};
}
