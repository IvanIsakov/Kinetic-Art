import './style.css';
import { ClothSimulation, FIXED_DT, MAX_STROKE, RESOLUTIONS, type Pattern, type EdgeMode, defaults } from './cloth';
import { FabricScene } from './scene';
import { type LedPattern } from './leds';
import { CONFIG_KEY, validateConfig, type Configuration, type Library, type ControlRule } from './configurations';
const app = document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML = `<header class="topbar">
    <div class="brand"><div class="brandmark" aria-hidden="true"><svg viewBox="0 0 30 30" fill="none" stroke="currentColor" stroke-width=".8"><path d="M3 8L10 4L20 9L27 5M3 15L10 10L20 18L27 12M3 22L10 18L20 25L27 20M3 8V22M10 4V18M20 9V25M27 5V20"/></svg></div><div class="wordmark">FARAWAY LANDSCAPES<small>A study in impermanence</small></div></div>
    <button id="studio-toggle" aria-expanded="false">Open studio</button>
  </header>
  <main>
    <div class="intro"><div><p class="eyebrow">Material explorations</p><h1>A landscape, in motion.</h1></div><p>A continuous fabric. <span id="point-count">20</span> moving points.<br>Explore how tension turns movement into form.</p></div>
    <div class="workspace">
      <section class="stage" aria-label="Sculpture preview">
        <div id="viewport"></div>
        <div class="stage-top"><div class="stage-tag">FARAWAY LANDSCAPES<strong>A study in impermanence</strong></div><div class="live-tag"><span class="dot"></span><span id="state">LIVE STUDY</span></div></div>
        <div class="view-tools" aria-label="Camera views"><button data-view="gallery" title="Gallery view" aria-label="Gallery view">Room</button><button class="active" data-view="perspective" title="Perspective view" aria-label="Perspective view">3D</button><button data-view="front" title="Front view" aria-label="Front view">F</button><button data-view="side" title="Side view" aria-label="Side view">S</button></div>
        <div id="human-tools" hidden><span>Human selected · arrows move · Shift moves faster · Esc deselects</span><div><button data-human-move="ArrowLeft" aria-label="Move human left">←</button><button data-human-move="ArrowUp" aria-label="Move human farther">↑</button><button data-human-move="ArrowDown" aria-label="Move human closer">↓</button><button data-human-move="ArrowRight" aria-label="Move human right">→</button><button id="human-done">Done</button></div></div>
        <div class="stage-caption" id="dimensions">2.00 × 1.50 m &nbsp; / &nbsp; 5 × 4 piston matrix</div>
        <div class="transport"><button id="play" aria-label="Pause simulation">Ⅱ &nbsp; Pause</button><button id="reset" title="Restart the current study">↺ &nbsp; Restart</button><span class="clock" id="time">00:00</span><span class="hint">DRAG TO ORBIT &nbsp; · &nbsp; SCROLL TO ZOOM</span></div>
      </section>
      <aside class="panel" aria-label="Study controls">
        <div class="panel-title"><h2>Study controls</h2><span>02 / FABRIC + LIGHT</span></div>
        <div class="section configurations"><h3 class="section-heading">Configurations</h3>
<label class="field" for="config-list">Saved configurations</label><select id="config-list"><option value="">Choose a configuration</option></select>
<div class="config-actions"><button id="config-load">Load</button><button id="config-delete">Delete</button></div>
<label class="field" for="config-name">Configuration name</label><input id="config-name" type="text" maxlength="60" placeholder="Evening study">
<div class="config-actions"><button id="config-save">Save named</button><button id="config-default">Save as startup default</button></div>
<div class="config-actions"><button id="config-export">Export JSON</button><button id="config-import">Import JSON</button><input id="config-file" type="file" accept=".json,application/json" hidden></div>
<p id="config-status" class="small-note" role="status">Saved on this browser. Export a copy to use elsewhere.</p></div>
<div class="panel-tabs" aria-label="Control sections"><button id="fabric-tab" class="active" aria-pressed="true" aria-controls="fabric-controls">Fabric</button><button id="light-tab" aria-pressed="false" aria-controls="light-controls">Lighting</button></div>
        <div id="fabric-controls">
        <div class="section"><h3 class="section-heading">Piston matrix</h3>
          <div class="grid-size"><div><label class="field" for="columns">Columns</label><select id="columns">${Array.from({length:6},(e,t)=>`<option value="${t+5}">${t+5}</option>`).join(``)}</select></div>
          <div><label class="field" for="rows">Rows</label><select id="rows">${Array.from({length:7},(e,t)=>`<option value="${t+4}">${t+4}</option>`).join(``)}</select></div></div>
          <p class="small-note">Changing the grid restarts the fabric and clears manual overrides.</p>
        </div>
        <div class="section"><h3 class="section-heading">Movement</h3>
          <label class="check section-toggle"><input id="fabric-playing" type="checkbox" checked>Animate fabric</label>
          <label class="field" for="pattern">Piston pattern</label>
          <select id="pattern"><option value="wave">Travelling wave</option><option value="ripple">Radial ripple</option><option value="circulating">Circulating peak</option><option value="sequential">One after another</option><option value="breathing">Breathing surface</option><option value="flat">Rest / flat</option></select>
          <p id="pattern-note" class="small-note material-note">A wave travels across the piston matrix.</p>
          <label class="field" for="amplitude">Travel <output id="amplitude-value">220 mm</output></label><input id="amplitude" type="range" min="0" max="320" step="5" value="220">
          <label class="field" for="speed">Tempo <output id="speed-value">0.65×</output></label><input id="speed" type="range" min="0" max="2" step=".05" value=".65">
        </div>
        <div class="section"><h3 class="section-heading">Material</h3>
          <label class="field" for="resolution">Fabric vertices</label><select id="resolution">${RESOLUTIONS.map(e=>`<option value="${e}" ${e===72?`selected`:``}>${((e+1)*(e*3/4+1)).toLocaleString(`en-US`)} vertices${e===72?` · original`:``}</option>`).join(``)}</select>
          <p class="small-note material-note">Fewer vertices run faster, with coarser folds. The current pose is retained.</p>
          <label class="check section-toggle"><input id="normal-smoothing" type="checkbox" checked>Softer shading</label>
          <p class="small-note material-note">Smooths the lighting across triangles. Fabric shape and cast shadows stay the same.</p>
          <label class="field" for="tension">Tension <output id="tension-value">0.75×</output></label><input id="tension" type="range" min="0" max="300" value="75" aria-describedby="material-note">
          <label class="field" for="resistance">Stretch resistance <output id="resistance-value">0.70×</output></label><input id="resistance" type="range" min="0" max="300" value="70" aria-describedby="material-note">
          <label class="field" for="damping">Damping <output id="damping-value">55%</output></label><input id="damping" type="range" min="0" max="100" value="55">
          <p class="small-note material-note" id="material-note">1× is the previous maximum. Higher tension pre-stretches the sheet; higher resistance reduces its give.</p>
          <label class="field" for="edges">Edge attachment</label><select id="edges"><option value="moving">Piston-supported edges</option><option value="fixed">Fixed frame</option></select>
          <p class="small-note" id="edge-note">Edges move with the outer pistons. Higher tension reduces excess fabric.</p>
        </div>
        <div class="section"><h3 class="section-heading">Individual piston</h3>
          <div class="piston-line"><span id="selected-label">Row 2 · Column 3</span><button id="release" class="link-button">Release override</button></div>
          <div class="grid" id="piston-grid" aria-label="Select a piston"></div>
          <label class="field" for="piston">Manual position <output id="piston-value">Pattern</output></label><input id="piston" type="range" min="0" max="320" step="5" value="0">
          <div class="check-row"><label class="check"><input id="wireframe" type="checkbox">Mesh</label><label class="check"><input id="mechanism" type="checkbox">Mechanism</label></div>
        </div>
        </div>
        <div id="light-controls" hidden>
          <div class="section"><h3 class="section-heading">Perimeter lights</h3>
            <label class="check section-toggle"><input id="led-enabled" type="checkbox" checked>LEDs on</label>
            <label class="field" for="led-count">Number of LEDs <output id="led-count-value">60</output></label><input id="led-count" type="range" min="12" max="120" step="1" value="60">
            <p class="small-note">Evenly spaced around the frame. Brightness stays comparable when the count changes.</p>
          </div>
          <div class="section"><h3 class="section-heading">Light choreography</h3>
            <label class="field" for="led-depth">Distance from fabric rest plane <output id="led-depth-value">370 mm</output></label><input id="led-depth" type="range" min="50" max="1500" step="10" value="370">
            <p class="small-note">Move the LED frame closer or farther away. Measured from the flat fabric at zero piston travel.</p>
            <label class="check section-toggle"><input id="led-playing" type="checkbox" checked>Animate LEDs</label>
            <label class="field" for="led-pattern">Light pattern</label><select id="led-pattern"><option value="spectrum">Travelling spectrum</option><option value="chase">Perimeter chase</option><option value="rainbow-chase">Rainbow perimeter chase</option><option value="steady">Steady color</option><option value="breathing">Breathing light</option></select>
            <label class="field" for="led-period">Cycle duration <output id="led-period-value">16 s</output></label><input id="led-period" type="range" min="4" max="60" step="1" value="16">
            <label class="field" for="led-color">Light color <input id="led-color" type="color" value="#ffd3a0" disabled></label>
            <p class="small-note" id="color-note">Rainbow patterns cycle their own colors.</p>
            <div id="led-strip" class="led-strip" aria-label="Live LED pattern preview"></div>
          </div>
          <div class="section"><h3 class="section-heading">Illumination</h3>
            <label class="field" for="led-brightness">LED brightness <output id="led-brightness-value">100%</output></label><input id="led-brightness" type="range" min="0" max="300" step="5" value="100">
            <label class="field" for="ambient">Ambient light <output id="ambient-value">12%</output></label><input id="ambient" type="range" min="0" max="100" step="1" value="12">
            <label class="check section-toggle"><input id="led-shadows" type="checkbox" checked>LED shadows</label>
            <p class="small-note">Shadow detail is approximated for speed. Turn shadows off for a faster preview. Pause fabric to watch light travel across a still surface.</p>
          </div>
        </div>
      </aside>
    </div>
    <div class="diagnostics" aria-label="Simulation diagnostics"><div class="metric"><span>Surface / lights</span><strong id="surface-count">4,015 vertices · 60 LEDs</strong></div><div class="metric"><span>Relief depth</span><strong id="depth">0 mm</strong></div><div class="metric"><span>Average / peak stretch</span><strong id="strain">0.0% / 0.0%</strong></div><div class="metric"><span>Performance</span><strong id="performance">Measuring…</strong></div></div>
    <footer><p>A material study for FARAWAY LANDSCAPES. Fabric behaviour is approximate and awaits physical calibration.</p><p>Drag a slider to explore. Select a point to shape it.</p></footer>
  </main>`;
