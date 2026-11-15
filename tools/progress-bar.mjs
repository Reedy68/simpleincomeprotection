// Step form progress bar (owner request, 15 Nov 2026): step text below the bar, bar half height (10px), rounded, purple like the tiles.
// Usage: node tools/progress-bar.mjs <page.html> ...
import fs from 'node:fs';
const pairs = [
  [
    '.ea-lp .vmform .vmform-progress-bar-step-text{order:-1;font-size:22px!important;font-weight:400!important;color:#333!important;text-align:center;margin:0 0 14px!important}',
    '.ea-lp .vmform .vmform-progress-bar-step-text{order:1;font-size:18px!important;font-weight:400!important;color:#333!important;text-align:center;margin:10px 0 0!important}'
  ],
  [
    'height:20px!important;background:#F5F5F5!important;border:0!important;border-radius:0!important;box-shadow:inset 0 1px 2px rgba(0,0,0,.1)!important;overflow:hidden}',
    'height:10px!important;background:#E6E0EA!important;border:0!important;border-radius:999px!important;box-shadow:none!important;overflow:hidden}'
  ],
  [
    '.ea-lp .vmform .vmform-progress-bar-inner{height:100%!important;border-radius:0!important;background-color:var(--ea-green)!important;background-image:linear-gradient(45deg,rgba(255,255,255,.18) 25%,transparent 25%,transparent 50%,rgba(255,255,255,.18) 50%,rgba(255,255,255,.18) 75%,transparent 75%,transparent)!important;background-size:40px 40px!important;animation:ea-stripes 1.5s linear infinite;transition:width .4s ease}',
    '.ea-lp .vmform .vmform-progress-bar-inner{height:100%!important;border-radius:999px!important;background-color:var(--ea-cta)!important;background-image:none!important;animation:none;transition:width .4s ease}'
  ]
];
for (const f of process.argv.slice(2)) {
  let s = fs.readFileSync(f, 'utf8');
  let n = 0;
  for (const [a, b] of pairs) if (s.includes(a)) { s = s.replace(a, b); n++; }
  if (n === 3) { fs.writeFileSync(f, s); console.log('updated', f); }
  else console.log('only', n, 'of 3 rules matched in', f, '(already done or markup changed)');
}
