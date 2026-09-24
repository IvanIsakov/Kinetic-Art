import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.SITE_URL||'http://127.0.0.1:5173/');await page.waitForFunction(()=>window.__fabricStudy?.rendering.cameraPosition);
 async function check(){const {cameraPosition:p,cameraTarget:t}=await page.evaluate(()=>window.__fabricStudy.rendering);for(const a of [p,t])assert.ok(a.every(Number.isFinite)&&a[0]>=-4.805-1e-8&&a[0]<=4.805+1e-8&&a[1]>=-.81-1e-8&&a[1]<=2.525+1e-8&&a[2]>=-1.055-1e-8,JSON.stringify(a));}
 for(const view of ['gallery','side','front','perspective']){await page.locator(`[data-view="${view}"]`).click();await check();}
 await page.locator('[data-view="gallery"]').click();await page.mouse.move(700,500);await page.mouse.wheel(0,3500);await page.waitForTimeout(300);await check();
 assert.ok((await page.evaluate(()=>window.__fabricStudy.rendering.cameraPosition))[2]>11,'open end permits moving outside front');
 for(const button of ['left','right'])for(const [dx,dy]of [[600,0],[-600,0],[0,400],[0,-400]]){
  for(let i=0;i<3;i++){await page.mouse.move(720,530);await page.mouse.down({button});await page.mouse.move(720+dx,530+dy,{steps:12});await page.mouse.up({button});await check();}
  await page.waitForTimeout(200);await check();
 }
 await page.locator('[data-view="gallery"]').click();await page.mouse.move(700,500);await page.mouse.wheel(0,-5000);await page.waitForTimeout(300);await check();
 assert.deepEqual(errors,[]);console.log('Camera presets, orbit, pan, zoom and damping stay inside solid boundaries; the open end remains passable.');
}finally{await browser.close();}
