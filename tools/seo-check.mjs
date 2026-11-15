// Checks every page: title/description length, robots, canonical, JSON-LD validity, banned words in meta
import fs from 'node:fs'; import path from 'node:path';
const root = path.resolve(process.argv[2]);
const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
const files = walk(root).filter(f => /index\.html$|404\.html$/.test(f) && !/wp-(content|includes)/.test(f));
const banned = /\b(best|top|guarantee[d]?|calculator|cheap|adviser|advice)\b/i;
let problems = 0; const titles = new Map();
for (const f of files.sort()) {
  const rel = path.relative(root, f).split(path.sep).join('/');
  const h = fs.readFileSync(f, 'utf8');
  const title = (h.match(/<title>([^<]*)<\/title>/) || [])[1] || '';
  const desc = (h.match(/<meta name="description" content="([^"]*)"/) || [])[1];
  const robots = (h.match(/<meta name="robots" content="([^"]*)"/) || [])[1];
  const canon = (h.match(/<link rel="canonical" href="([^"]*)"/) || [])[1];
  const ld = [...h.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
  let types = '';
  for (const m of ld) { try { const j = JSON.parse(m[1]); types = (j['@graph'] || [j]).map(x => [].concat(x['@type']).join('/')).join(', '); } catch (e) { console.log('BAD JSON-LD', rel, e.message); problems++; } }
  const idx = robots && /^index/.test(robots);
  if (idx) {
    const flags = [];
    if (title.length > 60) flags.push('title ' + title.length);
    if (!desc) flags.push('no description'); else if (desc.length > 160 || desc.length < 70) flags.push('desc ' + desc.length);
    if (banned.test(title.replace(/\| Simple Income Protection/, '')) || (desc && banned.test(desc))) flags.push('banned word in meta: ' + (title + ' ' + desc).match(banned)[0]);
    if (!canon) flags.push('no canonical');
    if (!ld.length) flags.push('no schema');
    if (titles.has(title)) flags.push('duplicate title of ' + titles.get(title)); else titles.set(title, rel);
    console.log((flags.length ? 'FLAG ' : 'ok   ') + rel.padEnd(34) + ` | title ${title.length} desc ${desc ? desc.length : '-'} | ${robots} | ${types}` + (flags.length ? ' | ' + flags.join('; ') : ''));
    problems += flags.length;
  }
}
const noidx = files.filter(f => { const h = fs.readFileSync(f, 'utf8'); return /name="robots" content="noindex/.test(h); }).length;
console.log(`indexable pages listed above; noindex pages: ${noidx}; problems: ${problems}`);
