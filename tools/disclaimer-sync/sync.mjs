// Keeps the VM compliance disclaimer on every form page in line with VM's live wording.
// Usage: node tools/disclaimer-sync/sync.mjs          (updates pages in place, prints a report)
//        node tools/disclaimer-sync/sync.mjs --check  (report only, exit 1 if anything differs)
import fs from 'node:fs';
import path from 'node:path';

const URL_JSON = 'https://api.vmleads.co.uk/forms/disclaimer/374/28F4F';
const ROOT = path.resolve(import.meta.dirname, '../../public');
const CHECK = process.argv.includes('--check');

const res = await fetch(URL_JSON);
if (!res.ok) { console.error('Could not fetch VM disclaimer: HTTP ' + res.status); process.exit(2); }
const vm = await res.json();
for (const k of ['main_disclaimer', 'firm_disclaimer', 'firm_disclaimer_wording']) {
  if (typeof vm[k] !== 'string' || !vm[k]) { console.error('VM JSON missing ' + k); process.exit(2); }
}
const FIRM = vm.firm_disclaimer_wording, TC = 'Terms & Conditions', PP = 'Privacy Policy';
if (!vm.main_disclaimer.includes('{{BUTTON}}') || ![FIRM, TC, PP].every(p => vm.main_disclaimer.includes(p))) {
  console.error('VM main_disclaimer no longer has the expected {{BUTTON}} / link phrases. Needs a human.'); process.exit(2);
}

const norm = s => s.replace(/&amp;/g, '&').replace(/&pound;/g, '£').replace(/\s+/g, ' ').trim();
const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : e.name === 'index.html' ? [path.join(d, e.name)] : []);

const problems = [], changed = [], ok = [];
for (const file of walk(ROOT)) {
  let h = fs.readFileSync(file, 'utf8');
  if (!h.includes('vmform-apply-modaal-buyers')) continue;
  const rel = path.relative(ROOT, file).split(path.sep).join('/');
  const issues = [];

  // visible disclaimer block
  const m = h.match(/(<div class="vmform-disclaimer [^>]*>)([\s\S]*?)(<\/div>)/);
  if (!m) { problems.push(`${rel}: disclaimer block not found`); continue; }
  const inner = m[2];
  const btnM = inner.match(/By clicking "([^"]*)"/);
  const btnAttr = [...h.matchAll(/class="vmform-button-text"[^>]*data-text="([^"]*)"/g)].map(x => x[1]);
  if (!btnM) { problems.push(`${rel}: no 'By clicking "…"' wording`); continue; }
  if (!btnAttr.includes(btnM[1])) issues.push(`button text "${btnM[1]}" does not match a submit button (${btnAttr.join(' | ')})`);
  const anchor = cls => { const a = inner.match(new RegExp('<a ([^>]*' + cls + '[^>]*)>')); return a ? a[1] : null; };
  const aFirm = anchor('vmform-apply-modaal-buyers'), aTc = inner.match(/<a ([^>]*href="\/terms-and-conditions\/"[^>]*)>/), aPp = inner.match(/<a ([^>]*href="\/privacy-policy\/"[^>]*)>/);
  if (!aFirm || !aTc || !aPp) { problems.push(`${rel}: one of the three links is missing`); continue; }
  const tag = (attrs, text) => `<a ${attrs}>${text}</a>`;
  let want = vm.main_disclaimer.replace('{{BUTTON}}', btnM[1]);
  want = want.replace(FIRM, tag(aFirm, FIRM)).replace(TC, tag(aTc[1], TC)).replace(PP, tag(aPp[1], PP));
  if (norm(want) !== norm(inner)) {
    const lead = inner.match(/^\s*/)[0], trail = inner.match(/\s*$/)[0];
    h = h.replace(m[0], m[1] + lead + want + trail + m[3]); issues.push('main disclaimer wording updated');
  }

  // firm pop-up wording
  const fm = h.match(/(<div id="vmform-disclaimer-buyers">)([\s\S]*?)(<\/div>)/);
  if (!fm) problems.push(`${rel}: firm pop-up (#vmform-disclaimer-buyers) not found`);
  else if (norm(fm[2]) !== norm(vm.firm_disclaimer)) { h = h.replace(fm[0], fm[1] + vm.firm_disclaimer + fm[3]); issues.push('firm pop-up wording updated'); }

  // links must be highlighted
  if (!/vmform-disclaimer a\s*\{[^}]*(text-decoration:\s*underline|font-weight:\s*(bold|[6-9]00))/.test(h)) problems.push(`${rel}: disclaimer links are not bold or underlined`);

  const text = issues.filter(i => /updated$/.test(i)), warn = issues.filter(i => !/updated$/.test(i));
  warn.forEach(w => problems.push(`${rel}: ${w}`));
  if (text.length) { changed.push(`${rel}: ${text.join(', ')}`); if (!CHECK) fs.writeFileSync(file, h); } else if (!warn.length) ok.push(rel);
}

console.log(`VM wording checked against ${ok.length + changed.length} form pages.`);
console.log(`In line: ${ok.length}. ${CHECK ? 'Out of date' : 'Updated'}: ${changed.length}.`);
changed.forEach(c => console.log('  ' + c));
if (problems.length) { console.log('NEEDS A HUMAN:'); problems.forEach(p => console.log('  ' + p)); }
process.exit(problems.length || (CHECK && changed.length) ? 1 : 0);
