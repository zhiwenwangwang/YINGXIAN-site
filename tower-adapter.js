import * as THREE from 'three';
import { GLTFLoader } from './vendor/GLTFLoader.js';
import { DRACOLoader } from './vendor/DRACOLoader.js';
import { mergeGeometries } from './vendor/BufferGeometryUtils.js';
import { configureTowerContent } from './tower-content.js';
import { installHomeInteraction } from './home-interaction.js';
import { installModelHover } from './home-model-hover.js';
import { homeStoreyGeometry } from './home-components.js';
import { installStructureHud } from './home-structure-hud.js';

window.__configureTower = configureTowerContent;

// The reference renderer owns input, camera paths, compositing, sound and UI.
// This module changes only the subjects occupying its existing scene slots.
async function loadTowerModel(url) {
  const decoder = new DRACOLoader().setDecoderPath('./vendor/draco/');
  const loader = new GLTFLoader().setDRACOLoader(decoder);
  const gltf = await loader.loadAsync(url);
  decoder.dispose();
  gltf.scene.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(gltf.scene);
  const center = box.getCenter(new THREE.Vector3());
  const scale = 1 / (box.max.y - box.min.y);
  const records = [];
  gltf.scene.traverse(mesh => {
    if (!mesh.isMesh) return;
    let node = mesh;
    while (node.parent && !/__/.test(node.name)) node = node.parent;
    const geometry = mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);
    geometry.translate(-center.x, -box.min.y, -center.z);
    geometry.scale(scale, scale, scale);
    geometry.computeBoundingBox();
    records.push({ name: node.name.split('__').slice(0,2).join('__'), geometry, material: mesh.material.name,
      sourceName:node.userData.sourceName,componentType:node.userData.componentType });
  });
  return records;
}
const rawModel=loadTowerModel('./assets/yingxian-tower.glb');
const rawHomeModel=loadTowerModel('./assets/yingxian-home-components.glb');
// The final particle carousel retains its original whole, middle and crown order.
const volumeData = Promise.all(['tower','middle','crown'].map(async name => {
  const response=await fetch(new URL(`./assets/${name}-volume.bin`,import.meta.url));
  if (!response.ok) throw new Error(`${name} volume failed to load`);
  return response.arrayBuffer();
}));

const noise = `
float hash3(vec3 p){p=fract(p*.1031);p+=dot(p,p.yzx+33.33);return fract((p.x+p.y)*p.z);}
float noise3(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(hash3(i),hash3(i+vec3(1,0,0)),f.x),mix(hash3(i+vec3(0,1,0)),hash3(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash3(i+vec3(0,0,1)),hash3(i+vec3(1,0,1)),f.x),mix(hash3(i+vec3(0,1,1)),hash3(i+vec3(1,1,1)),f.x),f.y),f.z);}
`;

