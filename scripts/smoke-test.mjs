import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright');

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 900 } });

try {
  await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' });
  await page.fill('input[placeholder="e.g. Yirgacheffe"]', 'Yirgacheffe');
  await page.fill('input[placeholder="e.g. Onyx Coffee Lab"]', 'Sample Roaster');
  await page.fill('input[placeholder="e.g. Ethiopia"]', 'Ethiopia');
  await page.fill('input[placeholder="e.g. floral, citrus, bergamot"]', 'floral, citrus, bergamot');
  await page.selectOption('label:has-text("Roast Level") select', 'light');
  await page.selectOption('label:has-text("Process") select', 'washed');
  await page.click('button:has-text("Continue to Equipment")');
  await page.selectOption('label:has-text("Brew Method") select', 'v60');
  await page.selectOption('label:has-text("Grinder") select', 'baratza_encore');
  await page.click('button:has-text("Generate Recipe")');
  await page.click('button:has-text("Brighter Acidity")');
  await page.click('button:has-text("Show Recipe")');
  await page.waitForSelector('text=Your Recipe');

  const result = await page.evaluate(() => ({
    title: document.querySelector('h1')?.textContent,
    recipeText: document.querySelector('.recipe-card')?.innerText,
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));

  await page.screenshot({ path: 'brew-buddy-smoke.png', fullPage: true });
  console.log(JSON.stringify(result, null, 2));
} finally {
  await browser.close();
}
