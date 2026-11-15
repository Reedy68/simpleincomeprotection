// Restyles the "FCA authorised equity release firms" pop-up (owner request, 15 Nov 2026): compact card, firm list with ticks,
// purple close button. Run: node tools/firms-popup.mjs <page.html> ...
// The pop-up text itself is refreshed daily from VM's feed by src/worker.js (buildFirmHtml uses the same markup).
import fs from 'node:fs';
const CSS = '.modaal-wrapper .modaal-container:has(.ea-firms){width:calc(100% - 32px)!important;max-width:400px!important;height:auto!important;min-height:0!important;border-radius:14px!important;box-shadow:0 18px 50px rgba(10,24,38,.35)!important;overflow:visible!important}' +
  '.modaal-container:has(.ea-firms) .modaal-content-container{padding:24px 24px 22px!important;font-size:16px!important;line-height:1.5!important;color:#1F2D3A}' +
  '.ea-firms p{margin:0 0 12px;font-size:16px;line-height:1.5;color:#1F2D3A}' +
  '.ea-firms ul{margin:0;padding:0;list-style:none}' +
  '.ea-firms li{position:relative;margin:0;padding:10px 0 10px 30px;border-top:1px solid #E4ECF2;font-size:16px;font-weight:700;color:#14304A}' +
  '.ea-firms li:before{content:"";position:absolute;left:3px;top:50%;width:13px;height:7px;border-left:3px solid #5B2675;border-bottom:3px solid #5B2675;transform:translateY(-75%) rotate(-45deg)}' +
  '.modaal-wrapper.modaal-inline .modaal-container:has(.ea-firms) button.modaal-close#modaal-close{top:-14px!important;right:-14px!important;width:32px!important;height:32px!important;background:#5B2675!important;border-radius:50%!important;box-shadow:0 2px 8px rgba(0,0,0,.3)!important}' +
  '.modaal-container:has(.ea-firms) .modaal-close:hover,.modaal-container:has(.ea-firms) .modaal-close:focus{background:#46195C!important}';
for (const f of process.argv.slice(2)) {
  let s = fs.readFileSync(f, 'utf8');
  if (s.includes('.ea-firms')) { console.log('already', f); continue; }
  const anchor = '.ea-hero{padding:18px 0 78px}';
  if (!s.includes(anchor)) { console.log('css anchor not found', f); continue; }
  s = s.replace(anchor, CSS + anchor);
  // static fallback markup (used if VM's feed is unreachable)
  const re = /(<div id="vmform-disclaimer-buyers">)([^]*?)(<\/div>)/;
  const m = s.match(re);
  if (!m) { console.log('buyers div not found', f); continue; }
  const parts = m[2].split(/<br\s*\/?>/i).map(x => x.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()).filter(Boolean);
  const html = '<div class="ea-firms"><p>' + parts[0] + '</p><ul>' + parts.slice(1).map(x => '<li>' + x + '</li>').join('') + '</ul></div>';
  s = s.replace(re, '$1' + html + '$3');
  fs.writeFileSync(f, s);
  console.log('updated', f, '(' + (parts.length - 1) + ' firms)');
}
