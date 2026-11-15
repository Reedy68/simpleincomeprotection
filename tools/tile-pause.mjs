// Adds the "chosen tile" pause (owner request, 15 Nov 2026): CSS for .ea-picked plus the ea-tiles.js script tag.
// Run after neutral-tiles.mjs:  node tools/tile-pause.mjs <page.html> ...
import fs from 'node:fs';
for (const f of process.argv.slice(2)) {
  let s = fs.readFileSync(f, 'utf8');
  if (s.includes('ea-picked')) { console.log('already', f); continue; }
  const box = '.ea-lp .vmform .vmform-radio-item.ea-picked .vmform-radio-item-image-box{background:var(--ea-cta-dk)!important;border-color:var(--ea-cta-dk)!important;box-shadow:0 0 0 4px rgba(91,38,117,.25)!important}';
  const yes = s.match(/\.ea-lp \.vmform \.vmform-radio-item:has\(input\[value="Yes" i\]:checked\) \.vmform-radio-item-image\{[^}]*\}/);
  const no = s.match(/\.ea-lp \.vmform \.vmform-radio-item:has\(input\[value="No" i\]:checked\) \.vmform-radio-item-image\{[^}]*\}/);
  if (!yes || !no) { console.log('icon rules not found', f); continue; }
  const pk = (r) => r.replace('.vmform-radio-item:has(', '.vmform-radio-item.ea-picked:has(').replace(':checked)', ')');
  s = s.replace(no[0], no[0] + '\n' + box + '\n' + pk(yes[0]) + '\n' + pk(no[0]));
  const tag = '<script defer src="/wp-content/plugins/vmforms/public/js/public-ebdcf4ec0e.js"';
  const i = s.indexOf(tag);
  if (i < 0) { console.log('script tag not found', f); continue; }
  const end = s.indexOf('>', i) + 1;
  const closeIdx = s.indexOf('</script>', end) + '</script>'.length;
  s = s.slice(0, closeIdx) + '\n<script defer src="/assets/js/ea-tiles.js"></script>' + s.slice(closeIdx);
  fs.writeFileSync(f, s);
  console.log('updated', f);
}
