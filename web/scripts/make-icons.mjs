// Renders the favicon set and the social share image from SVG with sharp.
// Run from web/: node scripts/make-icons.mjs (reads public/data/results.json).
import fs from "node:fs";
import sharp from "sharp";

const icon = fs.readFileSync("app/icon.svg");
const png = (size, svg = icon) => sharp(svg, { density: 384 }).resize(size, size).png().toBuffer();

// iOS rounds the corners itself, so the touch icon is a full square.
const square = Buffer.from(icon.toString().replace('rx="12"', 'rx="0"'));
await fs.promises.writeFile("app/apple-icon.png", await png(180, square));

// favicon.ico: an ICO container holding PNG-encoded 16, 32 and 48 px images.
const sizes = [16, 32, 48];
const imgs = await Promise.all(sizes.map((s) => png(s)));
const header = Buffer.alloc(6);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(sizes.length, 4);
let offset = 6 + 16 * sizes.length;
const dir = sizes.map((s, i) => {
  const e = Buffer.alloc(16);
  e.writeUInt8(s, 0);
  e.writeUInt8(s, 1);
  e.writeUInt16LE(1, 4);
  e.writeUInt16LE(32, 6);
  e.writeUInt32LE(imgs[i].length, 8);
  e.writeUInt32LE(offset, 12);
  offset += imgs[i].length;
  return e;
});
await fs.promises.writeFile("app/favicon.ico", Buffer.concat([header, ...dir, ...imgs]));

// 1200x630 share card. Numbers come from the evaluation output.
const r = JSON.parse(fs.readFileSync("public/data/results.json", "utf8"));
const flares = r.event_study.n_flares.toLocaleString("en-US");
const spots = (r.coverage.total_spots / 1e9).toFixed(1);
const slope = (r.event_study.dose.slope_per_decade * 100).toFixed(0);
const serif = "Iowan Old Style, Georgia, serif";
const mono = "Menlo, Courier New, monospace";
const og = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
  <rect width="1200" height="630" fill="#f3eee3"/>
  <text x="80" y="88" font-family="${mono}" font-size="21" fill="#47423a">WSPR RECEPTION RECORD × GOES X-RAY FLUX</text>
  <line x1="80" x2="1120" y1="108" y2="108" stroke="#cbc1ad" stroke-width="2"/>
  <text x="80" y="215" font-family="${serif}" font-size="104" font-weight="700" fill="#1c1a17" letter-spacing="4">SUNBURN</text>
  <text x="80" y="278" font-family="${serif}" font-size="33" font-style="italic" fill="#47423a">What a solar flare does to shortwave radio on the</text>
  <text x="80" y="320" font-family="${serif}" font-size="33" font-style="italic" fill="#47423a">day side of the Earth, flare by flare.</text>
  <line x1="80" x2="1120" y1="386" y2="386" stroke="#1c1a17" stroke-width="2"/>
  <line x1="80" x2="1120" y1="392" y2="392" stroke="#1c1a17" stroke-width="2"/>
  <g font-family="${mono}" fill="#1c1a17">
    <text x="80" y="475" font-size="52">${flares}</text>
    <text x="80" y="513" font-size="20" fill="#635c51">M and X flares</text>
    <text x="420" y="475" font-size="52">${spots} bn</text>
    <text x="420" y="513" font-size="20" fill="#635c51">WSPR reception reports</text>
    <text x="800" y="475" font-size="52" fill="#b53b0a">${slope} pts</text>
    <text x="800" y="513" font-size="20" fill="#635c51">more loss per 10x flare flux</text>
  </g>
  <g transform="translate(960 215)">
    <circle cx="-40" cy="0" r="40" fill="#b53b0a"/>
    <path d="M20 -50 A 70 70 0 0 1 20 50" fill="none" stroke="#1c1a17" stroke-width="10" stroke-linecap="round"/>
    <path d="M60 -80 A 110 110 0 0 1 60 80" fill="none" stroke="#1c1a17" stroke-width="10" stroke-linecap="round" stroke-dasharray="22 24"/>
  </g>
  <text x="80" y="585" font-family="${mono}" font-size="20" fill="#635c51">Omer Faizan / omerfaizan.com</text>
</svg>`;
const card = await sharp(Buffer.from(og)).png().toBuffer();
await fs.promises.writeFile("app/opengraph-image.png", card);
await fs.promises.writeFile("app/twitter-image.png", card);
const alt = `Sunburn: ${flares} solar flares measured in ${spots} billion WSPR reception reports.`;
for (const f of ["opengraph-image.alt.txt", "twitter-image.alt.txt"]) fs.writeFileSync(`app/${f}`, alt);
console.log("icons and share image written");
