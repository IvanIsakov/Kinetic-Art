import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'msedge',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1100}});
const errors=[]; page.on('pageerror',e=>errors.push(e.message));
await page.goto('http://127.0.0.1:5173/');
await page.locator('#studio-toggle').click();
await page.waitForFunction(()=>window.__fabricStudy);
await page.getByRole('button',{name:'Pause simulation',exact:true}).click();
await page.getByRole('button',{name:'Lighting',exact:true}).click();
const base=await page.evaluate(()=>window.__fabricStudy.rendering.leds.lightPositions);
for(const offset of [50,1500,400,370]) {
 await page.locator('#led-depth').fill(String(offset)); await page.locator('#led-depth').dispatchEvent('input');
 await page.waitForFunction(v=>Math.abs(window.__fabricStudy.rendering.leds.railDepth-v)<1e-8,offset/1000);
 const state=await page.evaluate(()=>window.__fabricStudy.rendering.leds);
 assert.ok(Math.abs(state.emitterDepth-offset/1000)<1e-8);
 state.lightPositions.forEach((p,i)=>assert.ok(Math.abs(p[2]-base[i][2]-(offset/1000-.37))<1e-8));
}
await page.locator('#led-pattern').selectOption('rainbow-chase');
assert.ok(await page.locator('#led-color').isDisabled());
await page.locator('#led-depth').fill('400'); await page.locator('#led-depth').dispatchEvent('input');
await page.waitForTimeout(200);
await page.screenshot({path:'tmp/qa/depth-rainbow-panel.png'});
await page.locator('#led-count').fill('120');await page.locator('#led-count').dispatchEvent('input');
await page.waitForFunction(()=>window.__fabricStudy.rendering.leds.emitters===120);
assert.equal(await page.evaluate(()=>window.__fabricStudy.rendering.leds.emitterDepth),.4);
assert.deepEqual(errors,[]);await browser.close();console.log('Panel distance and rainbow chase browser checks passed');

