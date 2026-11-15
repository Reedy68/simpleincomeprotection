// simpleincomeprotection.co.uk: small server layer in front of the static site.
// Same approach as simplelifecover.com (src/worker.js there).
//
// 1. POST to a page that carries the VM form  -> forwards the lead to VM (api.vmleads.co.uk) and returns VM's reply
//    unchanged, exactly as VM's own reference script does (so the browser redirects to /thank-you/ and the
//    "Form Submit Success GTM" conversion still gets its lead id).
// 2. POST /consent-log    -> records cookie-consent choices (Workers Logs).
// 3. POST /contact-submit -> not enabled (the WordPress contact form was not carried over).
// 4. Everything else (GET/HEAD) -> the static files, untouched.
//
// TEST MODE: leads are marked as TEST at VM (is_test=1) unless the request is on a live host.
//   - on any host not listed in LIVE_HOSTS (workers.dev, previews)           -> always test
//   - on a live host, add ?vmtest=1 to the page address (the form posts back to that address) -> test
//   - on a live host with no flag                                              -> LIVE lead
// No secrets are needed: VM identifies the campaign from the form's own hidden fields.

const MAX_BODY_BYTES = 100000;
const VM_TIMEOUT_MS = 20000;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === 'POST') {
      if (url.pathname === '/consent-log') return consentLog(request);
      if (url.pathname === '/contact-submit') return contactSubmit();
      return leadSubmit(request, env, url);
    }
    const res = await env.ASSETS.fetch(request);
    // Test pages (any non-live host, or ?vmtest=1): allow typing the address by hand (the Data8 lookup is locked to
    // the live domain) and show a small TEST MODE tag. Live visitors never see either.
    if (isTestRequest(url, env) && res.status === 200 && (res.headers.get('content-type') || '').includes('text/html')) return testPage(res);
    return res;
  },
};

function liveHostList(env) { return (env.LIVE_HOSTS || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean); }

function isTestRequest(url, env) {
  return url.searchParams.get('vmtest') === '1' || env.FORCE_TEST === '1' || !liveHostList(env).includes(url.hostname.toLowerCase());
}

function testPage(res) {
  return new HTMLRewriter()
    .on('input[name="postcode"]', {
      element(el) {
        const c = el.getAttribute('class') || '';
        if (!c.includes('vmform-apply-address-lookup-allow-manually')) el.setAttribute('class', (c + ' vmform-apply-address-lookup-allow-manually').trim());
      },
    })
    .on('body', {
      element(el) {
        el.append('<div id="vm-test-tag" style="position:fixed;top:0;left:0;z-index:99999;background:#b00020;color:#fff;font:700 11px/1 system-ui,sans-serif;padding:4px 8px;border-radius:0 0 6px 0;pointer-events:none">TEST MODE: leads are sent to VM as tests</div>', { html: true });
      },
    })
    .transform(res);
}

// NOTE: lead replies are sent as text/html, exactly like WordPress did: the VM form script calls JSON.parse() on the reply
// itself, and jQuery would already have parsed it (and then the form would fail) if this were labelled application/json.
const json = (obj, status = 200, extra = {}) =>
  new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', ...extra } });

