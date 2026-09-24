import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
const root=resolve('dist');
const server=createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,'http://localhost');
  if(!url.pathname.startsWith('/Kinetic-Art/'))throw new Error('Wrong base');
  const file=resolve(root,decodeURIComponent(url.pathname.slice('/Kinetic-Art/'.length))||'index.html');
  if(!file.startsWith(root))throw new Error('Outside build');
  const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png'};
  res.setHeader('Content-Type',types[extname(file)]||'application/octet-stream');res.end(await readFile(file));
 }catch{res.statusCode=404;res.end();}
});
await new Promise(r=>server.listen(4175,'127.0.0.1',r));
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
 await page.goto('http://127.0.0.1:4175/Kinetic-Art/');await page.waitForFunction(()=>window.__fabricStudy?.finite);await page.waitForTimeout(600);
 assert.ok(await page.locator('.panel').isHidden());assert.deepEqual(errors,[]);
 console.log('Production build works under /Kinetic-Art/, including the silhouette asset.');
}finally{await browser.close();await new Promise(r=>server.close(r));}
