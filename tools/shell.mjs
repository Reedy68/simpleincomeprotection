// Shared page shell for every page that is not one of the two landing pages (/ and /self-employed-quote/):
// the same header band, wordmark and footer as the landing pages, plus a clean content layout.
// The landing pages' own stylesheet (the `.sip` block in public/index.html) is reused as-is by optimize.mjs;
// EXTRA_CSS adds only what the content pages need.

export const EXTRA_CSS = `
body.sp{margin:0;background:#f4f7fa}
.sip .sp-cta{background:linear-gradient(180deg,#3ab54a,#239B35);color:#fff!important;font-weight:700;font-size:15px;padding:10px 18px;border-radius:10px;text-decoration:none;box-shadow:0 3px 10px rgba(35,155,53,.28);white-space:nowrap}
.sip .sp-cta:hover{filter:brightness(1.06)}
.sip .links .sip-cc-link{background:none;border:0;padding:0;margin:0;font:inherit;font-weight:600;font-size:15px;color:var(--blue-d);cursor:pointer;text-underline-offset:3px}
.sip .links .sip-cc-link:hover{text-decoration:underline}
.sip .sp-band{background:linear-gradient(135deg,#102B45 0%,#17407a 62%,#1f5fbf 100%);color:#fff;padding:42px 0 92px}
.sip .sp-band .wrap{max-width:880px}
.sip .sp-band h1{font-family:"Plus Jakarta Sans","Inter",system-ui,sans-serif;font-weight:800;font-size:clamp(28px,4.4vw,42px);line-height:1.15;letter-spacing:-.02em;margin:0 0 10px;color:#fff}
.sip .sp-kick{font-size:12px;letter-spacing:.16em;text-transform:uppercase;font-weight:700;color:#9fe0a8;margin:0 0 12px}
.sip .sp-sub{color:#d6e3f5;margin:0;max-width:680px;font-size:18px;line-height:1.55}
.sip .sp-band .sip-bc{font:500 14px/1.4 Inter,system-ui,sans-serif;color:#bcd0ea;margin:0 0 16px}
.sip .sp-band .sip-bc a{color:#fff;text-underline-offset:3px}
.sip .sp-band .sip-bc span{margin:0 8px;color:#8fb0d8}
.sip .sp-band .sip-bc span[aria-current]{margin:0;color:#bcd0ea}
.sip .sp-main{background:#f4f7fa;padding-bottom:64px}
.sip .sp-wrap{max-width:880px;margin:0 auto;padding:0 20px}
.sip .sp-card{background:#fff;border:1px solid #e1e8ef;border-radius:18px;box-shadow:0 12px 36px rgba(16,43,69,.10);padding:40px 44px;margin-top:-56px;position:relative}
.sip .sp-card>:first-child{margin-top:0}
.sip .sp-card>:last-child{margin-bottom:0}
.sip .sp-prose{color:#2b3f55;font-size:17px;line-height:1.75}
.sip .sp-prose h2{font-family:"Plus Jakarta Sans","Inter",system-ui,sans-serif;font-weight:800;font-size:24px;line-height:1.25;letter-spacing:-.01em;color:#102B45;margin:38px 0 12px;padding-top:6px}
.sip .sp-prose h2:first-child{margin-top:0}
.sip .sp-prose h3{font-family:"Plus Jakarta Sans","Inter",system-ui,sans-serif;font-weight:700;font-size:19px;color:#1d2f46;margin:26px 0 8px}
.sip .sp-prose p{margin:0 0 16px}
.sip .sp-prose a{color:#1b6f2a;font-weight:600;text-underline-offset:3px}
.sip .sp-prose ul,.sip .sp-prose ol{margin:0 0 18px;padding-left:24px}
.sip .sp-prose li{margin:0 0 8px}
.sip .sp-prose li::marker{color:#239B35}
.sip .sp-prose hr{border:0;border-top:1px solid #e1e8ef;margin:28px 0}
.sip .sp-prose table{width:100%;border-collapse:collapse;margin:0 0 20px;font-size:15px}
.sip .sp-prose th,.sip .sp-prose td{border:1px solid #dbe4ec;padding:10px 12px;text-align:left;vertical-align:top}
.sip .sp-prose th{background:#eef3f8;color:#102B45}
.sip .sp-prose strong{color:#1d2f46}
.sip .sp-check{width:64px;height:64px;border-radius:50%;background:#239B35;display:flex;align-items:center;justify-content:center;margin:0 0 20px;box-shadow:0 0 0 8px rgba(35,155,53,.25)}
.sip .sp-check svg{width:32px;height:32px}
.sip .sp-prose .sp-steps{list-style:none;counter-reset:s;margin:18px 0 26px;padding:0;display:grid;gap:14px}
.sip .sp-steps li{counter-increment:s;position:relative;background:#f4f8fc;border:1px solid #dfe8f1;border-radius:14px;padding:18px 20px 18px 66px;margin:0;line-height:1.6}
.sip .sp-steps li::before{content:counter(s);position:absolute;left:18px;top:16px;width:34px;height:34px;border-radius:50%;background:#102B45;color:#fff;font:800 16px/34px "Plus Jakarta Sans","Inter",sans-serif;text-align:center}
.sip .sp-note{background:#fff8e1;border:1px solid #f3dd9a;border-left:5px solid #ffc21a;border-radius:12px;padding:16px 20px;margin:0 0 22px;color:#4a3b0a}
.sip .sp-note p{margin:0 0 6px}
.sip .sp-btn{display:inline-block;background:linear-gradient(180deg,#3ab54a,#239B35);color:#fff!important;font-weight:700;font-size:16px;padding:14px 26px;border-radius:12px;text-decoration:none!important;box-shadow:0 4px 12px rgba(35,155,53,.3)}
.sip .sp-btn.alt{background:#fff;color:#102B45!important;border:2px solid #102B45;box-shadow:none;margin-left:10px}
.sip .sp-mail{font-size:22px;font-weight:700;word-break:break-all}
.sip .sp-own{background:#fff}
.sip .sip{width:auto;max-width:none;left:0;right:0;margin-left:0!important;margin-right:0!important}
.sip .sp-own .sip{overflow:hidden}
.sip{--hero-a:#102B45;--hero-b:#17407a}
.sip .sp-leg .fl-row-content-wrap{padding:0!important}
.sip .sp-leg .fl-row-content{max-width:none!important}
.sip .sp-leg .fl-col-content,.sip .sp-leg .fl-module-content{margin:0!important;padding:0!important}
.sip .hero h1,.sip .fhero h1{line-height:1.12;margin-bottom:18px}
.sip .cta{background:linear-gradient(180deg,#3ab54a,#239B35);color:#fff!important;border-radius:12px;box-shadow:0 4px 12px rgba(35,155,53,.3);font-size:18px;padding:16px 30px}
.sip .cta:hover{transform:none;box-shadow:0 4px 12px rgba(35,155,53,.3);filter:brightness(1.06)}
.sip .sp-bb h1,.sip .sp-bb h2,.sip .sp-bb h3{font-family:"Plus Jakarta Sans","Inter",system-ui,sans-serif;color:#102B45;letter-spacing:-.02em}
.sip .sp-bb{font-family:Inter,system-ui,sans-serif;color:#2b3f55}
.sip .vmform,.sip .vmform label,.sip .vmform select,.sip .vmform input,.sip .vmform .vmform-label,.sip .vmform .vmform-step-title,.sip .vmform .vmform-description{font-family:Inter,system-ui,-apple-system,"Segoe UI",sans-serif!important}
.sip .vmform label,.sip .vmform .vmform-label{font-weight:600;color:#1d2f46}
.sip .vmform-button-next,.sip .vmform-button-submit{background:linear-gradient(180deg,#3ab54a,#239B35)!important;border:0!important;border-radius:12px!important;color:#fff!important;font-family:Inter,system-ui,sans-serif!important;font-size:18px!important;font-weight:700!important;box-shadow:0 4px 12px rgba(35,155,53,.3)}
.sip .sp-own .inside-article,.sip .sp-own .entry-content{margin:0;padding:0}
@media(max-width:640px){.sip .sp-card{padding:26px 20px;margin-top:-48px;border-radius:14px}.sip .sp-band{padding:30px 0 80px}.sip .top .sp-cta{padding:9px 14px;font-size:14px}.sip .sp-btn.alt{margin:10px 0 0}.sip .sp-steps li{padding:16px 16px 16px 60px}}
`;

const CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';

// pieces copied from the landing page so the chrome is identical
export function pieces(homeHtml) {
  const wm = (homeHtml.match(/<a class="se-wm"[^>]*>(<svg[\s\S]*?<\/svg>)/) || [])[1];
  const footer = (homeHtml.match(/<footer>[\s\S]*?<\/footer>/) || [])[0];
  if (!wm || !footer) throw new Error('could not find the wordmark or footer on the landing page');
  return {
    header: `<div class="top se-top"><div class="wrap"><a class="se-wm" href="/" aria-label="Simple Income Protection home">${wm}<span class="se-wt"><b>Simple <i>Income Protection</i></b><small>Income protection</small></span></a><a class="sp-cta" href="/">Get a free quote</a></div></div>`,
    footer: footer.replace(/<small>[^<]*<\/small>/, '<small>Income protection</small>').replace(/(<a class="se-wm se-wmf" href=")[^"]*"/, '$1/"'),
  };
}

const band = (kick, h1, sub, crumbs) => `<section class="sp-band"><div class="wrap">${crumbs || ''}${kick ? `<p class="sp-kick">${kick}</p>` : ''}<h1>${h1}</h1>${sub ? `<p class="sp-sub">${sub}</p>` : ''}</div></section>`;

export const page = (head, main, foot) => `<div class="sip" id="top">${head}<main id="main" class="sp-main">${main}</main>${foot}</div>`;

// plain text pages: privacy, terms, cookies, contact, tag lists
export function prose({ h1, kick, sub, crumbs, inner }) {
  return band(kick, h1, sub, crumbs) + `<div class="sp-wrap"><div class="sp-card sp-prose">${inner}</div></div>`;
}

// thank-you pages: built from the page's own paragraphs (nothing reworded)
export function thanks(ps) {
  const [h, intro, aim, s1, s2, s3, imp, bullet0] = ps; const bullet = bullet0.replace(/^[•\s]+/, '');
  return `<section class="sp-band"><div class="wrap"><div class="sp-check">${CHECK}</div><p class="sp-kick">Enquiry received</p><h1>${h}</h1><p class="sp-sub">${intro}</p></div></section>`
    + `<div class="sp-wrap"><div class="sp-card sp-prose"><p>${aim}</p><h2>What happens next</h2><ol class="sp-steps"><li>${s1}</li><li>${s2}</li><li>${s3}</li></ol><div class="sp-note"><p>${imp}</p><p>${bullet}</p></div><a class="sp-btn" href="/">Back to the home page</a></div></div>`;
}

// short message pages: /failed/ and the 404
export function message({ kick, h1, inner, buttons }) {
  return band(kick, h1, '', '') + `<div class="sp-wrap"><div class="sp-card sp-prose">${inner}<p style="margin-top:24px">${buttons}</p></div></div>`;
}
