// Makes the Yes/No step-form tiles neutral until chosen (owner request, 15 Nov 2026).
// Default: white tile, grey border, purple tick/cross. Hover: light purple. Chosen: solid purple, white tick/cross.
import fs from 'node:fs';
const files = process.argv.slice(2);
const WHITE = '%23fff', PURPLE = '%235B2675';
for (const f of files) {
  let s = fs.readFileSync(f, 'utf8');
  const before = s;
  // 1. default tile
  s = s.replace(
    'background:var(--ea-cta)!important;border:2px solid var(--ea-cta)!important;border-radius:6px!important;box-shadow:none!important;transform:none!important;transition:background .15s,box-shadow .15s}',
    'background:#fff!important;border:2px solid #5B2675!important;border-radius:6px!important;box-shadow:none!important;transform:none!important;transition:background .15s,border-color .15s,box-shadow .15s}'
  );
  // 2. hover: light purple tint
  s = s.replace(
    '.ea-lp .vmform .vmform-radio-item:hover .vmform-radio-item-image-box{background:var(--ea-cta-dk)!important}',
    '@media (hover:hover){.ea-lp .vmform .vmform-radio-item:hover .vmform-radio-item-image-box{background:#F3EAF7!important;border-color:var(--ea-cta)!important}}'
  );
  // 3. chosen: solid purple
  s = s.replace(
    '.ea-lp .vmform .vmform-radio-item:has(input:checked) .vmform-radio-item-image-box{background:var(--ea-cta-dk)!important;box-shadow:0 0 0 4px rgba(91,38,117,.25)!important}',
    '.ea-lp .vmform .vmform-radio-item:has(input:checked) .vmform-radio-item-image-box{background:var(--ea-cta-dk)!important;border-color:var(--ea-cta-dk)!important;box-shadow:0 0 0 4px rgba(91,38,117,.25)!important}'
  );
  // 4. icons: purple by default, white when chosen
  const yesRe = /(\.ea-lp \.vmform \.vmform-radio-item:has\(input\[value="Yes" i\]\) \.vmform-radio-item-image\{background-image:url\("data:image\/svg\+xml,[^"]*")\)!important\}/;
  const noRe = /(\.ea-lp \.vmform \.vmform-radio-item:has\(input\[value="No" i\]\) \.vmform-radio-item-image\{background-image:url\("data:image\/svg\+xml,[^"]*")\)!important\}/;
  const ym = s.match(yesRe), nm = s.match(noRe);
  if (ym && nm) {
    const yesWhite = ym[0];
    const noWhite = nm[0];
    const yesPurple = yesWhite.split(WHITE).join(PURPLE);
    const noPurple = noWhite.split(WHITE).join(PURPLE);
    const chk = (r) => r.replace(':has(input[value="Yes" i])', ':has(input[value="Yes" i]:checked)').replace(':has(input[value="No" i])', ':has(input[value="No" i]:checked)');
    s = s.replace(yesWhite, yesPurple + '\n' + chk(yesWhite));
    s = s.replace(noWhite, noPurple + '\n' + chk(noWhite));
  } else {
    console.log('icon rules not found in', f);
  }
  if (s === before) console.log('no change', f);
  else { fs.writeFileSync(f, s); console.log('updated', f); }
}
