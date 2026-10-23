import * as THREE from 'three';
import { mergeGeometries } from './vendor/BufferGeometryUtils.js';

// Recover closed timber islands across the loader's UV/normal seams. This is
// performed once; hover only changes one uniform, never a vertex/index buffer.
function componentIslands(geometry) {
  const p=geometry.attributes.position,index=geometry.index;
  const parents=Int32Array.from({length:p.count},(_,i)=>i),coordinates=new Map();
  const root=i=>{while(parents[i]!==i){parents[i]=parents[parents[i]];i=parents[i];}return i;};
  const join=(a,b)=>{parents[root(a)]=root(b);};
  for(let i=0;i<p.count;i++){
    const key=[p.getX(i),p.getY(i),p.getZ(i)].map(v=>Math.round(v*1e6)).join(',');
    if(coordinates.has(key))join(i,coordinates.get(key));else coordinates.set(key,i);
  }
  for(let i=0;i<index.count;i+=3){join(index.getX(i),index.getX(i+1));join(index.getX(i),index.getX(i+2));}
  const groups=new Map();
  for(let i=0;i<p.count;i++){
    const id=root(i);
    if(!groups.has(id))groups.set(id,{vertices:[],box:new THREE.Box3()});
    const group=groups.get(id);group.vertices.push(i);group.box.expandByPoint(new THREE.Vector3(p.getX(i),p.getY(i),p.getZ(i)));
  }
  return [...groups.values()];
}

function separation(center,size,kind,key,serial) {
  if(key==='base'||key==='spire')return new THREE.Vector3();
  const angle=Math.atan2(center.z,center.x),radial=new THREE.Vector3(Math.cos(angle),0,Math.sin(angle));
  const tangent=new THREE.Vector3(-radial.z,0,radial.x);
  const random=Math.sin((serial+1)*127.1+center.x*311.7+center.z*74.7)*43758.5453;
  const jitter=(random-Math.floor(random))-.5;
  if(kind==='roof')return new THREE.Vector3(0,.032,0);
  if(kind==='deck')return new THREE.Vector3(0,-.016,0);
  if(kind==='wall'){
    const sector=Math.round(angle/(Math.PI/4))*Math.PI/4;
    return new THREE.Vector3(Math.cos(sector)*.105,-.008,Math.sin(sector)*.105);
  }
  if(kind==='beam'&&size.x>.12&&size.z>.12)return new THREE.Vector3(0,.019,0);
  const column=kind==='column'||size.y>Math.max(size.x,size.z)*1.8;
  const bracket=kind==='bracket';
  const distance=(column?.067:bracket?.108:.075)*(key==='annex'?.65:1);
  return radial.multiplyScalar(distance).add(tangent.multiplyScalar(bracket?0:jitter*.02))
    .add(new THREE.Vector3(0,column?-.01:bracket?.014:.009,0));
}

export function homeStoreyGeometry(records,key,pivot) {
  const components=[],geometries=[];
  for(const record of records.filter(record=>record.name.split('__')[0]===key)){
    const geometry=record.geometry.clone(),kind=record.name.split('__')[1];
    for(const name of Object.keys(geometry.attributes))if(!['position','normal'].includes(name))geometry.deleteAttribute(name);
    const offsets=new Float32Array(geometry.attributes.position.count*3);
    const sourceBox=geometry.boundingBox,sourceCenter=sourceBox.getCenter(new THREE.Vector3());
    const type=record.componentType||kind;
    const decorative=/佛|莲座/.test(record.sourceName||'');
    const islands=type==='bracket'||(kind==='wall'&&!decorative)?componentIslands(geometry):[{box:sourceBox,vertices:Array.from({length:geometry.attributes.position.count},(_,i)=>i)}];
    for(const island of islands){
      const center=island.box.getCenter(new THREE.Vector3()),size=island.box.getSize(new THREE.Vector3());
      const offset=separation(type==='bracket'?sourceCenter:center,size,type,key,components.length);
      if(decorative)offset.set(0,.005,0);
      if(type==='bracket'){
        offset.x+=(center.x-sourceCenter.x)*.65;offset.z+=(center.z-sourceCenter.z)*.65;
        offset.y+=(center.y-sourceCenter.y)*1.2;
      }
      for(const vertex of island.vertices)offset.toArray(offsets,vertex*3);
      components.push({id:`${key}-${String(components.length+1).padStart(3,'0')}`,kind,type,sourceName:record.sourceName,center,offset,box:island.box,vertices:island.vertices.length});
    }
    geometry.setAttribute('aExplodeOffset',new THREE.BufferAttribute(offsets,3));
    geometries.push(geometry);
  }
  const geometry=mergeGeometries(geometries);geometries.forEach(source=>source.dispose());
  const position=geometry.attributes.position,offset=geometry.attributes.aExplodeOffset,index=geometry.index,vertexKeys=new Array(position.count);
  // Coincident faces belonging to different moving pieces must survive: they
  // become exposed surfaces when the connection opens.
  for(let i=0;i<position.count;i++)vertexKeys[i]=[position.getX(i),position.getY(i),position.getZ(i),offset.getX(i),offset.getY(i),offset.getZ(i)].map(v=>Math.round(v*1e7)).join(',');
  const seen=new Set(),indices=[];
  for(let i=0;i<index.count;i+=3){
    const a=index.getX(i),b=index.getX(i+1),c=index.getX(i+2),corners=[vertexKeys[a],vertexKeys[b],vertexKeys[c]];
    const start=corners[0]<=corners[1]&&corners[0]<=corners[2]?0:corners[1]<=corners[2]?1:2;
    const face=[corners[start],corners[(start+1)%3],corners[(start+2)%3]].join('|');
    if(seen.has(face))continue;seen.add(face);indices.push(a,b,c);
  }
  geometry.setIndex(indices);geometry.computeBoundingBox();
  const box=geometry.boundingBox.clone();
  geometry.translate(-pivot.x,-pivot.y,-pivot.z);
  return {geometry,components,box};
}
