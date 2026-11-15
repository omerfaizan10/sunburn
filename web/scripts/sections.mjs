// Screenshot each <section> separately. Usage: node scripts/sections.mjs url outdir width
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const url = process.argv[2];
const out = process.argv[3];
const width = Number(process.argv[4] ?? 1440);
mkdirSync(out, { recursive: true });
const b = await chromium.launch();
const p = await b.newPage({
  viewport: { width, height: 900 },
  deviceScaleFactor: 1.5,
});
await p.goto(url, { waitUntil: "networkidle" });
const secs = await p.$$("section");
for (let i = 0; i < secs.length; i++)
  await secs[i].screenshot({ path: `${out}/w${width}-s${i}.png` });
await b.close();