function subjectMaterial(R, options = {}) {
  return new R.ShaderMaterial({
    // Opaque timber must write depth in the opaque pass. Transparent sorting
    // changes when hovered parts move and caused surfaces to flash over fog.
    transparent: false, depthWrite: true, depthTest: true,
    uniforms: {
      uTime: { value: 0 }, uReveal: { value: 1 }, uGlow: { value: .05 }, uAlpha: { value: 1 },
      ...(options.components?{uComponentSplit:{value:0}}:{}),
      uDark: { value: new R.Color(options.dark || '#8997ad') },
      uLight: { value: new R.Color(options.light || '#edf5ff') },
      tFrost: { value: R.textures.load('cubes/cube3_normal.ktx2', 'linear-repeat') },
      tGrain: { value: R.textures.load('cubes/cube3_roughness.ktx2', 'linear-repeat') },
    },
    vertexShader: `${options.components?'attribute vec3 aExplodeOffset;uniform float uComponentSplit;':''}
      varying vec3 vPos;varying vec3 vNormal;varying vec3 vWorld;varying vec3 vEye;
      void main(){vPos=position;vNormal=mat3(modelMatrix)*normal;vec3 displaced=position;
        ${options.components?'displaced+=aExplodeOffset*uComponentSplit;':''}
        vec4 w=modelMatrix*vec4(displaced,1.);vWorld=w.xyz;vEye=cameraPosition-w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}`,
    fragmentShader: `varying vec3 vPos,vNormal,vWorld,vEye;uniform float uTime,uReveal,uGlow,uAlpha;uniform vec3 uDark,uLight;uniform sampler2D tFrost,tGrain;${noise}
      vec3 tri(sampler2D tex,vec3 p,vec3 n){vec3 w=pow(abs(n),vec3(4.));w/=max(.001,w.x+w.y+w.z);return texture2D(tex,p.yz).rgb*w.x+texture2D(tex,p.xz).rgb*w.y+texture2D(tex,p.xy).rgb*w.z;}
      vec3 unit(vec3 v){float l=dot(v,v);return l>1e-12?v*inversesqrt(l):vec3(0.,1.,0.);}
      void main(){
        float disintegrate=hash3(floor(vPos*60.));if(disintegrate>uReveal)discard;
        vec3 n=unit(vNormal);vec3 ice=tri(tFrost,vPos*8.4,n);float grain=tri(tGrain,vPos*5.2,n).r;
        float footprint=max(length(dFdx(vPos*8.4)),length(dFdy(vPos*8.4)));
        vec3 detail=(ice-.5)*vec3(1.,1.,.35);n=unit(n+detail*.22/(1.+footprint*32.));
        float diffuse=clamp(dot(n,unit(vec3(-.35,.75,-.8)))*.5+.5,0.,1.);
        float top=clamp(n.y*.5+.5,0.,1.);
        float occlusion=.72+.28*smoothstep(.15,.85,grain);
        vec3 color=mix(uDark,uLight,pow(diffuse,1.65))*(.74+grain*.32)*occlusion;
        float rim=pow(clamp(1.-abs(dot(unit(vEye),n)),0.,1.),3.5);
        color+=vec3(.65,.83,1.)*rim*(.12+uGlow*.8);
        float sheen=pow(clamp(dot(reflect(-unit(vec3(-.4,1.,-.7)),n),unit(vEye)),0.,1.),8.);
        color+=sheen*.06; color+=vec3(.65,.83,1.)*uGlow*(.07+top*.12);
        gl_FragColor=vec4(color,uAlpha);
      }`,
  });
}

function merged(records, predicate, size, orientation = null) {
  const geometry = mergeGeometries(records.filter(r => predicate(r.name)).map(r => {
    const g = r.geometry.clone();
    for (const key of Object.keys(g.attributes)) if (!['position','normal'].includes(key)) g.deleteAttribute(key);
    return g;
  }));
  geometry.computeBoundingBox();
  const center = geometry.boundingBox.getCenter(new THREE.Vector3());
  const bounds = geometry.boundingBox.getSize(new THREE.Vector3());
  geometry.translate(-center.x, -center.y, -center.z);
  geometry.scale(size / Math.max(bounds.x,bounds.y,bounds.z), size / Math.max(bounds.x,bounds.y,bounds.z), size / Math.max(bounds.x,bounds.y,bounds.z));
  if (orientation) geometry.applyMatrix4(orientation);
  const pos = geometry.attributes.position;
  const uv = new Float32Array(pos.count*2);
  const uv1 = new Float32Array(pos.count*2);
  for (let i=0;i<pos.count;i++) {
    uv[i*2] = Math.atan2(pos.getZ(i),pos.getX(i)) / (Math.PI*2)+.5;
    uv[i*2+1] = pos.getY(i)/size+.5;
    uv1[i*2] = pos.getX(i)/size+.5;uv1[i*2+1] = pos.getY(i)/size+.5;
  }
  geometry.setAttribute('uv', new THREE.BufferAttribute(uv,2));
  geometry.setAttribute('uv1', new THREE.BufferAttribute(uv1,2));
  geometry.computeBoundingBox();geometry.computeBoundingSphere();
  return geometry;
}

