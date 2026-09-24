import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';

await mkdir('tmp/qa', { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1150 } });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('http://127.0.0.1:5173/');
await page.locator('#studio-toggle').click();
  await page.waitForFunction(() => window.__fabricStudy?.pistons[7] > .1);
  await page.getByRole('button', { name: 'Pause simulation', exact: true }).click();
  const before = await page.evaluate(() => ({ time: window.__fabricStudy.fabricTime, pistons: window.__fabricStudy.pistons, phase: window.__fabricStudy.leds.phase }));
  const memory = await page.evaluate(() => window.__fabricStudy.rendering.geometries);
  for (const [resolution, count] of [[36, 1036], [48, 1813], [60, 2806], [96, 7081], [72, 4015]]) {
    await page.locator('#resolution').selectOption(String(resolution));
    const state = await page.evaluate(() => window.__fabricStudy);
    assert.equal(state.metrics.vertices, count);
    assert.equal(state.rendering.surfaceVertices, count);
    assert.equal(state.rendering.uvVertices, count);
    assert.deepEqual(state.pistons, before.pistons);
    assert.equal(state.fabricTime, before.time); assert.equal(state.leds.phase, before.phase);
  }
  await page.locator('#resolution').selectOption('36');
  await page.locator('#columns').selectOption('10'); await page.locator('#rows').selectOption('10');
  assert.equal(await page.evaluate(() => window.__fabricStudy.metrics.vertices), 1036);
  await page.getByRole('button', { name: 'Lighting', exact: true }).click();
  for (const count of [12, 120, 67, 60]) {
    await page.locator('#led-count').fill(String(count)); await page.locator('#led-count').dispatchEvent('input');
    await page.waitForFunction(c => window.__fabricStudy.rendering.leds.emitters === c, count);
    assert.equal(await page.locator('#led-strip span').count(), count);
    assert.equal(await page.evaluate(() => window.__fabricStudy.leds.samples.length), count);
    assert.equal(await page.evaluate(() => window.__fabricStudy.leds.phase), before.phase);
  }
  // GPU geometry count should remain bounded after resolution/count rebuilds.
  await page.waitForTimeout(100);
  assert.equal(await page.evaluate(() => window.__fabricStudy.rendering.geometries), memory);
  await page.locator('#led-pattern').selectOption('chase');
  await page.locator('#led-period').fill('4'); await page.locator('#led-period').dispatchEvent('input');
  await page.locator('#led-color').fill('#ff7040'); await page.locator('#led-color').dispatchEvent('input');
  await page.getByRole('button', { name: 'Fabric', exact: true }).click();
  await page.locator('#fabric-playing').uncheck();
  await page.getByRole('button', { name: 'Play simulation', exact: true }).click();
  const frozen = await page.evaluate(() => ({ pistons: window.__fabricStudy.pistons, time: window.__fabricStudy.fabricTime, phase: window.__fabricStudy.leds.phase }));
  await page.waitForTimeout(300);
  const movingLight = await page.evaluate(() => window.__fabricStudy);
  assert.deepEqual(movingLight.pistons, frozen.pistons);
  assert.equal(movingLight.fabricTime, frozen.time); assert.notEqual(movingLight.leds.phase, frozen.phase);
  await page.getByRole('button', { name: 'Lighting', exact: true }).click();
  await page.locator('#led-playing').uncheck();
  const frozenPhase = await page.evaluate(() => window.__fabricStudy.leds.phase);
  await page.getByRole('button', { name: 'Fabric', exact: true }).click();
  await page.locator('#fabric-playing').check();
  await page.waitForTimeout(300);
  assert.equal(await page.evaluate(() => window.__fabricStudy.leds.phase), frozenPhase);
  assert.notDeepEqual(await page.evaluate(() => window.__fabricStudy.pistons), frozen.pistons);
  await page.getByRole('button', { name: 'Lighting', exact: true }).click();
  await page.locator('#led-shadows').uncheck();
  await page.waitForFunction(() => window.__fabricStudy.rendering.leds.shadowSources === 0);
  await page.locator('#led-shadows').check();
  await page.waitForFunction(() => window.__fabricStudy.rendering.leds.shadowSources === 4);
  // Compare the fabric pixels while geometry and camera are frozen; LED off must
  // change illumination in the middle of the cloth, not only emitter colors.
  await page.getByRole('button', { name: 'Pause simulation', exact: true }).click();
  await page.locator('#ambient').fill('0'); await page.locator('#ambient').dispatchEvent('input');
  await page.locator('#led-pattern').selectOption('steady');
  await page.waitForTimeout(150);
  const canvas = await page.locator('canvas').boundingBox();
  const clip = { x: canvas.x + canvas.width * .4, y: canvas.y + canvas.height * .4, width: 120, height: 120 };
  const lit = await page.screenshot({ clip });
  await page.locator('#led-enabled').uncheck();
  await page.waitForFunction(() => window.__fabricStudy.rendering.leds.totalIntensity === 0);
  const dark = await page.screenshot({ clip });
  assert.ok(!lit.equals(dark), 'LEDs should illuminate the fabric itself');
  await page.locator('#led-enabled').check();
  await page.locator('#led-pattern').selectOption('spectrum');
  await page.locator('#ambient').fill('12'); await page.locator('#ambient').dispatchEvent('input');
  await page.locator('#led-playing').check();
  await page.getByRole('button', { name: 'Play simulation', exact: true }).click();
  await page.screenshot({ path: 'tmp/qa/lighting-controls.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'tmp/qa/lighting-mobile.png', fullPage: true });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  assert.ok(await page.evaluate(() => window.__fabricStudy.finite));
  assert.deepEqual(errors, []);
  console.log('Lighting/mesh smoke passed: all five resolutions, pose preservation, 12–120 LEDs, independent playback, shadow toggle, visible fabric illumination, cleanup and mobile layout.');
} finally { await browser.close(); }
