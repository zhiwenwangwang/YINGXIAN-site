import { installCursorTrail } from './home-cursor-trail.js';

export function installHomeInteraction(R, exterior) {
  const legacy=exterior.igloo;
  // Stop the obsolete batched-mesh/plexus updates, not just their visibility.
  const legacyIndex=exterior.beforeRenderCbs.indexOf(legacy.updateCallback);
  if(legacyIndex<0)throw new Error('Legacy interaction callback missing');
  exterior.beforeRenderCbs.splice(legacyIndex,1);
  for(const mesh of [legacy.mesh,legacy.plexus.lineMesh,legacy.plexus.points.mesh,legacy.plexus.numbers.mesh]){
    mesh.visible=false;
    mesh.removeFromParent();
  }
  // Use a separate uniform value so the ground's old pointer callback cannot
  // vary its lighting. The trail never writes to a WebGL buffer or material.
  exterior.igloobase.mesh.material.uniforms.uMousePos.value=legacy.mousePosition.clone().set(0,-1000,0);
  // Freeze the intro once it has finished. A wrap from the last scene must not
  // fly down from the opening aerial camera or replay the text scramble.
  const state={introComplete:false,initialAnimationRuns:0,returns:0,wasVisible:true,interaction:'cursor-trail'};
  const trail=installCursorTrail(state);
  const playIntro=exterior.playInAnimation.bind(exterior);
  exterior.playInAnimation=async()=>{
    if(state.initialAnimationRuns>0)return;
    state.initialAnimationRuns++;
    return playIntro();
  };
  const update=exterior.updateCallback;
  const index=exterior.beforeRenderCbs.indexOf(update);
  if(index<0)throw new Error('Exterior lifecycle callback missing');
  exterior.beforeRenderCbs[index]=()=>{
    if(exterior.introTL.progress()===1)state.introComplete=true;
    const progress=exterior.progress;
    if(state.introComplete)exterior.progress=Math.max(progress,exterior.initialScrollAutocenter);
    update();
    exterior.progress=progress;
  };
  const manifesto=exterior.manifesto,show=manifesto.show.bind(manifesto);
  manifesto.show=()=>{
    if(!state.introComplete)return show();
    manifesto.visible=true;
    for(const item of [manifesto.title,manifesto.text,manifesto.copyright,manifesto.rights]){
      for(const name of ['uShow1','uShow2','uBlink']){
        const uniform=item.material.uniforms[name];
        if(uniform){R.tween.killTweensOf(uniform);uniform.value=1;}
      }
    }
  };
  R.engine.renderPass.scene.beforeRenderCbs.push(()=>{
    if(state.introComplete&&exterior.isSceneVisible&&!state.wasVisible)state.returns++;
    state.wasVisible=exterior.isSceneVisible;
    trail.update(state.introComplete&&exterior.isSceneVisible&&!R.controller.isDetailOpen);
  });
  return {state,getPointer:trail.getPointer};
}
