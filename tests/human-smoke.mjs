import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'msedge',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1000}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto('http://127.0.0.1:5173/');await page.waitForFunction(()=>window.__fabricStudy);await page.waitForTimeout(1000);
await page.getByRole('button',{name:'Pause simulation',exact:true}).click();
await page.screenshot({path:'tmp/qa/stencil-gallery.png'});
const before=await page.evaluate(()=>window.__fabricStudy.rendering.humanPosition);
const [x,y]=await page.evaluate(()=>window.__fabricStudy.rendering.humanScreen);
const box=await page.locator('#viewport canvas').boundingBox();
await page.mouse.click(box.x+(x+1)/2*box.width,box.y+(1-y)/2*box.height);
await page.waitForFunction(()=>window.__fabricStudy.rendering.humanSelected);
await page.keyboard.press('ArrowRight');await page.keyboard.press('ArrowUp');
const moved=await page.evaluate(()=>window.__fabricStudy.rendering.humanPosition);assert.notDeepEqual(moved,before);
await page.keyboard.press('Escape');await page.keyboard.press('ArrowRight');assert.deepEqual(await page.evaluate(()=>window.__fabricStudy.rendering.humanPosition),moved);
await page.reload();await page.waitForFunction(()=>window.__fabricStudy);assert.deepEqual(await page.evaluate(()=>window.__fabricStudy.rendering.humanPosition),moved);
await page.locator('#studio-toggle').click();await page.getByRole('button',{name:'Lighting',exact:true}).click();
await page.locator('#led-enabled').uncheck();
for(const ambient of ['0','12','100']) {
 await page.locator('#ambient').fill(ambient);await page.locator('#ambient').dispatchEvent('input');await page.waitForTimeout(150);
 await page.screenshot({path:`tmp/qa/ambient-${ambient}.png`});
}
await page.locator('#config-name').fill('Silhouette placement');await page.locator('#config-default').click();
await page.reload();await page.waitForFunction(()=>window.__fabricStudy);assert.deepEqual(await page.evaluate(()=>window.__fabricStudy.rendering.humanPosition),moved);
assert.deepEqual(errors,[]);await browser.close();console.log('Human alpha picking, arrows, deselection, position persistence and ambient browser checks passed');
