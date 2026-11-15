// Mirror equityadvisor.co.uk into a static folder. Same-origin only. Pages -> dir/index.html, assets keep their path.
import fs from 'node:fs';
import path from 'node:path';

const ORIGIN = 'https://simpleincomeprotection.co.uk';
const OUT = process.argv[2];
const UA = 'Mozilla/5.0 (static-mirror)';
const seenAssets = new Set();
const log = [];
const missing = [];

const sleep = ms => new Promise(r => setTimeout(r, ms));
async function get(url, tries = 3) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { headers: { 'user-agent': UA }, redirect: 'follow' });
      return r;
    } catch (e) { await sleep(500 * (i + 1)); }
  }
  return null;
}
function save(rel, buf) {
  const f = path.join(OUT, rel);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, buf);
}
function toRel(u, base) {
  try {
    const x = new URL(u, base);
    if (x.origin !== ORIGIN && x.origin !== ORIGIN.replace('https://', 'https://www.')) return null;
    return x;
  } catch { return null; }
}
async function fetchAsset(x) {
  const key = x.pathname;
  if (seenAssets.has(key)) return;
  seenAssets.add(key);
  const r = await get(ORIGIN + x.pathname + (x.search && /\.(js|css)$/.test(x.pathname) ? '' : ''));
  if (!r || !r.ok) { missing.push(key + ' ' + (r && r.status)); return; }
  const buf = Buffer.from(await r.arrayBuffer());
  const rel = decodeURIComponent(x.pathname).replace(/^\//, '');
  save(rel, buf);
  const ct = r.headers.get('content-type') || '';
  if (/css/.test(ct) || /\.css$/.test(x.pathname)) {
    const css = buf.toString('utf8');
    for (const m of css.matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/g)) {
      if (m[1].startsWith('data:')) continue;
      const y = toRel(m[1], ORIGIN + x.pathname);
      if (y) await fetchAsset(y);
    }
    for (const m of css.matchAll(/@import\s+['"]([^'"]+)['"]/g)) {
      const y = toRel(m[1], ORIGIN + x.pathname);
      if (y) await fetchAsset(y);
    }
  }
}

function extractRefs(html) {
  const refs = new Set();
  for (const m of html.matchAll(/\b(?:src|href|data-src|data-lazy-src|poster|content|data-bg|data-background)\s*=\s*["']([^"']+)["']/gi)) refs.add(m[1]);
  for (const m of html.matchAll(/\bsrcset\s*=\s*["']([^"']+)["']/gi)) for (const p of m[1].split(',')) refs.add(p.trim().split(/\s+/)[0]);
  for (const m of html.matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/g)) refs.add(m[1]);
  // escaped urls inside inline JSON / JS: https:\/\/equityadvisor.co.uk\/wp-content\/...
  for (const m of html.matchAll(/https?:\\?\/\\?\/equityadvisor\.co\.uk(\\?\/[^"'\s<>)\\]+(?:\\\/[^"'\s<>)\\]+)*)/g)) refs.add('https://simpleincomeprotection.co.uk' + m[1].replace(/\\\//g, '/'));
  return [...refs];
}

const pages = JSON.parse(fs.readFileSync(process.argv[3], 'utf8'));
const extraPages = ['/404-test-page-does-not-exist/'];
const pageHtml = {};
for (const p of pages) {
  const r = await get(ORIGIN + p);
  if (!r) { missing.push('PAGE ' + p + ' fetch failed'); continue; }
  const finalUrl = new URL(r.url);
  const html = await r.text();
  log.push({ page: p, status: r.status, final: finalUrl.pathname + finalUrl.search, bytes: html.length });
  if (r.status !== 200) continue;
  pageHtml[p] = html;
  for (const ref of extractRefs(html)) {
    const x = toRel(ref, ORIGIN + p);
    if (!x) continue;
    if (/\.(css|js|png|jpe?g|gif|svg|webp|avif|ico|woff2?|ttf|eot|otf|mp4|webm|pdf|json|xml|txt)$/i.test(x.pathname) && x.pathname.startsWith('/wp-')) await fetchAsset(x);
    else if (/\.(css|js|png|jpe?g|gif|svg|webp|avif|ico|woff2?|ttf|eot|otf|mp4|webm|pdf)$/i.test(x.pathname)) await fetchAsset(x);
  }
}
fs.writeFileSync(path.join(OUT, '..', 'crawl-pages.json'), JSON.stringify(pageHtml));
fs.writeFileSync(path.join(OUT, '..', 'crawl-log.json'), JSON.stringify({ log, missing, assets: [...seenAssets] }, null, 1));
console.log('pages', Object.keys(pageHtml).length, 'assets', seenAssets.size, 'missing', missing.length);
console.log(missing.slice(0, 30).join('\n'));
console.log(log.filter(l => l.status !== 200 || l.final !== l.page).map(l => JSON.stringify(l)).join('\n'));
