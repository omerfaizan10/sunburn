// Usage: node scripts/screenshot.mjs [url] [outdir]
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const url = process.argv[2] ?? "http://localhost:3101/";
const out = process.argv[3] ?? "../docs/screenshots";
mkdirSync(out, { recursive: true });

const browser = await chromium.launch();
for (const [name, width, height] of [
  ["desktop", 1440, 900],
  ["mobile", 390, 844],
]) {
  const page = await browser.newPage({
    viewport: { width, height },
    deviceScaleFactor: 2,
  });
  const errors = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(url, { waitUntil: "networkidle" });
  await page.waitForTimeout(600);
  // advance the replay to just after the flare peak for the hero shot
  await page.screenshot({ path: `${out}/${name}-top.png` });
  await page.screenshot({ path: `${out}/${name}-full.png`, fullPage: true });
  const sw = await page.evaluate(() => document.documentElement.scrollWidth);
  console.log(
    name,
    "scrollWidth",
    sw,
    "errors",
    errors.length ? errors : "none",
  );
  await page.close();
}
await browser.close();