// ---------- lead submission ----------
async function leadSubmit(request, env, url) {
  let params;
  try {
    const ct = request.headers.get('content-type') || '';
    if (/multipart\/form-data/i.test(ct)) {
      const fd = await request.formData();
      params = new URLSearchParams();
      for (const [k, v] of fd.entries()) if (typeof v === 'string') params.append(k, v);
    } else {
      const raw = await request.text();
      if (raw.length > MAX_BODY_BYTES) return json({ status: 'error', message: 'Request too large' }, 413);
      params = new URLSearchParams(raw);
    }
  } catch (e) {
    return json({ status: 'error', message: 'Could not read the form data' }, 400);
  }

  if (!params.get('affiliate_campaign_id')) return json({ status: 'error', message: 'Not a lead submission' }, 400);

  const failedUrl = env.FAILED_URL || '/failed/';
  const isLiveHost = liveHostList(env).includes(url.hostname.toLowerCase());
  const forcedTest = url.searchParams.get('vmtest') === '1' || env.FORCE_TEST === '1';
  const isTest = forcedTest || !isLiveHost;
  const mode = isTest ? 'test' : 'live';

  const isValidate = params.has('vmform_validate');
  let target = (env.VM_API_BASE || 'https://api.vmleads.co.uk') + '/integrations/' + (isValidate ? 'rest-validate' : 'rest');
  if (isTest) target += '?is_test=1';

  let body;
  if (isValidate) {
    // same packaging VM's WordPress plugin uses for field-level validation
    const post = phpParse(params);
    body = new URLSearchParams({ vm_is_json: '1', data: JSON.stringify({ post, fields: post.vmform_validate_fields }) });
  } else {
    body = new URLSearchParams(params);
    const ip = request.headers.get('CF-Connecting-IP');
    if (ip) body.set('vmform_ip', ip);                                   // as VM's reference script does
    if (!body.get('vmform_source')) body.set('vmform_source', env.DEFAULT_SOURCE || 'ppcsearch'); // broker-approved source
  }

  // Referer: the page address. On test hosts use the registered site origin so VM sees the domain it knows.
  const referer = isLiveHost ? request.url : ((env.REFERER_ORIGIN || 'https://simpleincomeprotection.co.uk') + url.pathname);

  const meta = { evt: 'lead', mode, validate: isValidate, path: url.pathname, campaign: params.get('affiliate_campaign_id'), formid: params.get('vmform_formid'), step: params.get('vmform_step'), action: params.get('vmform_ajax_action') };
  try {
    const res = await fetch(target, {
      method: 'POST',
      body,
      headers: { 'content-type': 'application/x-www-form-urlencoded', referer },
      redirect: 'follow',
      signal: AbortSignal.timeout(VM_TIMEOUT_MS),
    });
    const text = (await res.text()).trim();
    let parsed = null; try { parsed = JSON.parse(text); } catch (e) { /* not JSON */ }
    console.log(JSON.stringify({ ...meta, vmHttp: res.status, vmStatus: parsed && parsed.status, hasLeadId: !!(parsed && parsed.lead_id) }));
    if (isValidate && res.status >= 200 && res.status < 300 && parsed && typeof parsed === 'object') {
      // VM's validator returns an empty status when nothing is wrong; VM's own plugin turns that into "success"
      // (the form only moves on to the real submit when it sees "success").
      const out = { status: parsed.status || 'success', message: parsed.message || '', field_errors: parsed.field_errors && Object.keys(parsed.field_errors).length ? parsed.field_errors : [] };
      return json(out, 200, { 'x-lead-mode': mode });
    }
    if (res.status >= 200 && res.status < 300 && parsed && typeof parsed === 'object') {
      return new Response(text, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-lead-mode': mode } });
    }
    return json({ status: 'warning', message: '', field_errors: [], redirect: failedUrl }, 200, { 'x-lead-mode': mode });
  } catch (e) {
    console.log(JSON.stringify({ ...meta, error: String(e && e.message || e).slice(0, 160) }));
    return json({ status: 'warning', message: '', field_errors: [], redirect: failedUrl }, 200, { 'x-lead-mode': mode });
  }
}

// PHP-style query parsing: a[b][c]=1&d[]=2 -> nested object/array
function phpParse(params) {
  const out = {};
  for (const [key, value] of params.entries()) {
    const m = key.match(/^([^\[]+)((?:\[[^\]]*\])*)$/);
    if (!m) { out[key] = value; continue; }
    const path = [m[1], ...[...m[2].matchAll(/\[([^\]]*)\]/g)].map(x => x[1])];
    let cur = out;
    for (let i = 0; i < path.length; i++) {
      const last = i === path.length - 1; let k = path[i];
      if (k === '') { k = Array.isArray(cur) ? cur.length : Object.keys(cur).length; }
      if (last) { cur[k] = value; }
      else {
        if (cur[k] === undefined || typeof cur[k] !== 'object') cur[k] = path[i + 1] === '' ? [] : {};
        cur = cur[k];
      }
    }
  }
  return out;
}

// ---------- consent audit trail ----------
async function consentLog(request) {
  try {
    const text = await request.text();
    if (text.length > 5000) return new Response(null, { status: 413 });
    const d = JSON.parse(text);
    console.log(JSON.stringify({ evt: 'consent', ts: d.ts, event: d.event, consentId: d.consentId, revision: d.revision, categories: d.categories, policyVersion: d.policyVersion, url: d.url }));
  } catch (e) { /* ignore bad input */ }
  return new Response(null, { status: 204 });
}

// ---------- contact form (not enabled) ----------
function contactSubmit() {
  const html = '<!doctype html><html lang="en-GB"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Contact form unavailable</title>' +
    '<body style="font-family:system-ui,sans-serif;max-width:560px;margin:60px auto;padding:0 18px;color:#1d2f46"><h1>Sorry, the contact form is not available</h1>' +
    '<p>You can still <a href="/income-protection/get-quote/">get a free quote</a>.</p></body></html>';
  return new Response(html, { status: 503, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
}
