// Optimise the mirrored simpleincomeprotection.co.uk site using the simplelifecover.com model:
//   fast (fonts self-hosted, one small stylesheet, deferred scripts, no WordPress/Site Kit/Complianz weight),
//   consent via CookieConsent + Google Consent Mode v2, per-page meta + Open Graph + JSON-LD schema, sitemap, llms.txt.
// Usage: node optimize.mjs <pristine-mirror-dir> <output public dir>
// The pristine mirror is the output of crawl.mjs + build.mjs (pages as WordPress rendered them, links made relative).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(process.argv[2]);
const OUT = path.resolve(process.argv[3]);
const ORIGIN = 'https://simpleincomeprotection.co.uk';
const TODAY = new Date().toISOString().slice(0, 10);
const BRAND = 'Simple Income Protection';
const GTM = 'GTM-P2MH4BCL';
const rd = (p, base = SRC) => fs.readFileSync(path.join(base, p), 'utf8');
const wr = (p, data) => { const f = path.join(OUT, p); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, data); };
const hash = s => crypto.createHash('sha1').update(s).digest('hex').slice(0, 10);
const esc = s => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const log = [];
// The WordPress pages hot-linked some images from an OLD, now parked site (lifecoverplus.com, which answers every request with a
// redirect page, so those images were already broken on the live WordPress site). Nothing here may depend on it: use the site's own
// copy of the same file when there is one, otherwise a 1x1 transparent PNG.
const BLANK = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');
let ownImages = new Map();
const legacy = t => t
  .replace(/https:\/\/lifecoverplus\.com\/wp-content\/uploads\/([^"')\s\\]+)/g, (m, rel) => ownImages.get(path.basename(rel)) || '/assets/img/blank.png')
  .replace(/\/wp-content\/uploads\/lifecoverplus\/([^"')\s\\]+)/g, (m, rel) => ownImages.get(path.basename(rel)) || '/assets/img/blank.png');

// ---------------------------------------------------------------- start from the pristine copy
fs.cpSync(SRC, OUT, { recursive: true, force: true });
fs.rmSync(path.join(OUT, 'wp-content/uploads/lifecoverplus'), { recursive: true, force: true });
fs.mkdirSync(path.join(OUT, 'assets/img'), { recursive: true });
fs.writeFileSync(path.join(OUT, 'assets/img/blank.png'), BLANK);
for (const f of walk0(OUT)) {                       // image files that are really HTML error pages (copied from the parked site): replace with the blank PNG
  if (/\.(png|jpe?g|gif|webp)$/i.test(f) && fs.statSync(f).size < 400 && fs.readFileSync(f, 'utf8').trimStart().startsWith('<')) fs.writeFileSync(f, BLANK);
}
for (const f of walk0(path.join(OUT, 'wp-content/uploads'))) if (/\.(png|jpe?g|gif|webp|svg)$/i.test(f) && fs.statSync(f).size > 400) ownImages.set(path.basename(f), '/' + path.relative(OUT, f).split(path.sep).join('/'));
// ---------------------------------------------------------------- CSS helpers
function minCss(css) {
  const strs = [];
  css = css.replace(/("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g, m => { strs.push(m); return `\u0001${strs.length - 1}\u0001`; });
  css = css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ')
    .replace(/\s*([{};,>])\s*/g, '$1').replace(/:\s+/g, ':').replace(/;}/g, '}').trim();
  return css.replace(/\u0001(\d+)\u0001/g, (_, i) => strs[+i]);
}
// make relative url() references absolute (root-relative) so a bundle can live anywhere
function absUrls(css, srcUrlDir) {
  return css.replace(/url\(\s*(["']?)([^"')]+)\1\s*\)/g, (m, q, u) => {
    if (/^(data:|https?:|\/\/|\/|#)/i.test(u)) return m;
    return `url(${path.posix.normalize(path.posix.join(srcUrlDir, u))})`;
  });
}
// split into top-level blocks (handles @media / @keyframes nesting)
function blocks(css) {
  const out = []; let depth = 0, start = 0;
  for (let i = 0; i < css.length; i++) {
    const c = css[i];
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) { out.push(css.slice(start, i + 1)); start = i + 1; } }
    else if (c === ';' && depth === 0) { out.push(css.slice(start, i + 1)); start = i + 1; }
  }
  if (css.slice(start).trim()) out.push(css.slice(start));
  return out;
}
function walk0(d) { return fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk0(path.join(d, e.name)) : [path.join(d, e.name)]); }
const readCss = (urlPath) => rd(urlPath.replace(/^\//, ''));

// ---------------------------------------------------------------- source page list
const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
const pageFiles = walk(SRC).map(f => path.relative(SRC, f).split(path.sep).join('/'))
  .filter(f => f.endsWith('.html') && !f.startsWith('wp-') && f !== '404.html' && f !== 'failed/index.html');

// ---------------------------------------------------------------- what is used (drives the CSS subsets)
const allHtml = pageFiles.map(f => rd(f)).join('\n');
const usedFa = new Set([...allHtml.matchAll(/class=["']([^"']*)["']/g)].flatMap(m => m[1].split(/\s+/)).filter(c => /^fa-/.test(c)));
const formJs = rd('wp-content/plugins/vmforms/public/js/public.js') + fs.readFileSync(path.join(HERE, 'assets-src/vmforms-public.js'), 'utf8');
const usedDash = new Set([...(allHtml + formJs).matchAll(/dashicons-([a-z0-9-]+)/g)].map(m => m[1]));
const usedHvr = new Set([...allHtml.matchAll(/hvr-[a-z0-9-]+/g)].map(m => m[0]));

// ---------------------------------------------------------------- BASE stylesheet (every page)
let base = '';
base += readCss('/wp-content/themes/generatepress/assets/css/components/widget-areas.min.css');
base += readCss('/wp-content/themes/generatepress/assets/css/main.min.css');
base += readCss('/wp-content/themes/generatepress_child/style.css');
base = absUrls(base, '/wp-content/themes/generatepress/assets/css/');
// Font Awesome 5: only the icons the pages use, woff2 only
if (false) {   // Font Awesome was only used by the removed Complianz banner (checked: no fa- class left in any page)
  {
  const faCss = readCss('/wp-content/plugins/bb-plugin/fonts/fontawesome/5.15.4/css/all.min.css');
  const keep = [];
  for (const b of blocks(faCss)) {
    if (/^@font-face/.test(b)) {
      const fam = (b.match(/font-family:\s*["']?([^;"']+)/) || [])[1];
      const w = (b.match(/font-weight:\s*(\d+)/) || [])[1];
      if (w === '400' && /Brands/i.test(fam)) continue;                 // brand icons are not used
      const f = w === '900' ? 'fa-solid-900' : 'fa-regular-400';
      keep.push(`@font-face{font-family:"Font Awesome 5 Free";font-style:normal;font-weight:${w};font-display:swap;src:url(/wp-content/plugins/bb-plugin/fonts/fontawesome/5.15.4/webfonts/${f}.woff2) format("woff2")}`);
    } else if (/^\.fa-[a-z0-9-]+:before\{/.test(b)) {
      const name = b.match(/^\.(fa-[a-z0-9-]+):before/)[1];
      if (usedFa.has(name)) keep.push(b);
    } else if (/^\.(fa|fas|far|fab|fal),|^\.fa[a-z]*(,|\{)|^\.fa-w-|^\.fa-fw|^\.fa-lg|^@-webkit-keyframes|^@keyframes/.test(b) || /^\.fa,/.test(b)) {
      if (!/fa-w-/.test(b) || [...usedFa].some(c => /^fa-w-/.test(c) && b.includes('.' + c))) keep.push(b);
    }
  }
  base += keep.join('');
  }
}
// footer "Manage cookies" button (replaces Complianz's floating button): styled like the footer links
base += '.sip .links .sip-cc-link{background:none;border:0;padding:0;margin:0;font:inherit;color:inherit;cursor:pointer;text-decoration:inherit}.sip .links .sip-cc-link:hover{text-decoration:underline}.sip-bc{font:500 14px/1.4 Inter,system-ui,sans-serif;color:#4a5a6a;margin:0 0 18px}.sip-bc a{color:#1b4fa3}.sip-bc span{margin:0 6px}';
base += '.copyright-bar .ea-cc-link{background:none;border:0;padding:0;margin:0;font:inherit;color:inherit;text-decoration:underline;cursor:pointer}.ea-links .ea-cc-link{background:none;border:0;padding:0;margin:0;font:inherit;color:#fff;text-decoration:none;cursor:pointer}.ea-links .ea-cc-link:hover{text-decoration:underline}';
base = minCss(base);
const baseName = `assets/css/base-${hash(base)}.css`;
wr(baseName, base);

// ---------------------------------------------------------------- FORM stylesheet (form pages only)
let form = '';
form += absUrls(readCss('/wp-content/plugins/vmforms/admin/form/dist/form.css'), '/wp-content/plugins/vmforms/admin/form/dist/');
form += absUrls(readCss('/wp-content/plugins/vmforms/public/static/tippedjs/css/tipped.css'), '/wp-content/plugins/vmforms/public/static/tippedjs/css/');
{ // hover.css: keep only the effects the forms use (plus their keyframes)
  const hv = readCss('/wp-content/plugins/vmforms/public/static/hover/hover.css');
  form += blocks(hv).filter(b => [...usedHvr].some(n => new RegExp(`\\.${n}(?![a-z0-9-])|keyframes\\s+${n}(?![a-z0-9-])`).test(b))).join('');
}
form += absUrls(readCss('/wp-content/plugins/vmforms/public/static/spinkit/spinkit.css'), '/wp-content/plugins/vmforms/public/static/spinkit/');
form += absUrls(readCss('/wp-content/plugins/vmforms/public/static/modaal/css/modaal.css'), '/wp-content/plugins/vmforms/public/static/modaal/css/');
form += readCss('/wp-content/plugins/vmforms/public/css/thin.css');
{ // dashicons: only the icons the form uses; ttf only
  const dc = readCss('/wp-includes/css/dashicons.min.css');
  const keep = [];
  for (const b of blocks(dc)) {
    if (/^@font-face/.test(b)) keep.push('@font-face{font-family:dashicons;font-style:normal;font-weight:400;font-display:swap;src:url(/wp-includes/fonts/dashicons.ttf) format("truetype")}');
    else if (/^\.dashicons-[a-z0-9-]+:before/.test(b)) { if (usedDash.has(b.match(/^\.dashicons-([a-z0-9-]+):before/)[1])) keep.push(b); }
    else if (/^\.dashicons,|^\.dashicons\{|^\.dashicons-before|^\.dashicons-|^\.dashicons/.test(b) && !/-:before/.test(b) && !/^\.dashicons-[a-z0-9-]+:before/.test(b)) keep.push(b);
  }
  form += keep.join('');
}
form = minCss(form);
const formName = `assets/css/vmform-${hash(form)}.css`;
wr(formName, form);

// ---------------------------------------------------------------- fonts (downloaded earlier into assets/fonts) as inline @font-face
const fontBlocks = blocks(minCss(fs.readFileSync(path.join(HERE, 'assets-src/fonts-face.css'), 'utf8'))).map(b => [b.match(/font-family:"([^"]+)"/)[1], b]);
fs.mkdirSync(path.join(OUT, 'assets/fonts'), { recursive: true });
for (const f of fs.readdirSync(path.join(HERE, 'assets-src/fonts'))) fs.copyFileSync(path.join(HERE, 'assets-src/fonts', f), path.join(OUT, 'assets/fonts', f));

// ---------------------------------------------------------------- consent assets + form script + tracking
fs.mkdirSync(path.join(OUT, 'assets/cc'), { recursive: true });
fs.mkdirSync(path.join(OUT, 'assets/js'), { recursive: true });
for (const f of ['cookieconsent.umd.js', 'sip-consent.js']) fs.copyFileSync(path.join(HERE, 'assets-src/cc', f), path.join(OUT, 'assets/cc', f));
const ccCss = minCss(fs.readFileSync(path.join(HERE, 'assets-src/cc/cookieconsent.css'), 'utf8') + fs.readFileSync(path.join(HERE, 'assets-src/cc/sip-cc-theme.css'), 'utf8'));
const ccName = `assets/cc/consent-${hash(ccCss)}.css`;
wr(ccName, ccCss);
const formJsBuf = fs.readFileSync(path.join(HERE, 'assets-src/vmforms-public.js'));
const formJsName = `wp-content/plugins/vmforms/public/js/public-${hash(formJsBuf.toString())}.js`;
wr(formJsName, formJsBuf);
fs.copyFileSync(path.join(HERE, 'assets-src/vv-tracking.js'), path.join(OUT, 'assets/js/vv-tracking.js'));

// ---------------------------------------------------------------- page copy: title / description / schema type
const FAQ = true;
const PAGES = {
  '/': { title: 'Income Protection for Employees | Simple Income Protection', desc: 'Income protection for employed people: cover that pays a monthly income if illness or injury stops you working. Free to use, with no obligation.', kind: 'home', service: 'employed', faq: FAQ, name: 'Home' },
  '/self-employed-quote/': { title: 'Self Employed Quote | Simple Income Protection', desc: 'Income protection for the self-employed: cover that pays a monthly income if illness or injury stops you working. Free to use, with no obligation.', service: 'self-employed', faq: FAQ, name: 'Self-employed income protection' },
  '/income-protection/': { title: 'What Is Income Protection? | Simple Income Protection', desc: 'How income protection works, who it is for and what it can cover if you cannot work because of illness or injury. Free to use, with no obligation.', service: 'guide', faq: FAQ, breadcrumb: true, name: 'Income protection' },
  '/income-protection/get-quote/': { title: 'Get an Income Protection Quote | Simple Income Protection', desc: 'Answer a few short questions to get an income protection quote. Free to use, with no obligation.', service: 'employed', breadcrumb: true, name: 'Get quote' },
  '/income-protection-cover/': { title: 'Income Protection Cover | Simple Income Protection', desc: 'Income protection cover that pays a monthly income if you cannot work because of illness or injury. Free to use, with no obligation.', service: 'employed', name: 'Income protection cover' },
  '/self-employed/': { title: 'Self Employed Income Protection | Simple Income Protection', desc: 'Protect your income if you are self-employed and cannot work because of illness or injury. Free to use, with no obligation.', service: 'self-employed', name: 'Self employed income protection' },
  '/contact-us/': { title: 'Contact Us | Simple Income Protection', desc: 'Contact Simple Income Protection, a trading style of Blab Media Ltd. Registered address and company details.', kind: 'contact', breadcrumb: true, name: 'Contact us' },
  '/privacy-policy/': { title: 'Privacy Policy | Simple Income Protection', desc: 'How Simple Income Protection collects, uses and protects your personal data.', breadcrumb: true, name: 'Privacy policy' },
  '/terms-and-conditions/': { title: 'Terms and Conditions | Simple Income Protection', desc: 'The terms and conditions for using the Simple Income Protection website and services.', breadcrumb: true, name: 'Terms and conditions' },
  '/cookie-policy/': { title: 'Cookie Policy | Simple Income Protection', desc: 'The cookies used on this site, what they do, and how to change your choices.', breadcrumb: true, name: 'Cookie policy' },
};
const NOINDEX_REASON = 'legacy landing variant, test page, archive or confirmation page';
const isIndexable = u => !!PAGES[u];
const urlOf = f => '/' + f.replace(/index\.html$/, '');

// ---------------------------------------------------------------- schema
const AREA = { '@type': 'Country', name: 'United Kingdom' };
const SHARE = ORIGIN + '/assets/img/sip-share-1200x630.webp';
function schemaFor(u, cfg, h) {
  const url = ORIGIN + u;
  const org = {
    '@type': ['Organization', 'InsuranceAgency'], '@id': ORIGIN + '/#organization', name: BRAND, legalName: 'Blab Media Ltd', url: ORIGIN + '/',
    logo: { '@type': 'ImageObject', url: ORIGIN + '/assets/img/sip-logo-512.png', width: 512, height: 512 },
    image: SHARE,
    description: 'Simple Income Protection helps people in the UK find income protection cover that pays a monthly income if illness or injury stops them working. It is a trading style of Blab Media Ltd, an Introducer Appointed Representative of Visionary Markets Ltd.',
    areaServed: AREA,
    address: { '@type': 'PostalAddress', streetAddress: 'Coridon, St James Road', addressLocality: 'Bridport', addressRegion: 'Dorset', postalCode: 'DT6 5LL', addressCountry: 'GB' },
    identifier: [{ '@type': 'PropertyValue', name: 'Companies House number', value: '11511037' }, { '@type': 'PropertyValue', name: 'FCA firm reference number (Introducer Appointed Representative of Visionary Markets Ltd, FRN 710569)', value: '961549' }],
    sameAs: ['https://find-and-update.company-information.service.gov.uk/company/11511037'],
    knowsAbout: ['Income protection insurance', 'Self-employed income protection', 'Sickness and injury cover'],
  };
  const site = { '@type': 'WebSite', '@id': ORIGIN + '/#website', url: ORIGIN + '/', name: BRAND, publisher: { '@id': ORIGIN + '/#organization' }, inLanguage: 'en-GB' };
  const graph = [org, site];
  if (!cfg) return { '@context': 'https://schema.org', '@graph': graph };
  const type = cfg.kind === 'contact' ? 'ContactPage' : 'WebPage';
  const page = { '@type': type, '@id': url + '#webpage', url, name: cfg.title, description: cfg.desc, isPartOf: { '@id': ORIGIN + '/#website' }, about: { '@id': ORIGIN + '/#organization' }, inLanguage: 'en-GB', primaryImageOfPage: { '@type': 'ImageObject', url: SHARE, width: 1200, height: 630 } };
  graph.push(page);
  if (cfg.breadcrumb) {
    page.breadcrumb = { '@id': url + '#breadcrumb' };
    const trail = u.startsWith('/income-protection/') && u !== '/income-protection/' ? [['Home', '/'], ['Income protection', '/income-protection/'], [cfg.name, u]] : [['Home', '/'], [cfg.name, u]];
    graph.push({ '@type': 'BreadcrumbList', '@id': url + '#breadcrumb', itemListElement: trail.map(([name, p], i) => ({ '@type': 'ListItem', position: i + 1, name, item: ORIGIN + p })) });
  }
  if (cfg.service) {
    const who = { employed: 'people who are employed in the UK', 'self-employed': 'people who are self-employed in the UK', guide: 'people in the UK who want to protect their income' }[cfg.service];
    graph.push({ '@type': 'Service', '@id': url + '#service', name: 'Income protection insurance comparison', serviceType: 'Income protection insurance comparison',
      description: 'A free comparison service for ' + who + '. Income protection is cover that pays a monthly income if illness or injury stops you working.',
      provider: { '@id': ORIGIN + '/#organization' }, areaServed: AREA, isAccessibleForFree: true, mainEntityOfPage: { '@id': url + '#webpage' } });
  }
  if (cfg.faq) {
    const qa = [...h.matchAll(/<details[^>]*>\s*<summary[^>]*>([\s\S]*?)<\/summary>([\s\S]*?)<\/details>/g)]
      .map(m => [m[1], m[2]].map(t => t.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#8217;|&rsquo;/g, '’').replace(/&#8211;|&ndash;/g, '–').replace(/&pound;/g, '£').replace(/\s+/g, ' ').trim()))
      .filter(([q, a]) => q && a);
    if (qa.length) graph.push({ '@type': 'FAQPage', '@id': url + '#faq', url, mainEntity: qa.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) });
  }
  return { '@context': 'https://schema.org', '@graph': graph };
}

// ---------------------------------------------------------------- per page transform
const FORM_SCRIPTS = [
  '/wp-content/plugins/vmforms/public/static/tippedjs/js/tipped-custom.min.js',
  '/wp-content/plugins/vmforms/public/js/postcode.js',
  '/wp-content/plugins/vmforms/public/static/modaal/js/modaal.js',
  '/' + formJsName,
  '/assets/js/vv-tracking.js',
];
const CONSENT_DEFAULT = "window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('set','ads_data_redaction',true);gtag('set','url_passthrough',true);gtag('consent','default',{ad_storage:'denied',analytics_storage:'denied',ad_user_data:'denied',ad_personalization:'denied',functionality_storage:'denied',personalization_storage:'denied',security_storage:'granted',wait_for_update:500});";
const GTM_LOAD = `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${GTM}');`;
const GTM_SNIPPET = GTM_LOAD;
const GTM_LATE = `(function(){var done=0,ev=['pointerdown','keydown','scroll','touchstart','mousemove'];function go(){if(done)return;done=1;ev.forEach(function(e){removeEventListener(e,go,{passive:true})});${GTM_LOAD.replace(/`/g, '')}}ev.forEach(function(e){addEventListener(e,go,{passive:true})});addEventListener('load',function(){setTimeout(go,6000)});})();`;
const stats = { pages: 0, indexable: 0, formPages: 0, before: 0, after: 0 };

let heroPreload = '';
function webpSize(file) {   // width and height from a WebP header
  const b = fs.readFileSync(file);
  if (b.toString('ascii', 12, 16) === 'VP8 ') return [b.readUInt16LE(26) & 0x3fff, b.readUInt16LE(28) & 0x3fff];
  if (b.toString('ascii', 12, 16) === 'VP8L') { const v = b.readUInt32LE(21); return [(v & 0x3fff) + 1, ((v >> 14) & 0x3fff) + 1]; }
  const v = b.readUIntLE(24, 3), h = b.readUIntLE(27, 3); return [v + 1, h + 1];   // VP8X
}
function transform(f) {
  heroPreload = '';
  const u = urlOf(f);
  const cfg = PAGES[u];
  const raw = legacy(rd(f));
  stats.before += raw.length;
  const isForm = /id="vmform"/.test(raw);
  const isSip = /class="sip se-page"/.test(raw);
  const headEnd = raw.indexOf('</head>');
  const head = raw.slice(0, headEnd);
  let body = raw.slice(headEnd + 7);

  // ----- keep from the old head
  const keepStyles = [];
  for (const m of head.matchAll(/<style\b([^>]*)>([\s\S]*?)<\/style>/g)) {
    const id = (m[1].match(/id=["']([^"']+)["']/) || [])[1] || '';
    if (/^(generate-style-inline-css|wp-custom-css)$/.test(id) || (!id && m[2].trim().length > 0 && !/wp-emoji|img\.wp-smiley|cmplz/.test(m[2]))) keepStyles.push(minCss(m[2].replace(/\/\*#\s*sourceURL[^*]*\*\//g, '')));
  }
  const bbCssLinks = [...head.matchAll(/href=["'](\/wp-content\/uploads\/bb-plugin\/cache\/[^"'?]+\.css)[^"']*["']/g)].map(m => m[1]);
  for (const c of bbCssLinks) keepStyles.push(minCss(absUrls(legacy(rd(c.slice(1))), path.posix.dirname(c) + '/')));
  const bbJs = [...(head + body).matchAll(/src=["'](\/wp-content\/uploads\/bb-plugin\/cache\/[^"'?]+\.js)[^"']*["']/g)].map(m => m[1]);
  const icons = (head.match(/<link rel="(?:icon|apple-touch-icon)"[^>]*>/g) || []).join('');
  const msTile = (head.match(/<meta name="msapplication-TileImage"[^>]*>/) || [''])[0];
  const viewport = '<meta name="viewport" content="width=device-width, initial-scale=1">';

  // ----- body clean-up: drop WordPress / Site Kit / Complianz / emoji
  const dropScript = (attrs, inner) =>
    /\bsrc=["'][^"']*(?:\/wp-includes\/|\/wp-content\/plugins\/(?:google-site-kit|complianz|wp-consent-api|vmforms|bb-plugin|gp-premium)|\/wp-content\/uploads\/bb-plugin\/cache\/|googletagmanager\.com)/.test(attrs)
    || /id=["'](?:google_gtagjs|googlesitekit|wp-consent|cmplz|wp-emoji|consent_api)/.test(attrs)
    || /type=["'](?:speculationrules|text\/plain)["']/.test(attrs)
    || /wpEmojiSettingsSupports|googlesitekit|cmplz_|consent_api|_googlesitekit/.test(inner || '');
  body = body.replace(/<script\b([^>]*)>([\s\S]*?)<\/script>/g, (m, a, inner) => dropScript(a, inner) ? '' : m);
  { // Complianz banner markup: one block after the footer, ending just before the GeneratePress a11y script
    const a = body.indexOf('<!-- Consent Management powered by Complianz');
    if (a >= 0) { let z = body.indexOf('<script id="generate-a11y"', a); if (z < 0) z = body.indexOf('</body>', a); body = body.slice(0, a) + body.slice(z); }
  }
  body = body.replace(/\sdata-cmplz=["']?\d*["']?/g, '');
  // stylesheets the page builder printed into the body (Google Fonts etc.): fonts are self-hosted now
  body = body.replace(/<link\b[^>]*rel=["']stylesheet["'][^>]*>/g, '');
  // inline stylesheets left in the body (page content styles): minify
  body = body.replace(/<style\b([^>]*)>([\s\S]*?)<\/style>/g, (m, a, css) => /cmplz|wp-emoji/.test(css) ? '' : `<style${a}>${minCss(css.replace(/\/\*#\s*sourceURL[^*]*\*\//g, ''))}</style>`);
  // images: the Hodge Lifetime logo was a 112 KB PNG shown at logo size
  // footer: replace the removed Complianz "manage consent" with a link that opens the new preferences panel
  body = body.replace(/(<a href="\/cookie-policy\/">Cookie Policy<\/a>)(<\/nav>)/, '$1<button type="button" class="sip-cc-link" data-cc="show-preferencesModal">Manage cookies</button>$2');

  // pages without the landing-page footer: put the same link in the theme's copyright bar so consent can be changed on every page
  if (!body.includes('data-cc="show-preferencesModal"')) body = body.replace(/(<div class="copyright-bar">[\s\S]*?)(<\/div>)/, '$1 &bull; <button type="button" class="sip-cc-link" data-cc="show-preferencesModal">Manage cookies</button>$2');

  if (!body.includes('data-cc="show-preferencesModal"')) body = body.replace(/(href="\/cookie-policy\/"[^>]*>(?:<span[^>]*>)?Cookie Policy(?:<\/span>)?<\/a>)/, '$1 | <button type="button" class="ea-cc-link" style="background:none;border:0;padding:0;font:inherit;color:#fff;cursor:pointer" data-cc="show-preferencesModal">Manage cookies</button>');

  // ----- this site: Google Fonts @import in page CSS (fonts are self-hosted), emoji style, contact form that needs WordPress
  body = body.replace(/@import url\((["'])https:\/\/fonts\.googleapis\.com[^)]*\)\s*;?/g, '');
  for (let i = 0; i < keepStyles.length; i++) keepStyles[i] = keepStyles[i].replace(/@import url\((["'])https:\/\/fonts\.googleapis\.com[^)]*\)\s*;?/g, '');
  if (u === '/contact-us/') {
    body = body.replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, m => /nfForms|nfi18n|ninja|nf-form|nfRadio|_nfFormData|nfDisplay|nfFormData/i.test(m) ? '' : m);
    body = body.replace(/<script[^>]*type="text\/template"[^>]*id="tmpl-nf[\s\S]*?<\/script>/g, '');
    body = body.replace(/<div id="nf-form-1-cont"[\s\S]*?<\/div>\s*<\/div>/, '');
    body = body.replace(/<p><noscript class="ninja-forms-noscript-message">[\s\S]*?<\/div><\/div>\s*<\/p>|<noscript class="ninja-forms-noscript-message">[\s\S]*?(?=<\/div>\s*<\/div>\s*<\/div>\s*<\/div>\s*<div class="fl-row|<\/main>)/, '');
    body = body.replace(/<p>To make contact with the team, please complete the contact form below\.<\/p>/, '<p>To contact us, email <a href="mailto:blabmediauk@gmail.com">blabmediauk@gmail.com</a>.</p>');
  }
  body = body.replace(/for a life insurance quote/g, 'for an income protection quote');
  // visible breadcrumb on the plain content pages (the schema only describes what is visible)
  if (cfg && cfg.breadcrumb) {
    const trail = u.startsWith('/income-protection/') && u !== '/income-protection/' ? [['Home', '/'], ['Income protection', '/income-protection/'], [cfg.name, null]] : [['Home', '/'], [cfg.name, null]];
    const bc = '<nav class="sip-bc" aria-label="Breadcrumb">' + trail.map(([t, h]) => h ? '<a href="' + h + '">' + t + '</a>' : '<span aria-current="page" style="margin:0">' + t + '</span>').join('<span aria-hidden="true">/</span>') + '</nav>';
    if (!isSip) body = body.replace(/(<main[^>]*id="main"[^>]*>)/, '$1' + bc);
  }
  // VM form: its generated form CSS and its form definition script are big and identical on every visit, so serve them as cacheable files
  let formCssFile = '', formCfgFile = '';
  if (isForm) {
    body = body.replace(/<style\b([^>]*)>([\s\S]*?)<\/style>/g, (m, a, css) => {
      if (css.length < 20000 || !/#vmform-wrapper-\d+/.test(css)) return m;
      formCssFile = 'assets/css/vmcss-' + hash(css) + '.css'; wr(formCssFile, css); return '';
    });
    body = body.replace(/<script\b([^>]*)>([\s\S]*?)<\/script>/g, (m, a, js) => {
      if (js.length < 20000 || !/all_campaign_data/.test(js)) return m;
      formCfgFile = 'assets/js/vmcfg-' + hash(js) + '.js'; wr(formCfgFile, js); return '';
    });
  }
  // data: images embedded in the page -> real WebP files (smaller HTML, cacheable, lazy where below the fold)
  {
    let first = true;
    body = body.replace(/<img\b([^>]*?)\bsrc="data:image\/(?:jpeg|png|webp);base64,([A-Za-z0-9+/=]+)"([^>]*)>/g, (m, a, b64, z) => {
      const buf = Buffer.from(b64, 'base64'); const name = 'assets/img/p-' + hash(b64) + '.webp';
      const tmp = path.join(OUT, '.tmp-' + hash(b64) + '.img'); fs.writeFileSync(tmp, buf);
      const ow = path.join(OUT, name); fs.mkdirSync(path.dirname(ow), { recursive: true });
      const isHero = first && /se-himg/.test(a + z); first = false;
      try { execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', tmp, '-vf', 'scale=min(' + (isHero ? 820 : 560) + '\\,iw):-2', '-c:v', 'libwebp', '-quality', isHero ? '72' : '78', '-compression_level', '6', ow]); } catch { fs.rmSync(tmp, { force: true }); return m; }
      fs.rmSync(tmp, { force: true });
      const dim = webpSize(ow);
      let attrs = (a + z).replace(/\s(?:width|height|loading|fetchpriority|decoding)="[^"]*"/g, '');
      attrs += ' width="' + dim[0] + '" height="' + dim[1] + '"' + (isHero ? ' fetchpriority="high" decoding="async"' : ' loading="lazy" decoding="async"');
      if (isHero) heroPreload = '/' + name;
      return '<img ' + attrs.trim() + ' src="/' + name + '">';
    });
  }

  // ----- new head
  const parts = [];
  parts.push('<meta charset="UTF-8">');
  parts.push(`<script>${CONSENT_DEFAULT}</script>`);
  parts.push(viewport);
  const title = cfg ? cfg.title : (head.match(/<title>([^<]*)<\/title>/) || [, BRAND])[1];
  parts.push(`<title>${cfg ? esc(cfg.title) : title}</title>`);
  if (cfg) parts.push(`<meta name="description" content="${esc(cfg.desc)}">`);
  parts.push(`<meta name="robots" content="${cfg ? 'index,follow,max-image-preview:large' : 'noindex,follow'}">`);
  parts.push(`<link rel="canonical" href="${ORIGIN}${u}">`);
  if (cfg) {
    const img = SHARE;
    parts.push(`<meta property="og:type" content="website"><meta property="og:site_name" content="${BRAND}"><meta property="og:title" content="${esc(cfg.title)}"><meta property="og:description" content="${esc(cfg.desc)}"><meta property="og:url" content="${ORIGIN}${u}"><meta property="og:locale" content="en_GB"><meta property="og:image" content="${img}"><meta property="og:image:alt" content="${BRAND}: income protection if illness or injury stops you working"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${esc(cfg.title)}"><meta name="twitter:description" content="${esc(cfg.desc)}"><meta name="twitter:image" content="${img}">`);
  }
  parts.push('<link rel="dns-prefetch" href="//www.googletagmanager.com">');
  // fonts: only the families this page uses; preload the one its text needs first
  const detect = keepStyles.join('') + body;
  const count = n => (detect.match(new RegExp(n, 'gi')) || []).length;
  const faces = fontBlocks.filter(([fam]) => count(fam) > 0 || fam === 'Open Sans' && !isSip).map(([, b]) => b).join('');
  const pre = f => `<link rel="preload" href="/assets/fonts/${f}.woff2" as="font" type="font/woff2" crossorigin>`;
  if (isSip) parts.push(pre('inter-400-700-latin') + pre('plusjakartasans-500-800-latin') + (isForm ? pre('nunito-400-800-latin') : ''));
  else parts.push(pre('opensans-300-800-latin'));
  if (heroPreload) parts.push(`<link rel="preload" as="image" href="${heroPreload}" fetchpriority="high">`);
  parts.push(`<style>${faces}</style>`);
  parts.push(`<link rel="stylesheet" href="/${baseName}">`);
  if (isForm) parts.push(`<link rel="stylesheet" href="/${formName}">`);
  if (formCssFile) parts.push(`<link rel="stylesheet" href="/${formCssFile}">`);
  if (isForm) parts.push('<style>.vmform-disclaimer a{text-decoration:underline;font-weight:700}</style>');
  for (const s of keepStyles) parts.push(`<style>${s}</style>`);
  // deferred scripts, in dependency order
  const scripts = isForm ? ['/wp-includes/js/jquery/jquery.min.js', '/wp-includes/js/jquery/jquery-migrate.min.js', ...(formCfgFile ? ['/' + formCfgFile] : []), ...FORM_SCRIPTS] : [];
  for (const s of scripts) parts.push(`<script defer src="${s}"></script>`);
  parts.push(icons + msTile);
  const ld = schemaFor(u, cfg, raw);
  parts.push(`<script type="application/ld+json">${JSON.stringify(ld)}</script>`);
  parts.push(`<script>${/^\/thank-you/.test(u) ? GTM_SNIPPET : GTM_LATE}</script>`);

  // body end: consent UI (deferred)
  const tail = `<link rel="stylesheet" href="/${ccName}" media="print" onload="this.media='all';this.onload=null"><noscript><link rel="stylesheet" href="/${ccName}"></noscript><script defer src="/assets/cc/cookieconsent.umd.js"></script><script defer src="/assets/cc/sip-consent.js"></script>`;
  body = body.replace(/<\/body>/, tail + '</body>');

  const bodyOpen = (raw.slice(headEnd).match(/<html[^>]*>/) || [])[0];
  const htmlTag = (raw.match(/<html[^>]*>/) || ['<html lang="en-GB">'])[0];
  const out = `<!DOCTYPE html>\n${htmlTag}\n<head>\n${parts.join('\n')}\n</head>${body}`;
  stats.pages++; stats.before += 0; stats.after += out.length; if (cfg) stats.indexable++; if (isForm) stats.formPages++;
  wr(f, out);
  return { u, indexable: !!cfg, bytes: out.length, was: raw.length };
}

// ---------------------------------------------------------------- run
const results = pageFiles.map(transform);


// ---------------------------------------------------------------- photos: JPG/PNG used by pages -> WebP when clearly smaller
{
  const htmlFiles = walk(OUT).filter(f => f.endsWith('.html'));
  const refs = new Set();
  for (const f of htmlFiles) for (const m of fs.readFileSync(f, 'utf8').matchAll(/\/wp-content\/uploads\/[^"'\s)\\,]+\.(?:jpe?g|png)/gi)) refs.add(m[0]);
  const swap = new Map(); let saved = 0;
  for (const ref of refs) {
    const file = path.join(OUT, decodeURIComponent(ref));
    if (!fs.existsSync(file) || fs.statSync(file).size < 15000 || /cropped-SER-icon|favicon|apple-touch/i.test(ref)) continue;
    const out = file.replace(/\.(jpe?g|png)$/i, '.webp');
    try { execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', file, '-c:v', 'libwebp', '-quality', '80', '-compression_level', '6', out]); } catch { continue; }
    const a = fs.statSync(file).size, b = fs.statSync(out).size;
    if (b < a * 0.85) { swap.set(ref, ref.replace(/\.(jpe?g|png)$/i, '.webp')); saved += a - b; fs.rmSync(file); } else fs.rmSync(out);
  }
  for (const f of htmlFiles) {
    let h = fs.readFileSync(f, 'utf8'), changed = false;
    for (const [from, to] of swap) if (h.includes(from)) { h = h.split(from).join(to); changed = true; }
    if (changed) fs.writeFileSync(f, h);
  }
  stats.imagesConverted = swap.size; stats.imageBytesSaved = saved;
}

// ---------------------------------------------------------------- failed + 404 (rebuilt from the privacy page shell)
function shell(title, heading, bodyHtml) {
  let h = fs.readFileSync(path.join(OUT, 'privacy-policy/index.html'), 'utf8');
  h = h.replace(/<title>[^<]*<\/title>/, `<title>${title} | ${BRAND}</title>`)
    .replace(/<meta name="description"[^>]*>/, '').replace(/<meta property="og:[^>]*>|<meta name="twitter:[^>]*>/g, '')
    .replace(/<meta name="robots"[^>]*>/, '<meta name="robots" content="noindex,nofollow">')
    .replace(/<link rel="canonical"[^>]*>/, '').replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/, '');
  const i = h.indexOf('<main'), j = h.indexOf('</main>') + 7;
  const main = `<main class="site-main" id="main"><article class="page type-page status-publish"><div class="inside-article"><header class="entry-header"><h1 class="entry-title" itemprop="headline">${heading}</h1></header><div class="entry-content" itemprop="text">${bodyHtml}</div></div></article></main>`;
  return h.slice(0, i) + main + h.slice(j);
}
wr('failed/index.html', shell('Something went wrong', 'Sorry, we could not send your details',
  '<p>Something went wrong while sending your details, so we may not have them yet. Please try the <a href="/income-protection/get-quote/">form</a> again in a few minutes.</p>'));
wr('404.html', shell('Page not found', 'Page not found',
  '<p>We could not find that page. You can start again from the <a href="/">home page</a> or go straight to the <a href="/income-protection/get-quote/">quote form</a>.</p>'));

// ---------------------------------------------------------------- images (share card, logo)
const ff = (args) => execFileSync('ffmpeg', ['-y', '-v', 'error', ...args], { stdio: 'inherit' });
fs.mkdirSync(path.join(OUT, 'assets/img'), { recursive: true });
const FONT = 'C\\:/Windows/Fonts/arialbd.ttf', FONT2 = 'C\\:/Windows/Fonts/arial.ttf';
ff(['-f', 'lavfi', '-i', 'color=c=0x17407a:s=1200x630:d=1',
  '-vf', `drawbox=x=0:y=0:w=24:h=630:color=0xffc21a:t=fill,drawtext=fontfile='${FONT}':text='Simple Income Protection':fontcolor=white:fontsize=84:x=90:y=190,drawtext=fontfile='${FONT2}':text='Cover that pays a monthly income':fontcolor=0xdce8f7:fontsize=46:x=94:y=340,drawtext=fontfile='${FONT2}':text='if illness or injury stops you working':fontcolor=0xdce8f7:fontsize=46:x=94:y=405`,
  '-frames:v', '1', '-c:v', 'libwebp', '-quality', '88', path.join(OUT, 'assets/img/sip-share-1200x630.webp')]);
ff(['-f', 'lavfi', '-i', 'color=c=0x1f5fbf:s=512x512:d=1',
  '-vf', `drawtext=fontfile='${FONT}':text='SIP':fontcolor=white:fontsize=190:x=(w-text_w)/2:y=(h-text_h)/2`,
  '-frames:v', '1', path.join(OUT, 'assets/img/sip-logo-512.png')]);

// ---------------------------------------------------------------- root files
const idx = results.filter(r => r.indexable).map(r => r.u).sort((a, b) => a.length - b.length);
wr('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${idx.map(u => `  <url><loc>${ORIGIN}${u}</loc><lastmod>${TODAY}</lastmod><changefreq>monthly</changefreq><priority>${u === '/' ? '1.0' : /self-employed-quote|get-quote/.test(u) ? '0.9' : '0.6'}</priority></url>`).join('\n')}\n</urlset>\n`);
wr('robots.txt', `User-agent: *\nAllow: /\nDisallow: /failed/\n\n# AI guide: ${ORIGIN}/llms.txt\nSitemap: ${ORIGIN}/sitemap.xml\n`);
wr('llms.txt', `# Simple Income Protection

> Simple Income Protection (simpleincomeprotection.co.uk) helps people in the UK find income protection cover: insurance that pays a regular monthly income if illness or injury stops you working. It is a trading style of Blab Media Ltd (company number 11511037), an Introducer Appointed Representative of Visionary Markets Ltd, which is authorised and regulated by the Financial Conduct Authority (FRN 710569; Blab Media Ltd FRN 961549). The service is free to use with no obligation. After a short form is submitted, a broker follows up with the person.

## Get a quote
- [Income protection for employed people](${ORIGIN}/): short form for people who are employed.
- [Income protection for the self-employed](${ORIGIN}/self-employed-quote/): short form for people who are self-employed.
- [Income protection quote form](${ORIGIN}/income-protection/get-quote/)

## Guides
- [What is income protection?](${ORIGIN}/income-protection/): how income protection works and who it is for.
- [Income protection cover](${ORIGIN}/income-protection-cover/)
- [Self employed income protection](${ORIGIN}/self-employed/)

## Company and policies
- [Contact us](${ORIGIN}/contact-us/)
- [Privacy policy](${ORIGIN}/privacy-policy/)
- [Terms and conditions](${ORIGIN}/terms-and-conditions/)
- [Cookie policy](${ORIGIN}/cookie-policy/)
`);
wr('_redirects', '');
wr('_headers', `/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Strict-Transport-Security: max-age=31536000; includeSubDomains
  X-Frame-Options: SAMEORIGIN
  Permissions-Policy: camera=(), microphone=(), geolocation=()
/assets/css/*
  Cache-Control: public, max-age=31536000, immutable
/assets/fonts/*
  Cache-Control: public, max-age=31536000, immutable
/assets/img/p-*
  Cache-Control: public, max-age=31536000, immutable
/assets/img/*
  Cache-Control: public, max-age=604800
/assets/cc/*
  Cache-Control: public, max-age=604800
/assets/js/*
  Cache-Control: public, max-age=86400
/wp-content/*
  Cache-Control: public, max-age=2592000
/wp-includes/*
  Cache-Control: public, max-age=2592000
/failed/*
  X-Robots-Tag: noindex
`);

// ---------------------------------------------------------------- remove what is no longer referenced
for (const d of ['wp-content/plugins/complianz-gdpr-premium', 'wp-content/plugins/ninja-forms', 'wp-content/plugins/bb-plugin', 'wp-content/themes/generatepress/assets/js', 'wp-content/plugins/google-site-kit', 'wp-content/plugins/wp-consent-api', 'wp-content/plugins/gp-premium',
  'wp-content/uploads/complianz', 'wp-includes/js/underscore.min.js', 'wp-includes/js/backbone.min.js', 'wp-includes/js/wp-emoji-release.min.js',
  'wp-content/themes/generatepress/assets/css', 'wp-content/themes/generatepress_child/style.css', 'wp-includes/css/dashicons.min.css', 'wp-includes/fonts/dashicons.eot',
  'wp-content/plugins/vmforms/public/js/public.js', 'wp-content/plugins/vmforms/admin/form/dist/form.css', 'wp-content/plugins/vmforms/public/static/hover',
  'wp-content/plugins/vmforms/public/static/spinkit', 'wp-content/plugins/vmforms/public/static/tippedjs/css', 'wp-content/plugins/vmforms/public/static/modaal/css', 'wp-content/plugins/vmforms/public/css']) {
  fs.rmSync(path.join(OUT, d), { recursive: true, force: true });
}
// per-page BB layout css is inlined now
for (const f of fs.existsSync(path.join(OUT, 'wp-content/uploads/bb-plugin/cache')) ? fs.readdirSync(path.join(OUT, 'wp-content/uploads/bb-plugin/cache')) : []) if (f.endsWith('.css')) fs.rmSync(path.join(OUT, 'wp-content/uploads/bb-plugin/cache', f));
fs.writeFileSync(path.join(OUT, '..', 'optimize-report.json'), JSON.stringify({ stats, base: baseName, form: formName, results }, null, 1));
console.log(JSON.stringify(stats), baseName, fs.statSync(path.join(OUT, baseName)).size, formName, fs.statSync(path.join(OUT, formName)).size);
console.log('indexable:', idx.join(' '));
