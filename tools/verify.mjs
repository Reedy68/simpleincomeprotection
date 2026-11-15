import fs from 'node:fs'; import path from 'node:path';
const PUB = path.resolve(process.argv[2]);
const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
const files = walk(PUB);
const exists = p => { const f = path.join(PUB, decodeURIComponent(p)); return fs.existsSync(f) && (fs.statSync(f).isFile() || fs.existsSync(path.join(f, 'index.html'))); };
const bad = new Map(); let checked = 0, absSame = 0;
const note = (src, ref) => { const k = ref; (bad.get(k) || bad.set(k, new Set()).get(k)).add(src); };
for (const f of files) {
  const rel = path.relative(PUB, f).split(path.sep).join('/');
  const isH = f.endsWith('.html'), isC = f.endsWith('.css');
  if (!isH && !isC) continue;
  const t = fs.readFileSync(f, 'utf8');
  const refs = new Set();
  if (isH) {
    for (const m of t.matchAll(/\b(?<![-w])(?:href|src|action|poster|data-src)=["']([^"'#]+)["']/g)) refs.add(m[1]);
    for (const m of t.matchAll(/\bsrcset=["']([^"']+)["']/g)) m[1].split(',').forEach(s => refs.add(s.trim().split(/\s+/)[0]));
  }
  for (const m of t.matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/g)) refs.add(m[1]);
  for (let r of refs) {
    if (!r || /^(data:|mailto:|tel:|javascript:|https?:|\/\/|about:)/i.test(r)) { if (/^https:\/\/simpleincomeprotection\.co\.uk/.test(r)) absSame++; continue; }
    r = r.split('?')[0].split('#')[0];
    let p;
    if (r.startsWith('/')) p = r;
    else p = '/' + path.posix.normalize(path.posix.join(path.posix.dirname(rel), r));
    checked++;
    if (!exists(p)) note(rel, p);
  }
}
console.log('files', files.length, 'refs checked', checked, 'absolute same-site refs left', absSame, 'unresolved', bad.size);
for (const [k, v] of [...bad].slice(0, 40)) console.log(' MISSING', k, '<-', [...v].slice(0, 3).join(', '));
