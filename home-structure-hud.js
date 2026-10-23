import * as THREE from 'three';

const EDGES=[[0,1],[0,2],[0,4],[1,3],[1,5],[2,3],[2,6],[3,7],[4,5],[4,6],[5,7],[6,7]];

// Project architectural annotations into a separate 2D layer. No transparent
// WebGL faces, depth bias, shared render buffers or pointer event interception.
export function installStructureHud(home,floors,camera,state) {
  const canvas=document.createElement('canvas');canvas.id='home-structure-hud';canvas.setAttribute('aria-hidden','true');
  Object.assign(canvas.style,{position:'fixed',inset:'0',width:'100%',height:'100%',pointerEvents:'none',zIndex:'15'});
  document.body.appendChild(canvas);
  const ctx=canvas.getContext('2d'),vector=new THREE.Vector3();
  const levels=[...floors.entries()].filter(([key])=>/^level[1-5]$/.test(key));
  const total=[...floors.values()].reduce((sum,floor)=>sum+floor.components.length,0);
  const memberCount=floor=>new Set(floor.components.map(c=>c.sourceName||c.id)).size;
  const members=[...floors.values()].reduce((sum,floor)=>sum+memberCount(floor),0);
  const scans=levels.map(([key,floor],i)=>{
    const exploded=new THREE.Box3();
    for(const component of floor.components)exploded.union(component.box.clone().translate(component.offset));
    const frame=floor.components.filter(c=>c.type==='bracket'&&c.vertices>24);
    const nodes=[-1,1].map(side=>frame.reduce((best,c)=>{
      const score=c.center.x*side-c.center.z*.25;
      return !best||score>best.score?{component:c,score}:best;
    },null)?.component).filter(Boolean);
    return {key,floor,index:i,exploded,nodes,members:memberCount(floor)};
  });
  let width=0,height=0,scale=0,labels=0,segments=0;
  const project=point=>{
    vector.copy(point).applyMatrix4(home.matrixWorld).project(camera);
    return {x:(vector.x+1)*width/2,y:(1-vector.y)*height/2,z:vector.z};
  };
  function line(a,b,alpha=.5,dashed=false){
    ctx.globalAlpha=alpha;ctx.setLineDash(dashed?[3,5]:[]);
    ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();segments++;
  }
  function cross(point,r=3){line({x:point.x-r,y:point.y},{x:point.x+r,y:point.y},.85);line({x:point.x,y:point.y-r},{x:point.x,y:point.y+r},.85);}
  function text(value,x,y,alpha=.9){ctx.globalAlpha=alpha;ctx.fillText(value,x,y);labels++;}
  function update(visible){
    const nextScale=Math.min(devicePixelRatio||1,2);
    if(width!==innerWidth||height!==innerHeight||scale!==nextScale){
      width=innerWidth;height=innerHeight;scale=nextScale;canvas.width=Math.round(width*scale);canvas.height=Math.round(height*scale);
      ctx.setTransform(scale,0,0,scale,0,0);
    }
    canvas.hidden=!visible;ctx.clearRect(0,0,width,height);
    state.structureLabels=0;state.structureLineSegments=0;state.structuralComponents=total;
    if(!visible||document.hidden)return;
    home.updateWorldMatrix(true,false);
    labels=0;segments=0;
    const split=state.componentSplit||0,opacity=.3+split*.6,compact=width<650;
    ctx.strokeStyle='#e7f5ff';ctx.fillStyle='#f1f8ff';ctx.lineWidth=.65;
    ctx.font=`${compact?8:10}px monospace`;ctx.textBaseline='middle';ctx.textAlign='left';
    const projected=[];
    for(const scan of scans){
      const {floor,index}=scan,box=floor.box.clone();
      box.min.lerp(scan.exploded.min,split);box.max.lerp(scan.exploded.max,split);
      box.expandByScalar(.007);box.translate(new THREE.Vector3(0,floor.hoverLift||0,0));
      const corners=[];
      for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z])corners.push(project(new THREE.Vector3(x,y,z)));
      if(corners.some(p=>p.z>1||p.z< -1))continue;
      for(const [a,b] of EDGES)line(corners[a],corners[b],opacity*.34,true);
      const left=Math.min(...corners.map(p=>p.x)),right=Math.max(...corners.map(p=>p.x));
      const top=Math.min(...corners.map(p=>p.y)),bottom=Math.max(...corners.map(p=>p.y));
      projected.push({left,right,top,bottom});
      const side=index%2? -1:1,anchor=side===1?{x:right,y:(top+bottom)/2}:{x:left,y:(top+bottom)/2};
      const span=compact?15:34,labelWidth=compact?57:112;
      const elbow={x:anchor.x+side*span,y:anchor.y-8},end={x:elbow.x+side*labelWidth,y:elbow.y};
      if(end.x>8&&end.x<width-8&&elbow.y>30){
        line(anchor,elbow,opacity*.8);line(elbow,end,opacity*.8);cross(anchor,2.5);
        const x=side===1?elbow.x+3:end.x+3;
        text(`L0${index+1} / ${String(scan.members).padStart(3,'0')}`,x,elbow.y-8,opacity);
        if(!compact)text(`${index===4?'CROWN':'TIMBER FRAME'} · ${(state.modelSplit*100).toFixed(0)}%`,x,elbow.y+10,opacity*.72);
      }
      if(split>.05&&(!compact||index===2))for(const [j,component] of scan.nodes.entries()){
        const point=component.center.clone().addScaledVector(component.offset,split);point.y+=floor.hoverLift||0;
        const node=project(point),r=compact?5:7;
        ctx.globalAlpha=split*.7;ctx.setLineDash([]);ctx.strokeRect(node.x-r,node.y-r,r*2,r*2);segments+=4;
        const base=project(component.center.clone().add(new THREE.Vector3(0,floor.hoverLift||0,0)));
        line(base,node,split*.5,true);cross(node,2);
        if(!compact&&(index===1||index===3)&&j===1){
          const end={x:node.x+48,y:node.y+22};line(node,end,split*.65);
          text('DOUGONG / JOINT',end.x+4,end.y-5,split*.95);
          text(component.id.toUpperCase(),end.x+4,end.y+9,split*.65);
        }
      }
    }
    if(projected.length){
      const left=Math.min(...projected.map(p=>p.left)),right=Math.max(...projected.map(p=>p.right));
      const top=Math.max(28,Math.min(...projected.map(p=>p.top))),bottom=Math.max(...projected.map(p=>p.bottom));
      const x=Math.max(12,left-(compact?32:140));
      line({x,y:top},{x,y:bottom},opacity*.4,true);
      for(let i=0;i<=10;i++){
        const y=top+(bottom-top)*i/10;line({x:x-3,y},{x:x+(i%5===0?8:3),y},opacity*.7);
      }
      const y=Math.min(height-100,bottom+34),center=(left+right)/2;
      ctx.textAlign='center';text(`STRUCTURE / ${String(members).padStart(4,'0')} MEMBERS`,center,y,opacity);
      if(!compact)text('MORTISE + TENON / ASSEMBLY SCAN',center,y+16,opacity*.65);
    }
    ctx.globalAlpha=1;ctx.setLineDash([]);
    state.structureLabels=labels;state.structureLineSegments=segments;
  }
  return {update};
}
