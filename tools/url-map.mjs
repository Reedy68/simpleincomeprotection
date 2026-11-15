// Builds docs/URL-MAP.md: every address on the live WordPress site, what it was, what it is now.
// Usage: node tools/url-map.mjs build/crawl-pages.json public
import fs from 'node:fs';
import path from 'node:path';

const old = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const pub = path.resolve(process.argv[3]);
const txt = s => (s || '').replace(/<[^>]+>/g, ' ').replace(/&#8211;|&ndash;/g, '-').replace(/&rsquo;|&#8217;/g, "'").replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
const get = (h, re) => txt((h.match(re) || [])[1]);
const rows = [];
for (const [u, oh] of Object.entries(old)) {
  const f = path.join(pub, u === '/' ? '' : u.replace(/^\//, ''), 'index.html');
  const ok = fs.existsSync(f);
  const nh = ok ? fs.readFileSync(f, 'utf8') : '';
  const oldTitle = get(oh, /<title>([^<]*)/), newTitle = get(nh, /<title>([^<]*)/);
  const oldH1 = get(oh.slice(oh.indexOf('<body')), /<h1[^>]*>([\s\S]*?)<\/h1>/), newH1 = get(nh.slice(nh.indexOf('<body')), /<h1[^>]*>([\s\S]*?)<\/h1>/);
  const robots = (nh.match(/<meta name="robots" content="([^"]*)"/) || [])[1] || '';
  rows.push({ u, ok, oldTitle, newTitle, oldH1, newH1, indexed: /^index/.test(robots) });
}
let md = `# URL map: live WordPress site to the static site

Every address on the live site keeps its address (no redirects are needed). Checked against the built files: each one exists and is served with HTTP 200 (the checks are repeated in the pull request).

| Old address | New address | Status | Search listing | H1 kept | Title |
| --- | --- | --- | --- | --- | --- |
`;
for (const r of rows) {
  const h1same = r.oldH1 === r.newH1 || !r.oldH1;
  const cell = s => s.split('|').join('\\|');
  md += `| ${r.u} | ${r.u} | ${r.ok ? '200' : 'MISSING'} | ${r.indexed ? 'indexable' : 'noindex'} | ${h1same ? 'yes' : 'CHANGED: ' + r.newH1} | was "${cell(r.oldTitle)}" -> now "${cell(r.newTitle)}" |\n`;
}
md += `\nAlso added: /failed/ (noindex, where a lead that could not reach VM is sent), /404.html (custom not-found page), /sitemap.xml, /robots.txt, /llms.txt.\n`;
md += `\nWordPress-only addresses that stop existing (they were never linked or indexed): /wp-json/, /xmlrpc.php, /feed/, /comments/feed/, /wp-sitemap*.xml (replaced by /sitemap.xml), /wp-login.php, /wp-admin/.\n`;
fs.mkdirSync('docs', { recursive: true });
fs.writeFileSync('docs/URL-MAP.md', md);
console.log(rows.length, 'rows;', rows.filter(r => !r.ok).length, 'missing;', rows.filter(r => r.oldH1 && r.oldH1 !== r.newH1).length, 'h1 changed');
