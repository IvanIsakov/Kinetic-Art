import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'msedge',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1100}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto('http://127.0.0.1:5173/');
await page.locator('#studio-toggle').click();
await page.waitForFunction(()=>window.__fabricStudy?.metrics.maxZ>.1);
const options=await page.locator('#pattern option').evaluateAll(a=>a.map(o=>o.value));
assert.ok(!options.includes('single')&&!options.includes('alternate'));
for(const pattern of ['circulating','sequential']){
 await page.locator('#pattern').selectOption(pattern);
 await page.waitForTimeout(1200);
 assert.equal(await page.evaluate(()=>window.__fabricStudy.settings.pattern),pattern);
}
await page.getByRole('button',{name:'Pause simulation',exact:true}).click();
const before=await page.evaluate(()=>({p:window.__fabricStudy.pistons,m:window.__fabricStudy.metrics}));
await page.locator('#normal-smoothing').uncheck();
await page.waitForTimeout(100);
assert.equal(await page.evaluate(()=>window.__fabricStudy.smoothShading),false);
await page.screenshot({path:'tmp/qa/normals-original.png'});
await page.locator('#normal-smoothing').check();
await page.waitForTimeout(100);
assert.equal(await page.evaluate(()=>window.__fabricStudy.smoothShading),true);
assert.deepEqual(await page.evaluate(()=>({p:window.__fabricStudy.pistons,m:window.__fabricStudy.metrics})),before);
await page.screenshot({path:'tmp/qa/normals-softened.png'});
assert.deepEqual(errors,[]);
await browser.close();console.log('Pattern and shading browser checks passed');
