/** Renderiza `scripts/marca/setup.html` em `assets/marca/setup.png` (1200×675), com o Chromium do Playwright. */
import { chromium } from "playwright";
import { resolve } from "node:path";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 675 }, deviceScaleFactor: 1 });
await page.goto(`file://${resolve("scripts/marca/setup.html")}`);
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(400);
await page.locator(".card").screenshot({ path: "assets/marca/setup.png" });
await browser.close();
console.log("assets/marca/setup.png");