// Geometry IDs and mutable attribute layouts are renderer-version-specific.
// Never submit loader-runtime geometry directly to the reference renderer:
// duplicate IDs collide in its VAO cache when another scene/HUD is drawn.
function runtimeGeometry(R, source) {
  const geometry=new R.BufferGeometry();
  geometry.name=source.name;
  for(const [name,attribute] of Object.entries(source.attributes)){
    geometry.setAttribute(name,new R.BufferAttribute(attribute.array,attribute.itemSize,attribute.normalized));
  }
  if(source.index)geometry.setIndex(new R.BufferAttribute(source.index.array,1));
  for(const group of source.groups)geometry.addGroup(group.start,group.count,group.materialIndex);
  geometry.setDrawRange(source.drawRange.start,source.drawRange.count);
  geometry.computeBoundingBox();geometry.computeBoundingSphere();
  return geometry;
}

// Recover connected timber components, including vertices split at UV/normal
// seams, so the reference portal shader can move entire beams coherently.
function portalAttributes(geometry) {
  const p=geometry.attributes.position, parents=new Int32Array(p.count);
  const coordinates=new Map();
  const root=i=>{while(parents[i]!==i){parents[i]=parents[parents[i]];i=parents[i];}return i;};
  const join=(a,b)=>{parents[root(a)]=root(b);};
  for(let i=0;i<p.count;i++)parents[i]=i;
  for(let i=0;i<p.count;i++){
    const key=[p.getX(i),p.getY(i),p.getZ(i)].map(v=>Math.round(v*100000)).join(',');
    if(coordinates.has(key))join(i,coordinates.get(key));else coordinates.set(key,i);
  }
  const index=geometry.index;
  for(let i=0;i<index.count;i+=3){join(index.getX(i),index.getX(i+1));join(index.getX(i),index.getX(i+2));}
  const groups=new Map();
  for(let i=0;i<p.count;i++){
    const r=root(i);if(!groups.has(r))groups.set(r,{min:[Infinity,Infinity,Infinity],max:[-Infinity,-Infinity,-Infinity]});
    const g=groups.get(r),pos=[p.getX(i),p.getY(i),p.getZ(i)];
    pos.forEach((v,k)=>{g.min[k]=Math.min(g.min[k],v);g.max[k]=Math.max(g.max[k],v);});
  }
  const center=new Float32Array(p.count*3),random=new Float32Array(p.count*3);
  for(let i=0;i<p.count;i++){
    const r=root(i),g=groups.get(r);
    for(let k=0;k<3;k++){
      center[i*3+k]=(g.min[k]+g.max[k])*.5;
      const n=Math.sin(r*12.9898+k*78.233)*43758.5453;
      random[i*3+k]=n-Math.floor(n);
    }
  }
  geometry.setAttribute('centr',new THREE.BufferAttribute(center,3));
  geometry.setAttribute('rand',new THREE.BufferAttribute(random,3));
  return geometry;
}

