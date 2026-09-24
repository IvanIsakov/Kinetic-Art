import { chromium } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const config=JSON.parse(await readFile('faraway-landscapes.json','utf8'));
const browser=await chromium.launch({channel:'msedge',headless:true});
try {
 for(const oldLocal of [false,true]){
  const context=await browser.newContext({reducedMotion:'reduce'});
  if(oldLocal)await context.addInitScript(c=>{
   const old=structuredClone(c);old.controls.ambient='90';old.controls.pattern='wave';old.humanPosition=[-2,2];
   localStorage.setItem('faraway-landscapes.configurations.v1',JSON.stringify({defaultName:'Old default',configs:{'Old default':old}}));
   localStorage.setItem('faraway-landscapes.figure-position.v1',JSON.stringify([-2,2]));
  },config);
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(process.env.SITE_URL||'http://127.0.0.1:5173/');await page.waitForFunction(()=>window.__fabricStudy);
  const actual=await page.evaluate(()=>window.__fabricStudy);
  assert.equal(actual.running,false);assert.equal(actual.fabricTime,config.time);assert.equal(actual.leds.phase,config.phase);
  assert.deepEqual(actual.pistons,config.pistons);assert.deepEqual(actual.overrides,config.overrides);
  assert.deepEqual(actual.rendering.humanPosition,config.humanPosition);
  for(const [id,value]of Object.entries(config.controls))assert.equal(await page.locator('#'+id).evaluate(el=>el.type==='checkbox'?el.checked:el.value),value,id);
  assert.ok(await page.locator('.panel').isHidden());assert.deepEqual(errors,[]);
  if(oldLocal){await page.locator('#studio-toggle').click();await page.locator('#config-list').selectOption('Old default');await page.locator('#config-load').click();assert.equal(await page.evaluate(()=>window.__fabricStudy.leds.settings.ambient),.9);await page.locator('#config-published').click();assert.equal(await page.evaluate(()=>window.__fabricStudy.leds.settings.ambient),.04);}
  await context.close();
 }
 console.log('Published JSON restores all controls, pose, phase and placement in fresh and previously configured browsers.');
}finally{await browser.close();}