document.body.classList.add('presentation');
let simulation = new ClothSimulation();
const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
let selected=7, running=!window.matchMedia('(prefers-reduced-motion: reduce)').matches, fabricPlaying=true;
let scene: FabricScene;
try { scene=new FabricScene($('viewport'),simulation); }
catch(error){$('viewport').innerHTML='<div class="error"><h2>The 3D study could not start.</h2><p>This experience needs WebGL 2 and hardware acceleration.</p></div>';throw error;}
const gridButtons:HTMLButtonElement[]=[];
function buildGrid(){
 $('piston-grid').replaceChildren();gridButtons.length=0;
 $('piston-grid').style.gridTemplateColumns=`repeat(${simulation.cols}, minmax(0, 1fr))`;
 $('piston-grid').classList.toggle('dense',simulation.cols>7);
 for(let row=0;row<simulation.rows;row++)for(let col=0;col<simulation.cols;col++){
  const id=row*simulation.cols+col,b=document.createElement('button');b.textContent=`${row+1}.${col+1}`;
  b.setAttribute('aria-label',`Select piston row ${row+1} column ${col+1}`);b.addEventListener('click',()=>selectPiston(id));$('piston-grid').appendChild(b);gridButtons.push(b);
 }
 $('point-count').textContent=String(simulation.cols*simulation.rows);
 $('dimensions').textContent=`2.00 × 1.50 m / ${simulation.cols} × ${simulation.rows} piston matrix`;updateEdgeNote();updateSurfaceCount();
}
function selectPiston(id:number){selected=id;scene.setSelection(id);$('selected-label').textContent=`Row ${Math.floor(id/simulation.cols)+1} · Column ${id%simulation.cols+1}`;updatePistonUI();}
function updatePistonUI(){
 const fixed=simulation.settings.edges==='fixed'&&simulation.pistonXY[selected].boundary,manual=simulation.overrides[selected];
 const input=$<HTMLInputElement>('piston');input.disabled=fixed;input.value=String(Math.round((manual>=0?manual:simulation.pistonPositions[selected])*1000));
 $('piston-value').textContent=fixed?'Fixed at 0 mm':manual>=0?`${Math.round(manual*1000)} mm`:'Pattern';$<HTMLButtonElement>('release').disabled=manual<0;
 gridButtons.forEach((b,id)=>{b.classList.toggle('selected',id===selected);b.setAttribute('aria-pressed',String(id===selected));b.classList.toggle('overridden',simulation.overrides[id]>=0);b.style.background=`hsl(83 16% ${92-simulation.pistonPositions[id]/MAX_STROKE*30}%)`;});
}
function updateEdgeNote(){$('edge-note').textContent=simulation.settings.edges==='fixed'?`The perimeter stays at rest. Only ${(simulation.cols-2)*(simulation.rows-2)} interior pistons move.`:'Edges move with the outer pistons. Higher tension reduces excess fabric.';}
function updateSurfaceCount(){$('surface-count').textContent=`${simulation.invMass.length.toLocaleString('en-US')} vertices · ${scene.leds.count} LEDs`;}
buildGrid();selectPiston(selected);scene.setSelectionHandler(selectPiston);
function slider(id:string,update:(v:number)=>string){$(id).addEventListener('input',e=>{$(id+'-value').textContent=update(Number((e.target as HTMLInputElement).value));});}
slider('amplitude',v=>{simulation.settings.amplitude=v/1000;return `${v} mm`;});
slider('speed',v=>{simulation.settings.speed=v;return `${v.toFixed(2)}×`;});
slider('tension',v=>{simulation.settings.slack=(100-v)/1000;return `${(v/100).toFixed(2)}×`;});
slider('resistance',v=>{simulation.settings.resistance=v/100;return `${(v/100).toFixed(2)}×`;});
slider('damping',v=>{simulation.settings.damping=v/100;return `${v}%`;});
$('piston').addEventListener('input',e=>{simulation.overrides[selected]=Number((e.target as HTMLInputElement).value)/1000;updatePistonUI();});
$('release').addEventListener('click',()=>{simulation.overrides[selected]=-1;updatePistonUI();});
$('pattern').addEventListener('change',e=>{
 const p=(e.target as HTMLSelectElement).value as Pattern;simulation.setPattern(p);
 const notes:Record<Pattern,string>={wave:'A wave travels across the piston matrix.',ripple:'Ripples spread outward from the centre.',circulating:'One peak targets 100% of Travel; its neighbours target 50%. Anticlockwise from the front.',sequential:'Row by row, each piston rises and returns before the next starts.',breathing:'All pistons rise and fall together.',flat:'All pistons return to rest; the fabric continues to settle.'};
 $('pattern-note').textContent=notes[p];updatePistonUI();
});
$('normal-smoothing').addEventListener('change',e=>{scene.smoothShading=(e.target as HTMLInputElement).checked;scene.invalidateFabric();});
$('edges').addEventListener('change',e=>{simulation.settings.edges=(e.target as HTMLSelectElement).value as EdgeMode;simulation.reset();scene.invalidateFabric();updateEdgeNote();updatePistonUI();});
function changeGrid(){const next=new ClothSimulation(Number($<HTMLSelectElement>('columns').value),Number($<HTMLSelectElement>('rows').value),simulation.segmentsX);next.settings={...simulation.settings};next.reset();simulation=next;scene.setSimulation(next);elapsed=0;accumulator=0;selected=Math.floor((next.rows-1)/2)*next.cols+Math.floor((next.cols-1)/2);buildGrid();selectPiston(selected);}
$('columns').addEventListener('change',changeGrid);$('rows').addEventListener('change',changeGrid);
$('resolution').addEventListener('change',()=>{const next=new ClothSimulation(simulation.cols,simulation.rows,Number($<HTMLSelectElement>('resolution').value));next.resampleFrom(simulation);simulation=next;scene.setSimulation(next);accumulator=0;updateSurfaceCount();});
$('fabric-playing').addEventListener('change',e=>{fabricPlaying=(e.target as HTMLInputElement).checked;accumulator=0;});
for(const tab of ['fabric','light'])$(tab+'-tab').addEventListener('click',()=>{for(const other of ['fabric','light']){$(other+'-controls').hidden=other!==tab;$(other+'-tab').classList.toggle('active',other===tab);$(other+'-tab').setAttribute('aria-pressed',String(other===tab));}});
const ledChips:HTMLElement[]=[];
function rebuildLedStrip(){$('led-strip').replaceChildren();ledChips.length=0;for(let i=0;i<scene.leds.count;i++){const chip=document.createElement('span');chip.title=`LED ${i+1}`;$('led-strip').appendChild(chip);ledChips.push(chip);}}
rebuildLedStrip();
$('led-count').addEventListener('input',e=>{const n=Number((e.target as HTMLInputElement).value);$('led-count-value').textContent=String(n);scene.setLedCount(n);rebuildLedStrip();updateSurfaceCount();});
for(const [id,setting] of [['led-enabled','enabled'],['led-playing','playing'],['led-shadows','shadows']] as const)$(id).addEventListener('change',e=>{scene.leds.settings[setting]=(e.target as HTMLInputElement).checked;});
$('led-pattern').addEventListener('change',e=>{scene.leds.settings.pattern=(e.target as HTMLSelectElement).value as LedPattern;scene.leds.phase=0;const rainbow=['spectrum','rainbow-chase'].includes(scene.leds.settings.pattern);$<HTMLInputElement>('led-color').disabled=rainbow;$('color-note').textContent=rainbow?'Rainbow patterns cycle their own colors.':'Choose the color for this light pattern.';});
$('led-color').addEventListener('input',e=>{scene.leds.settings.color=(e.target as HTMLInputElement).value;});
slider('led-depth',v=>{scene.leds.settings.depth=v/1000;return `${v} mm`;});
slider('led-period',v=>{scene.leds.settings.period=v;return `${v} s`;});
slider('led-brightness',v=>{scene.leds.settings.brightness=v/100;return `${v}%`;});
slider('ambient',v=>{scene.leds.settings.ambient=v/100;return `${v}%`;});
$('wireframe').addEventListener('change',e=>{scene.cloth.material.wireframe=(e.target as HTMLInputElement).checked;});
$('mechanism').addEventListener('change',e=>{scene.cloth.visible=!(e.target as HTMLInputElement).checked;});
document.querySelectorAll<HTMLButtonElement>('[data-view]').forEach(b=>b.addEventListener('click',()=>{scene.setView(b.dataset.view!);document.querySelectorAll('[data-view]').forEach(el=>el.classList.toggle('active',el===b));}));
function updatePlayback(){$('play').textContent=running?'Ⅱ Pause':'▶ Play';$('play').setAttribute('aria-label',running?'Pause simulation':'Play simulation');$('state').textContent=running?'LIVE':'PAUSED';}
$('play').addEventListener('click',()=>{running=!running;updatePlayback();});
$('reset').addEventListener('click',()=>{simulation.reset();scene.invalidateFabric();scene.leds.phase=0;elapsed=0;accumulator=0;updatePistonUI();});updatePlayback();
let last=performance.now(),accumulator=0,elapsed=0,statTime=last,ledPreviewTime=last,frames=0,simMs=0,simSamples=0;
document.addEventListener('visibilitychange',()=>{last=performance.now();accumulator=0;});
function frame(now:number){
 requestAnimationFrame(frame);const delta=Math.min((now-last)/1000,.05);last=now;if(document.hidden)return;
 if(running){scene.leds.advance(delta);elapsed+=delta;}
 if(running&&fabricPlaying){accumulator+=delta;const start=performance.now();let steps=0;while(accumulator>=FIXED_DT&&steps<6){simulation.step();accumulator-=FIXED_DT;steps++;}simMs+=performance.now()-start;simSamples++;}else accumulator=0;
 scene.draw(running&&fabricPlaying);frames++;
 if(now-ledPreviewTime>100&&!$('light-controls').hidden){scene.leds.samples.forEach((s,i)=>{const gain=Math.min(1,s.level);ledChips[i].style.background=`rgb(${s.r*gain*255} ${s.g*gain*255} ${s.b*gain*255})`;});ledPreviewTime=now;}
 if(now-statTime>600){const m=simulation.metrics();$('depth').textContent=`${Math.round((m.maxZ-m.minZ)*1000)} mm`;$('strain').textContent=`${(m.meanStrain*100).toFixed(1)}% / ${(m.maxStrain*100).toFixed(1)}%`;$('performance').textContent=`${Math.round(frames*1000/(now-statTime))} fps · ${(simMs/Math.max(1,simSamples)).toFixed(1)} ms cloth`;$('time').textContent=`${String(Math.floor(elapsed/60)).padStart(2,'0')}:${String(Math.floor(elapsed%60)).padStart(2,'0')}`;updatePistonUI();frames=0;simMs=0;simSamples=0;statTime=now;}
}
requestAnimationFrame(frame);
Object.defineProperty(window,'__fabricStudy',{get:()=>({metrics:simulation.metrics(),settings:{...simulation.settings},running,fabricPlaying,resolution:simulation.segmentsX,fabricTime:simulation.time,smoothShading:scene.smoothShading,presentation:scene.presentation,overrides:Array.from(simulation.overrides),leds:{count:scene.leds.count,phase:scene.leds.phase,settings:{...scene.leds.settings},samples:scene.leds.samples.map(s=>({...s}))},columns:simulation.cols,rows:simulation.rows,rendering:scene.diagnostics(),pistons:Array.from(simulation.pistonPositions),selected,finite:simulation.positions.every(Number.isFinite),defaults})});

