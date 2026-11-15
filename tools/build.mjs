// Turn the raw crawl (crawl-pages.json + public/ assets) into the final static site.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = process.argv[2];              // .../build
const PUB = path.join(ROOT, 'public');
const pages = JSON.parse(fs.readFileSync(path.join(ROOT, 'crawl-pages.json'), 'utf8'));
const ORIGIN = 'https://simpleincomeprotection.co.uk';
const OE = 'https:\\/\\/simpleincomeprotection\\.co\\.uk';
const report = { pages: [], changes: {} };
const bump = k => (report.changes[k] = (report.changes[k] || 0) + 1);

const LCP = [];
const LCP_UP = [];

function protect(html) {
  const store = [];
  const keep = s => { store.push(s); return `\u0000KEEP${store.length - 1}\u0000`; };
  html = html.replace(/<meta\b[^>]*>/gi, keep);
  html = html.replace(/<link\b[^>]*rel=["'](?:canonical|shortlink)["'][^>]*>/gi, keep);
  html = html.replace(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi, keep);
  return [html, store];
}
const restore = (html, store) => html.replace(/\u0000KEEP(\d+)\u0000/g, (_, i) => store[+i]);

// Cloudflare's "email address obfuscation" rewrote emails when the crawler fetched the live pages: decode them back
const cfDecode = hex => { const k = parseInt(hex.slice(0, 2), 16); let o = ''; for (let i = 2; i < hex.length; i += 2) o += String.fromCharCode(parseInt(hex.slice(i, i + 2), 16) ^ k); return o; };
function transform(url, html) {
  const orig = html;
  html = html.replace(/<a href="\/cdn-cgi\/l\/email-protection"([^>]*?)data-cfemail="([0-9a-f]+)"([^>]*)>\[email&#160;protected\]<\/a>/g, (m, a, hex) => { const e = cfDecode(hex); bump('emails decoded'); return '<a href="mailto:' + e + '">' + e + '</a>'; });
  html = html.replace(/<span class="__cf_email__"([^>]*?)data-cfemail="([0-9a-f]+)"([^>]*)>\[email&#160;protected\]<\/span>/g, (m, a, hex) => { bump('emails decoded'); return cfDecode(hex); });
  html = html.replace(/<script[^>]*\/cdn-cgi\/scripts\/[^>]*><\/script>/g, '');
  // 1. per-visitor values that WordPress rendered into the page at crawl time (IP and browser of whoever fetched it)
  html = html.replace(/(<input[^>]*name="vmform_ip"[^>]*value=")[^"]*(")/g, (m, a, b) => { bump('vmform_ip blanked'); return a + b; });
  html = html.replace(/(<input[^>]*name="vmform_useragent"[^>]*value=")[^"]*(")/g, (m, a, b) => { bump('vmform_useragent blanked'); return a + b; });

  // 2. WordPress-only head links that point at endpoints that do not exist on a static site
  const before = html.length;
  html = html
    .replace(/<link[^>]+rel=["']https:\/\/api\.w\.org\/["'][^>]*>\s*/g, '')
    .replace(/<link[^>]+(?:wp-json|xmlrpc\.php\?rsd|rel=["']EditURI["'])[^>]*>\s*/g, '')
    .replace(/<link[^>]+type=["']application\/rss\+xml["'][^>]*>\s*/g, '')
    .replace(/<link[^>]+rel=["']pingback["'][^>]*>\s*/g, '')
    .replace(/<link[^>]+rel=["']shortlink["'][^>]*>\s*/g, '')
    .replace(/<meta[^>]+name=["']generator["'][^>]*>\s*/g, '');
  if (html.length !== before) bump('wordpress head links removed');

  // 3. localise hot-linked images
  for (const [src, dst] of LCP) {
    const esc = src.replace(/\//g, '\\/');
    html = html.split(esc).join(dst.replace(/\//g, '\\/'));
    html = html.split(src).join(dst);
  }
  
  // 4. same-site absolute URLs -> root-relative (so every link, script and style works on any host, incl. previews)
  let store;
  [html, store] = protect(html);
  html = html.replace(/\b(href|src|action|poster|data-src|data-lazy-src|data-bg|data-background)=("|')https:\/\/simpleincomeprotection\.co\.uk\//g, '$1=$2/');
  html = html.replace(/\bsrcset=("|')([^"']+)\1/g, (m, q, v) => `srcset=${q}${v.split(ORIGIN + '/').join('/')}${q}`);
  html = html.replace(/url\((["']?)https:\/\/simpleincomeprotection\.co\.uk\//g, 'url($1/');
  html = html.replace(/https:\/\/simpleincomeprotection\.co\.uk\/(wp-content|wp-includes)\//g, '/$1/');
  html = html.replace(new RegExp(OE + '\\\\\\/(wp-content|wp-includes)\\\\\\/', 'g'), '\\/$1\\/');
  html = restore(html, store);

  // 5. carry Google Ads vv* parameters into the form's hidden tracking fields (WordPress did this server-side)
  if (/id="vmform"/.test(html)) {
    html = html.replace('</head>', '<script defer src="/assets/js/vv-tracking.js"></script>\n</head>');
    bump('vv-tracking.js added to form pages');
  }
  return html;
}

// ---- write every page
for (const [url, raw] of Object.entries(pages)) {
  const out = transform(url, raw);
  const rel = (url === '/' ? '' : url.replace(/^\//, '')) + 'index.html';
  const f = path.join(PUB, rel);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, out);
  report.pages.push({ url, file: rel, bytes: out.length, form: /id="vmform"/.test(out) });
}

// ---- /failed/ and 404.html: built from the About Us page shell, no conversion pixel, noindex
function shell(title, heading, bodyHtml) {
  let h = fs.readFileSync(path.join(PUB, 'privacy-policy/index.html'), 'utf8');
  h = h.replace(/<title>[^<]*<\/title>/, `<title>${title} &#8211; Simple Income Protection</title>`);
  h = h.replace(/<link rel="canonical"[^>]*>/, '');
  h = h.replace(/<meta name='robots'[^>]*>/, "<meta name='robots' content='noindex, nofollow' />");
  const i = h.indexOf('<main'), j = h.indexOf('</main>') + 7;
  const main = `<main class="site-main" id="main"><article class="page type-page status-publish"><div class="inside-article"><header class="entry-header"><h1 class="entry-title" itemprop="headline">${heading}</h1></header><div class="entry-content" itemprop="text">${bodyHtml}</div></div></article></main>`;
  return h.slice(0, i) + main + h.slice(j);
}
fs.mkdirSync(path.join(PUB, 'failed'), { recursive: true });
fs.writeFileSync(path.join(PUB, 'failed/index.html'), shell('Something went wrong', 'Sorry, we could not send your details',
  '<p>Something went wrong while sending your details, so we may not have them yet. Please try the <a href="/income-protection/get-quote/">quote form</a> again in a few minutes,.</p>'));
fs.writeFileSync(path.join(PUB, '404.html'), shell('Page not found', 'Page not found',
  '<p>We could not find that page. You can start again from the <a href="/">home page</a> or go straight to the <a href="/income-protection/get-quote/">quote form</a>.</p>'));

// ---- small root files
fs.copyFileSync(path.join(HERE, 'assets-src', 'vv-tracking.js'), (fs.mkdirSync(path.join(PUB, 'assets/js'), { recursive: true }), path.join(PUB, 'assets/js/vv-tracking.js')));
fs.writeFileSync(path.join(PUB, '_redirects'), '');
fs.writeFileSync(path.join(PUB, '_headers'),
  '/wp-content/*\n  Cache-Control: public, max-age=31536000, immutable\n/wp-includes/*\n  Cache-Control: public, max-age=31536000, immutable\n/assets/*\n  Cache-Control: public, max-age=86400\n/failed/*\n  X-Robots-Tag: noindex\n');
const today = new Date().toISOString().slice(0, 10);
const urls = Object.keys(pages).map(u => `  <url><loc>${ORIGIN}${u}</loc><lastmod>${today}</lastmod></url>`).join('\n');
fs.writeFileSync(path.join(PUB, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`);

fs.writeFileSync(path.join(ROOT, 'build-report.json'), JSON.stringify(report, null, 1));
console.log(report.changes, report.pages.length, 'pages');
