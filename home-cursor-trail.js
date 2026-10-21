// Screen-space HUD: deliberately independent of Three.js and bloom/depth.
export function installCursorTrail(state) {
  const canvas=document.createElement('canvas');
  canvas.id='home-cursor-trail';
  canvas.setAttribute('aria-hidden','true');
  Object.assign(canvas.style,{position:'fixed',inset:'0',width:'100%',height:'100%',pointerEvents:'none',zIndex:'20'});
  document.body.appendChild(canvas);
  const ctx=canvas.getContext('2d');
  const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
  let width=0,height=0,scale=0,enabled=false,pointer=null;
  const history=[];
  const lifetime=900;
  function reset(){history.length=0;pointer=null;}
  window.addEventListener('pointermove',event=>{
    if(event.pointerType==='touch'){reset();return;}
    if(!enabled||reducedMotion.matches)return;
    pointer={x:event.clientX,y:event.clientY};
    const now=performance.now();
    const last=history[history.length-1];
    if(last&&Math.hypot(event.clientX-last.x,event.clientY-last.y)<2)return;
    history.push({x:event.clientX,y:event.clientY,time:now});
    if(history.length>240)history.shift();
  },{passive:true});
  window.addEventListener('blur',reset);
  document.documentElement.addEventListener('pointerleave',reset);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)reset();});

  function update(visible){
    const nextScale=Math.min(devicePixelRatio||1,2);
    if(width!==innerWidth||height!==innerHeight||scale!==nextScale){
      width=innerWidth;height=innerHeight;scale=nextScale;
      canvas.width=Math.round(width*scale);canvas.height=Math.round(height*scale);
      ctx.setTransform(scale,0,0,scale,0,0);reset();
    }
    ctx.clearRect(0,0,width,height);
    enabled=visible&&!document.hidden&&!reducedMotion.matches;
    canvas.hidden=!enabled;
    state.hoverNumbers=0;state.hoverLineVertices=0;state.trailHead=null;
    if(!enabled){reset();return;}
    const now=performance.now();
    while(history.length&&now-history[0].time>lifetime)history.shift();
    if(history.length<2)return;
    // Equally spaced samples along the actual recent path preserve a tail
    // during rapid turns, rather than leaving annotations attached to the tower.
    const points=[];
    let travelled=0;
    for(let i=history.length-1;i>=0&&points.length<14;i--){
      const point=history[i],previous=history[i+1];
      if(previous)travelled+=Math.hypot(point.x-previous.x,point.y-previous.y);
      if(points.length&&travelled<18)continue;
      travelled=0;points.push(point);
    }
    if(points.length<2)return;
    const fade=Math.min(1,(lifetime-(now-points[0].time))/250);
    ctx.lineWidth=.65;ctx.strokeStyle='#edf4ff';ctx.fillStyle='#edf4ff';
    ctx.font='10px monospace';ctx.textBaseline='middle';
    const nodes=[];
    points.forEach((point,i)=>{
      const opacity=fade*(1-i/points.length)*Math.min(1,(lifetime-(now-point.time))/220);
      nodes.push({...point,opacity,spine:i,side:0});
      const next=points[i+1]||points[i-1];
      const dx=point.x-next.x,dy=point.y-next.y,length=Math.hypot(dx,dy)||1;
      // Two offset rails make a small moving data network around the path.
      for(const side of [-1,1]){
        const spread=20+(i%3)*9;
        nodes.push({x:point.x-dy/length*spread*side-dx/length*9,y:point.y+dx/length*spread*side-dy/length*9,opacity:opacity*.65,spine:i,side});
      }
    });
    function line(a,b,alpha){
      ctx.globalAlpha=Math.min(a.opacity,b.opacity)*alpha;
      ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();
      state.hoverLineVertices+=2;
    }
    nodes.forEach((point,i)=>{
      ctx.globalAlpha=point.opacity*.72;
      ctx.beginPath();ctx.moveTo(point.x-3,point.y);ctx.lineTo(point.x+3,point.y);
      ctx.moveTo(point.x,point.y-3);ctx.lineTo(point.x,point.y+3);ctx.stroke();
      const value=Math.floor((point.x/width+point.y/height)*500);
      ctx.fillText(point.side?String(Math.abs(value)%1000).padStart(3,'0'):String(Math.abs(value)%100).padStart(2,'0'),point.x+7,point.y-8);
      state.hoverNumbers++;
      if(point.side){
        line(point,nodes[point.spine*3],.32);
        const next=nodes[i+3];if(next)line(point,next,.22);
        const diagonal=nodes[(point.spine+1)*3];if(diagonal)line(point,diagonal,.13);
      }else{
        for(const offset of [1,2,3]){
          const next=nodes[(point.spine+offset)*3];if(next)line(point,next,offset===1?.38:.13);
        }
      }
    });
    ctx.globalAlpha=1;
    state.trailHead={x:points[0].x,y:points[0].y};
  }
  return {update,getPointer:()=>enabled?pointer:null};
}