// Save all editing controls plus the live solver state, so frozen studies also restore faithfully.
const configIds = ['columns','rows','resolution','pattern','amplitude','speed','tension','resistance','damping','edges','fabric-playing','normal-smoothing','wireframe','mechanism','led-count','led-depth','led-enabled','led-playing','led-pattern','led-period','led-color','led-brightness','ambient','led-shadows'];
const rules: Record<string, ControlRule> = {};
for(const id of configIds) {
  const el = $<HTMLInputElement | HTMLSelectElement>(id);
  rules[id] = el instanceof HTMLSelectElement ? {type:'select',options:Array.from(el.options,o=>o.value)} :
    el.type==='checkbox' ? {type:'checkbox'} : el.type==='color' ? {type:'color'} : {type:'number',min:Number(el.min),max:Number(el.max)};
}
let library: Library = {defaultName:null,configs:{}};
const status = (message:string) => { $('config-status').textContent=message; };
function captureConfig(): Configuration {
  const controls: Configuration['controls'] = {};
  for(const id of configIds) {const el=$<HTMLInputElement>(id);controls[id]=el.type==='checkbox'?el.checked:el.value;}
  return {version:1,humanPosition:scene.human.position,controls,running,selected,time:simulation.time,phase:scene.leds.phase,
    positions:Array.from(simulation.positions),previous:Array.from(simulation.previous),pistons:Array.from(simulation.pistonPositions),overrides:Array.from(simulation.overrides)};
}
function applyConfig(raw: unknown) {
  const c=validateConfig(raw,rules);
  if(c.humanPosition)scene.human.setPosition(c.humanPosition);
  // Rebuild once before updating controls; UI events then bind settings to the new solver.
  simulation=new ClothSimulation(Number(c.controls.columns),Number(c.controls.rows),Number(c.controls.resolution));
  scene.setSimulation(simulation);
  selected=c.selected;
  for(const id of configIds) {
    const el=$<HTMLInputElement | HTMLSelectElement>(id);
    if(el instanceof HTMLInputElement && el.type==='checkbox')el.checked=c.controls[id] as boolean;
    else el.value=String(c.controls[id]);
    if(!['columns','rows','resolution'].includes(id)) el.dispatchEvent(new Event(el instanceof HTMLSelectElement || (el instanceof HTMLInputElement && el.type==='checkbox')?'change':'input'));
  }
  simulation.positions.set(c.positions);simulation.previous.set(c.previous);simulation.pistonPositions.set(c.pistons);simulation.overrides.set(c.overrides);simulation.time=c.time;
  scene.leds.phase=c.phase; running=c.running && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  accumulator=0;elapsed=0;last=performance.now();buildGrid();selectPiston(c.selected);updateSurfaceCount();updatePlayback();scene.invalidateFabric();
}
function refreshConfigs(selectedName='') {
  const select=$<HTMLSelectElement>('config-list');select.replaceChildren(new Option('Choose a configuration',''));
  for(const name of Object.keys(library.configs))select.add(new Option(name+(library.defaultName===name?' · startup default':''),name));
  select.value=selectedName;
}
function persist(next:Library) {
  try {localStorage.setItem(CONFIG_KEY,JSON.stringify(next));library=next;return true;}
  catch {status('Could not save in this browser (storage unavailable or full). Export JSON to keep this configuration.');return false;}
}
function saveConfiguration(asDefault:boolean) {
  const typed=$<HTMLInputElement>('config-name').value.trim();
  const name=typed || (asDefault?'Startup default':'');
  if(!name){status('Enter a name for this configuration.');$('config-name').focus();return;}
  const next={defaultName:asDefault?name:library.defaultName,configs:{...library.configs,[name]:captureConfig()}};
  if(persist(next)){refreshConfigs(name);status(`Saved “${name}”${asDefault?' as the startup default':''}.`);}
}
$('config-save').addEventListener('click',()=>saveConfiguration(false));
$('config-default').addEventListener('click',()=>saveConfiguration(true));
$('config-load').addEventListener('click',()=>{
  const name=$<HTMLSelectElement>('config-list').value;
  if(!Object.hasOwn(library.configs,name)){status('Choose a saved configuration first.');return;}
  try{applyConfig(library.configs[name]);$<HTMLInputElement>('config-name').value=name;status(`Loaded “${name}”.`);}catch(e){status((e as Error).message);}
});
$('config-delete').addEventListener('click',()=>{
  const name=$<HTMLSelectElement>('config-list').value;if(!Object.hasOwn(library.configs,name))return;
  const configs={...library.configs};delete configs[name];
  if(persist({configs,defaultName:library.defaultName===name?null:library.defaultName})){refreshConfigs();status(`Deleted “${name}”.`);}
});
$('config-export').addEventListener('click',()=>{
  const url=URL.createObjectURL(new Blob([JSON.stringify(captureConfig())],{type:'application/json'}));
  const a=document.createElement('a');a.href=url;a.download='faraway-landscapes.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);status('Exported the current configuration.');
});
$('config-import').addEventListener('click',()=>$<HTMLInputElement>('config-file').click());
$('config-file').addEventListener('change',async()=>{
  const input=$<HTMLInputElement>('config-file'),file=input.files?.[0];if(!file)return;
  try{if(file.size>2_000_000)throw new Error('Configuration file is too large.');applyConfig(JSON.parse(await file.text()));status('Imported configuration. Save it by name or as your startup default.');}
  catch(e){status(`Import failed: ${(e as Error).message}`);}finally{input.value='';}
});
$('studio-toggle').addEventListener('click',()=>{
  scene.presentation=!scene.presentation;document.body.classList.toggle('presentation',scene.presentation);
  $('studio-toggle').textContent=scene.presentation?'Open studio ↗':'Back to gallery ↗';
  $('studio-toggle').setAttribute('aria-expanded',String(!scene.presentation));
  if(scene.presentation){scene.cloth.visible=true;scene.cloth.material.wireframe=false;scene.setView('gallery');}
  else{scene.cloth.visible=!$<HTMLInputElement>('mechanism').checked;scene.cloth.material.wireframe=$<HTMLInputElement>('wireframe').checked;}
});
try {
  const saved=localStorage.getItem(CONFIG_KEY);
  if(saved){
    const parsed=JSON.parse(saved);
    if(!parsed || typeof parsed.configs!=='object' || Array.isArray(parsed.configs))throw new Error('Invalid configuration library.');
    const configs:Record<string,Configuration>={};
    for(const [name,value] of Object.entries(parsed.configs)){
      try{Object.defineProperty(configs,name,{value:validateConfig(value,rules),enumerable:true,configurable:true,writable:true});}catch{status('Some incompatible saved configurations were skipped.');}
    }
    library={configs,defaultName:typeof parsed.defaultName==='string'&&Object.hasOwn(configs,parsed.defaultName)?parsed.defaultName:null};
    if(library.defaultName){
      const lastPosition=scene.human.position;
      applyConfig(configs[library.defaultName]);
      scene.human.setPosition(lastPosition);
    }
  }
}catch{status('Saved configurations could not be read. You can still use the studio and export JSON.');}
refreshConfigs(library.defaultName??'');
// Presentation always opens with the artwork visible; inspection modes remain saved in studio.
scene.cloth.visible=true;scene.cloth.material.wireframe=false;scene.setView('gallery');


scene.human.onSelect=selected=>{$('human-tools').hidden=!selected;};
scene.human.onStorageError=()=>{$('human-tools').querySelector('span')!.textContent='Position could not be saved locally. Export a configuration to keep it.';};
document.querySelectorAll<HTMLButtonElement>('[data-human-move]').forEach(b=>b.addEventListener('click',()=>scene.human.move(b.dataset.humanMove!,scene.camera)));
$('human-done').addEventListener('click',()=>scene.human.select(false));
