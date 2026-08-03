import { chromium } from '/Users/akale/.npm/_npx/9833c18b2d85bc59/node_modules/playwright/index.mjs';

const OUT = '/private/tmp/claude-502/-Users-akale-Sites-awkale-github-io/083f1ca0-a11e-4314-892d-fe3bb6d54d89/scratchpad/shots';
const URL = 'http://localhost:8748/preview/tokens.html';

const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1280, height: 1000 }, deviceScaleFactor: 2 });

for (const mode of ['light', 'dark']) {
  await page.goto(URL, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  await page.click(`[data-mode="${mode}"]`);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(350);
  await page.screenshot({ path: `${OUT}/spec-${mode}.png` });
  console.log(`spec-${mode}.png`);
}

// the density + links section, where the real judging happens
await page.goto(URL, { waitUntil: 'load' });
await page.evaluate(() => document.fonts.ready);
await page.evaluate(() => {
  const el = [...document.querySelectorAll('h2')].find(h => h.textContent.includes('Density'));
  window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 24);
});
await page.waitForTimeout(350);
await page.screenshot({ path: `${OUT}/spec-density.png` });
console.log('spec-density.png');

await browser.close();
