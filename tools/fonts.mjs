// Download the latin + latin-ext woff2 files for the Google fonts the pages use, and write assets-src/fonts-face.css
// Usage: node fonts.mjs   (run once; the files are kept in assets-src/fonts and copied into the site by optimize.mjs)
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const FAMS = 'family=Open+Sans:wght@300..800&family=Poppins:wght@400;500;600;700&family=Inter:wght@400..700&family=Plus+Jakarta+Sans:wght@500..800&family=Nunito:wght@400..800&family=Montserrat:wght@400..900';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
const css = await (await fetch(`https://fonts.googleapis.com/css2?${FAMS}&display=swap`, { headers: { 'user-agent': UA } })).text();
fs.mkdirSync(path.join(HERE, 'assets-src/fonts'), { recursive: true });
let out = '';
for (const m of css.matchAll(/\/\*\s*([\w-]+)\s*\*\/\s*(@font-face\s*\{[^}]*\})/g)) {
  const [, sub, blk] = m; if (!/^latin$/.test(sub)) continue;
  const fam = blk.match(/font-family:\s*'([^']+)/)[1], wt = blk.match(/font-weight:\s*([^;]+)/)[1].trim();
  const url = blk.match(/url\(([^)]+)\)/)[1], ur = blk.match(/unicode-range:\s*([^;]+)/)[1];
  const file = `${fam.toLowerCase().replace(/\s+/g, '')}-${wt.replace(/\s+/g, '-')}-${sub}.woff2`;
  fs.writeFileSync(path.join(HERE, 'assets-src/fonts', file), Buffer.from(await (await fetch(url)).arrayBuffer()));
  out += `@font-face{font-family:"${fam}";font-style:normal;font-weight:${wt};font-display:swap;src:url(/assets/fonts/${file}) format("woff2");unicode-range:${ur}}`;
  console.log(file);
}
fs.writeFileSync(path.join(HERE, 'assets-src/fonts-face.css'), out);