window.__installTower = async R => {
  const records = await rawModel;
  const homeRecords=await rawHomeModel;
  // A local text texture replaces the old brand while retaining its reveal,
  // hover animation, position and responsive sizing.
  const wordmark=document.createElement('canvas');wordmark.width=1024;wordmark.height=216;
  const ink=wordmark.getContext('2d');ink.fillStyle='#000';ink.fillRect(0,0,1024,216);
  ink.fillStyle='#fff';ink.font='bold 180px monospace';ink.textAlign='center';ink.textBaseline='middle';
  ink.fillText('YINGXIAN',512,112,1000);
  const logo=R.controller.uiScene.logo.mesh.material;
  logo.uniforms.tMap.value=new THREE.CanvasTexture(wordmark);
  logo.fragmentShader=logo.fragmentShader.replace('a *= msdf(tMap, uv);','a *= texture2D(tMap, uv).r;');
  logo.needsUpdate=true;
  const [exterior, objects, passage] = R.controller.scrollComposers.map(c => c.passes[0].scene);
  const home = new R.Group();home.name='yingxian-tower';home.scale.setScalar(4.7);home.position.y=-.52;
  const parts = new Map();
  const mat = subjectMaterial(R,{components:true});
  for (const r of homeRecords) {
    if (!parts.has(r.name)) {
      const group=new R.Group();group.name=r.name;
      const box=new THREE.Box3();homeRecords.filter(o=>o.name===r.name).forEach(o=>box.union(o.geometry.boundingBox));
      group.userData.center=box.getCenter(new THREE.Vector3());
      group.position.copy(group.userData.center);
      parts.set(r.name,group);home.add(group);
    }
  }
  exterior.add(home);
  // Keep one stable draw mesh per storey. Its individual timber islands move
  // rigidly in the vertex shader, using offsets baked once during loading.
  const floors=new Map();
  for(const part of parts.values()){
    const key=part.name.split('__')[0];
    if(!floors.has(key))floors.set(key,{parts:[],center:new THREE.Vector3(),offset:0});
    const floor=floors.get(key);floor.parts.push(part);floor.center.add(part.userData.center);
  }
  for(const [key,floor] of floors){
    floor.center.divideScalar(floor.parts.length);
    const anchor=floor.parts[0],{geometry,components,box}=homeStoreyGeometry(homeRecords,key,anchor.userData.center);
    floor.components=components;floor.box=box;
    const mesh=new R.Mesh(runtimeGeometry(R,geometry),mat);
    mesh.name='tower-storey-'+key;mesh.frustumCulled=false;
    anchor.add(mesh);geometry.dispose();
  }
  // The exterior camera stays well outside the pagoda. A 1m near plane gives
  // the dense timber surfaces ten times the depth precision of the old 0.1m.
  exterior.camera.near=1;
  exterior.camera.updateProjectionMatrix();
  exterior.igloobase.mesh.material.uniforms.tMap.value = R.textures.load('igloo/ground_sansigloo_color.ktx2', 'srgb');
  const homeInteraction=installHomeInteraction(R,exterior);
  const modelHover=installModelHover(home,floors,exterior.camera,homeInteraction);
  const structureHud=installStructureHud(home,floors,exterior.camera,homeInteraction.state);
  // The cursor HUD stays independent of the rigid-storey hover animation.
  exterior.beforeRenderCbs.push(()=>{
    exterior.igloo.mesh.visible=false;exterior.igloocage.mesh.visible=false;exterior.igloooutline.mesh.visible=false;
    const reveal=homeInteraction.state.introComplete?1:THREE.MathUtils.clamp(exterior.igloo.mesh.material.uniforms.uIntroMaterialize.value,0,1);
    mat.uniforms.uReveal.value=reveal;mat.uniforms.uTime.value=R.time.time;
    const damping=1-Math.exp(-Math.min(R.time.delta,50)/350);
    modelHover.update(homeInteraction.state.introComplete&&exterior.isSceneVisible&&!R.controller.isDetailOpen,damping);
    mat.uniforms.uComponentSplit.value=homeInteraction.state.componentSplit;
    for(const [key,floor] of floors){
      const center=floor.center;
      const entry=(1-reveal)*.45;
      const target=(/base|annex/.test(key)?0:entry);
      floor.offset=THREE.MathUtils.lerp(floor.offset,target,damping);
      for(const part of floor.parts){
        part.userData.offset=floor.offset;
        part.userData.hoverLift=floor.hoverLift||0;
        part.position.copy(part.userData.center);part.position.y+=center.y*floor.offset+(floor.hoverLift||0);
        part.rotation.y=0;
      }
    }
    const glow=.08+(1-reveal)*.6;
    mat.uniforms.uGlow.value=THREE.MathUtils.lerp(mat.uniforms.uGlow.value,glow,damping);
    home.visible=reveal>.001;
  });
  R.events.on('webgl_render',()=>structureHud.update(homeInteraction.state.introComplete&&exterior.isSceneVisible&&!R.controller.isDetailOpen));

  const selections=[
    {levels:['level5','spire']},
    {levels:['level4','level3']},
    {levels:['level2','level1','base','annex']},
  ];
  if(objects.cubes.length!==selections.length)throw new Error('Expected three tower structure views');
  objects.cubes.forEach((cube,i)=>{
    const selection=selections[i];
    const includesLevel=name=>selection.levels.some(level=>name.startsWith(level));
    const geometry=runtimeGeometry(R,merged(records,includesLevel,2.9));
    geometry.boundsTree=new R.BVH(geometry);
    cube.mesh.geometry=geometry;
    cube.mesh.name=['tower-crown','tower-upper','tower-lower'][i];
    cube.mesh.userData.towerLevels=selection.levels;
    cube.mesh.material.uniforms.uThickness.value=.35;
    cube.mesh.material.uniforms.uTransmission.value=.68;
    cube.mesh.material.normalScale.set(.55,.55);
    cube.mesh3.material.visible=false;
    const detail=R.controller.detailScene.objects[i];
    detail.mesh.geometry=runtimeGeometry(R,merged(records,includesLevel,1.2));
    detail.mesh.material=subjectMaterial(R,{dark:'#102034',light:'#7a91ab'});
    detail.mesh.name=cube.mesh.name+'-detail';
  });

  // Each existing portal becomes an authentic floor's open timber skeleton.
  passage.rings.meshes.forEach((ring,i)=>{
    const level=3+i;
    const geo=merged(records,n=>n.startsWith('level'+level)&&n.includes('__frame'),3.5);
    geo.rotateX(Math.PI/2);
    ring.geometry=runtimeGeometry(R,portalAttributes(geo));
    ring.name='tower-interior-'+level;
  });

  // Swap the signed-distance field; the 150k-particle simulation, fluid cursor
  // response, shadow estimation and social carousel remain the reference ones.
  const particles=passage.containerparticles;
  const volumes=(await volumeData).map((buffer,i)=>{
    const volume=new THREE.Data3DTexture(new Uint8Array(buffer),96,96,96);
    volume.name=['tower','middle','crown'][i];
    volume.format=THREE.RGBAFormat;volume.type=THREE.UnsignedByteType;
    volume.minFilter=THREE.LinearFilter;volume.magFilter=THREE.LinearFilter;
    volume.unpackAlignment=1;volume.needsUpdate=true;
    return volume;
  });
  particles.vdbs=volumes;particles.vdbScales=[1,1,1];
  particles.mesh.computationMaterial.uniforms.tVolume.value=volumes[0];
  particles.mesh.computationMaterial.uniforms.uVolumeScale.value=1;

  window.MUTA = {
    ready:true, reference:R, homeState:homeInteraction.state,
    subjects:{home,parts,floors,crown:objects.cubes[0],upper:objects.cubes[1],lower:objects.cubes[2],middle:objects.cubes[1],passage},
    get progress(){return R.controller.scroll.y;},
    go(value){R.controller.stopAutoCenter();R.controller.centerScroll(value,.8);},
    chapters:{home:.66,crown:2.35,upper:3.35,lower:4.35,interior:6.2,final:9.29},
  };
  document.dispatchEvent(new CustomEvent('tower-ready'));
};

import('./reference/assets/index-2e130bc1.js').catch(error=>{
  console.error(error);
  document.body.innerHTML='<p style="padding:32px;color:white;background:#777e8a;font-family:monospace">场景加载失败，请通过本地服务器打开并刷新。</p>';
});
