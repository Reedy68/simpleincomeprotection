// Structural check of the JSON-LD on every page (run: node tools/schema-check.mjs public).
// It cannot replace Google's Rich Results Test (that needs a public URL); it checks what we can check offline:
//  - every JSON-LD block parses; every {"@id": ...} reference resolves inside the same graph
//  - required properties for the types used (Organization/InsuranceAgency, WebSite, WebPage, BreadcrumbList, FAQPage, Service)
//  - FAQ questions and answers appear word for word in the visible page; breadcrumb names appear in the visible breadcrumb
//  - no Review / AggregateRating / Offer prices anywhere
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.argv[2] || 'public');
const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
const files = walk(root).filter(f => /index\.html$/.test(f) && !/wp-(content|includes)/.test(f));
const decode = s => s.replace(/<[^>]+>/g, ' ').replace(/&nbsp;|&#160;/g, ' ').replace(/&amp;/g, '&').replace(/&pound;/g, '£').replace(/&#8217;|&rsquo;/g, '’').replace(/&#8211;|&ndash;/g, '–').replace(/\s+/g, ' ').trim();
let problems = 0, pages = 0;
const bad = (rel, msg) => { problems++; console.log('PROBLEM', rel, msg); };

for (const f of files.sort()) {
  const rel = path.relative(root, f).split(path.sep).join('/');
  const html = fs.readFileSync(f, 'utf8');
  const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
  if (!blocks.length) continue;
  pages++;
  const visible = decode(html.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<style[\s\S]*?<\/style>/g, ' '));
  for (const b of blocks) {
    let j; try { j = JSON.parse(b[1]); } catch (e) { bad(rel, 'invalid JSON-LD: ' + e.message); continue; }
    const graph = j['@graph'] || [j];
    const ids = new Set(graph.map(n => n['@id']).filter(Boolean));
    const types = n => [].concat(n['@type'] || []);
    const walkRefs = (n, path_ = '') => { if (n && typeof n === 'object') { if (Object.keys(n).length === 1 && n['@id']) { if (!ids.has(n['@id'])) bad(rel, `unresolved @id ${n['@id']} at ${path_}`); } else for (const [k, v] of Object.entries(n)) walkRefs(v, path_ + '/' + k); } };
    graph.forEach(n => walkRefs(n));
    if (/"(Review|AggregateRating|Rating)"|"price"|"Offer"/.test(b[1])) bad(rel, 'contains review, rating or price markup');
    for (const n of graph) {
      const t = types(n);
      if (t.includes('Organization')) for (const k of ['name', 'url', 'logo', 'address', 'description']) if (!n[k]) bad(rel, `Organization missing ${k}`);
      if (t.includes('WebPage') || t.includes('ContactPage')) for (const k of ['url', 'name', 'isPartOf']) if (!n[k]) bad(rel, `WebPage missing ${k}`);
      if (t.includes('Service')) for (const k of ['name', 'provider', 'description']) if (!n[k]) bad(rel, `Service missing ${k}`);
      if (t.includes('BreadcrumbList')) {
        const names = n.itemListElement.map(i => i.name);
        const nav = (html.match(/<nav class="sip-bc"[\s\S]*?<\/nav>/) || [''])[0];
        if (!nav) bad(rel, 'BreadcrumbList without a visible breadcrumb');
        else { const vis = decode(nav); for (const nm of names) if (!vis.includes(nm)) bad(rel, `breadcrumb "${nm}" not in the visible breadcrumb`); }
      }
      if (t.includes('FAQPage')) {
        if (!n.mainEntity || !n.mainEntity.length) bad(rel, 'FAQPage empty');
        for (const q of n.mainEntity || []) {
          if (!visible.includes(q.name)) bad(rel, `FAQ question not visible: ${q.name.slice(0, 50)}`);
          if (!visible.includes(q.acceptedAnswer.text)) bad(rel, `FAQ answer not visible word for word: ${q.name.slice(0, 50)}`);
        }
      }
    }
  }
}
console.log(`JSON-LD checked on ${pages} pages. Problems: ${problems}`);
process.exit(problems ? 1 : 0);
