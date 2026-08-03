import { chromium } from '/Users/akale/.npm/_npx/9833c18b2d85bc59/node_modules/playwright/index.mjs';

const URL = 'http://localhost:8747/awk22-visual-direction.html';
const OUT = '/private/tmp/claude-502/-Users-akale-Sites-awkale-github-io/083f1ca0-a11e-4314-892d-fe3bb6d54d89/scratchpad/shots';

// [variant, mode, anchor (null = top of page), label]
const SHOTS = [
  ['A', 'light', null,         'home'],
  ['A', 'dark',  null,         'home-dark'],
  ['A', 'light', '#concerts',  'concerts'],
  ['A', 'light', '#composers', 'composers'],
  ['B', 'light', null,         'home'],
  ['B', 'light', '#concerts',  'concerts'],
  ['B', 'dark',  '#concerts',  'concerts-dark'],
  ['B', 'light', '#composers', 'composers'],
  ['C', 'light', null,         'home'],
  ['C', 'light', '#concert',   'programme'],
  ['C', 'light', '#concerts',  'concerts'],
  ['C', 'dark',  '#composers', 'composers-dark'],
  ['A', 'light', '.tokenpanel', 'tokens'],
];

const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 },
                                     deviceScaleFactor: 2 });

for (const [variant, mode, anchor, label] of SHOTS) {
  await page.goto(`${URL}?variant=${variant}`, { waitUntil: 'load' });
  await page.evaluate(m => localStorage.setItem('awk22-mode', m), mode);
  await page.reload({ waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);

  // assert we are really on the variant/mode we asked for
  const state = await page.evaluate(() => ({
    v: document.documentElement.getAttribute('data-variant'),
    m: document.documentElement.getAttribute('data-mode'),
    active: document.querySelector('.variant.is-active')?.getAttribute('data-variant-root'),
  }));
  if (state.v !== variant || state.m !== mode || state.active !== variant) {
    throw new Error(`state mismatch: wanted ${variant}/${mode}, got ${JSON.stringify(state)}`);
  }

  let y = 0;
  if (anchor) {
    y = await page.evaluate(sel => {
      const el = document.querySelector('.variant.is-active ' + sel);
      if (!el) throw new Error('missing ' + sel);
      const top = el.getBoundingClientRect().top + window.scrollY;
      window.scrollTo(0, Math.max(0, top - 56));
      return window.scrollY;
    }, anchor);
  } else {
    await page.evaluate(() => window.scrollTo(0, 0));
  }
  await page.waitForTimeout(450); // let the token transition settle

  const file = `${OUT}/${variant}-${label}.png`;
  await page.screenshot({ path: file });
  console.log(`${variant}/${mode} ${anchor ?? 'top'} @y=${y} -> ${file.split('/').pop()}`);
}

await browser.close();
console.log('done');
