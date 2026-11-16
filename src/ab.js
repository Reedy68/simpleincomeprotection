// Generic split-test module (used by this site's Worker; written so other Blab Media sites can reuse it).
//
// A/B test on one landing-page address: visitors get version A (the page as it is) or version B (another page's
// content) at the SAME address, so ads, keywords and bids stay untouched.
//   - Each lead carries a label in the form's hidden vmform_lp1id field:  AB:<test>:<A|B>
//   - Events (view / start / submit) are written to the D1 table `events`. No personal data is stored.
//   - Known bots always get version A and are never counted. Test traffic (non-live host or ?vmtest=1) is never counted.
// Configuration (wrangler vars): AB_ENABLED ("1" to run), AB_SITE, AB_TEST, AB_PATH, AB_B_PATH, AB_SPLIT (% to B).
// Secret: DASH_PASSWORD (dashboard at /ab-dashboard/). Nothing here may ever block a lead: every DB call is guarded.

const BOT_RE = /bot|crawl|spider|slurp|facebookexternalhit|headless|lighthouse|pagespeed|preview|monitor|uptime|curl|wget|python|go-http|httpclient|axios|node-fetch|scrapy|ahrefs|semrush|mj12|dotbot|adsbot|mediapartners|apis-google|validator|scanner|zgrab|masscan|nmap|nikto|censys|expanse/i;
export const isBot = ua => !ua || BOT_RE.test(ua);
const deviceOf = ua => (/mobi|android|iphone|ipad/i.test(ua || '') ? 'mobile' : 'desktop');
const LABEL_RE = /^AB:([A-Za-z0-9_-]{1,60}):([AB])$/;

export function abConfig(env) {
  const split = parseInt(env.AB_SPLIT || '50', 10);
  return {
    enabled: env.AB_ENABLED === '1',
    site: env.AB_SITE || '',
    test: env.AB_TEST || '',
    path: env.AB_PATH || '/life-quote/',           // the address visitors/ads use (fixed)
    aPath: env.AB_A_PATH || env.AB_PATH || '/life-quote/',   // page shown as version A
    bPath: env.AB_B_PATH || '/get-quote/',         // page shown as version B
    split: Number.isFinite(split) ? Math.min(100, Math.max(0, split)) : 50,
  };
}

export const parseLabel = v => { const m = LABEL_RE.exec(String(v || '')); return m ? { test: m[1], variant: m[2] } : null; };

// Test name follows the two pages, so changing a page starts a fresh test (old data stays viewable).
const slug = p => String(p).replace(/^\/+|\/+$/g, '').replace(/[^A-Za-z0-9_-]+/g, '-').slice(0, 28) || 'home';
export const testName = (a, b) => `${slug(a)}-vs-${slug(b)}`;

// Settings saved from the dashboard (table ab_config) override the wrangler defaults. Cached for 10 seconds, so a
// change (including the off switch) reaches every visitor within about 10 seconds. Any database problem falls back to
// the wrangler defaults, so serving never breaks.
let cfgCache = { t: 0, v: null };
export const clearConfigCache = () => { cfgCache = { t: 0, v: null }; };
export async function getAbConfig(env) {
  const now = Date.now();
  if (cfgCache.v && now - cfgCache.t < 10000) return cfgCache.v;
  const cfg = abConfig(env);
  try {
    if (env.DB && cfg.site) {
      await ensureSchema(env);
      const row = await env.DB.prepare('SELECT enabled, split, a_path, b_path, started, stopped FROM ab_config WHERE site = ?').bind(cfg.site).first();
      if (row) {
        cfg.enabled = !!row.enabled;
        cfg.split = Math.min(100, Math.max(0, Number(row.split) || 0));
        cfg.aPath = row.a_path; cfg.bPath = row.b_path;
        cfg.path = row.a_path;   // the control page is the address visitors (and the ads) use
        cfg.started = row.started || null; cfg.stopped = row.stopped || null;
        cfg.test = testName(cfg.aPath, cfg.bPath);
      }
    }
  } catch (e) { console.log(JSON.stringify({ evt: 'ab-config-error', error: String(e && e.message || e).slice(0, 160) })); }
  cfgCache = { t: now, v: cfg };
  return cfg;
}

// ---------- database ----------
let schemaReady = null;
function ensureSchema(env) {
  if (!schemaReady) {
    schemaReady = env.DB.batch([
      env.DB.prepare('CREATE TABLE IF NOT EXISTS events (id INTEGER PRIMARY KEY AUTOINCREMENT, ts INTEGER NOT NULL, site TEXT NOT NULL, test TEXT NOT NULL, variant TEXT NOT NULL, event TEXT NOT NULL, device TEXT, outcome TEXT, reason TEXT)'),
      env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_events_lookup ON events (site, test, ts)'),
      env.DB.prepare('CREATE TABLE IF NOT EXISTS ab_config (site TEXT PRIMARY KEY, enabled INTEGER NOT NULL, split INTEGER NOT NULL, a_path TEXT NOT NULL, b_path TEXT NOT NULL, updated INTEGER)'),
    ]).then(async () => {
      // Run times (added 16 Nov 2026): started = when Run was pressed (counting starts then), stopped = when it was stopped.
      const cols = ((await env.DB.prepare('PRAGMA table_info(ab_config)').all()).results || []).map(c => c.name);
      for (const c of ['started', 'stopped']) if (!cols.includes(c)) { try { await env.DB.prepare('ALTER TABLE ab_config ADD COLUMN ' + c + ' INTEGER').run(); } catch (e) { /* another isolate added it */ } }
    }).catch(e => { schemaReady = null; throw e; });
  }
  return schemaReady;
}

export function logEvent(env, ctx, e) {
  if (!env.DB) return;
  const job = (async () => {
    try {
      await ensureSchema(env);
      await env.DB.prepare('INSERT INTO events (ts, site, test, variant, event, device, outcome, reason) VALUES (?,?,?,?,?,?,?,?)')
        .bind(Date.now(), e.site, e.test, e.variant, e.event, e.device || null, e.outcome || null, e.reason ? String(e.reason).slice(0, 60) : null).run();
    } catch (err) { console.log(JSON.stringify({ evt: 'ab-log-error', error: String(err && err.message || err).slice(0, 160) })); }
  })();
  if (ctx && ctx.waitUntil) ctx.waitUntil(job);
}

// Save a site's test settings. Pressing Run (switching on, or changing either page while on) starts a new run: counting
// restarts from that moment. Switching off records when the run stopped; its figures stay viewable.
export async function writeRun(env, site, { enabled, split, a, b }) {
  await ensureSchema(env);
  const now = Date.now();
  const row = await env.DB.prepare('SELECT enabled, a_path, b_path, started, stopped FROM ab_config WHERE site = ?').bind(site).first();
  const fresh = enabled && (!row || !row.enabled || row.a_path !== a || row.b_path !== b);
  const started = fresh ? now : (row ? row.started || null : null);
  const stopped = enabled ? null : (row && row.enabled ? now : (row ? row.stopped || null : null));
  await env.DB.prepare('INSERT INTO ab_config (site, enabled, split, a_path, b_path, updated, started, stopped) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(site) DO UPDATE SET enabled=excluded.enabled, split=excluded.split, a_path=excluded.a_path, b_path=excluded.b_path, updated=excluded.updated, started=excluded.started, stopped=excluded.stopped')
    .bind(site, enabled ? 1 : 0, split, a, b, now, started, stopped).run();
  clearConfigCache();
  return { started, stopped };
}

export const abSchema = env => ensureSchema(env);

// GET /ab-ping: lets the Ads Intelligence dashboard check that this site has the split code (no personal data).
export async function abPing(env) {
  const c = await getAbConfig(env);
  return new Response(JSON.stringify({ ab: 1, site: c.site, on: c.enabled ? 1 : 0 }), { headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
}

// ---------- serving the split ----------
export function isAbPath(url, cfg) {
  const p = url.pathname.endsWith('/') ? url.pathname : url.pathname + '/';
  return !!cfg.site && !!cfg.test && p === cfg.path;
}

// Returns { variant, count } or null when the split should not apply (the page is then served exactly as before).
export function chooseVariant(request, url, cfg, isTest) {
  const forced = url.searchParams.get('ab');
  const canForce = isTest && (forced === 'A' || forced === 'B');
  if (!cfg.enabled && !canForce) return null;
  const ua = request.headers.get('user-agent') || '';
  if (isBot(ua) && !canForce) return null;                      // bots always get the normal page, never counted
  const variant = canForce ? forced : (Math.random() * 100 < cfg.split ? 'B' : 'A');
  return { variant, count: !isTest, device: deviceOf(ua) };
}

const BEACON = '<script>(function(){var f=document.querySelector(".vmform"),d=document.body.getAttribute("data-ab");if(!f||!d)return;var s=0;function go(){if(s)return;s=1;try{navigator.sendBeacon("/ab-event",new Blob([JSON.stringify({e:"start",l:d})],{type:"text/plain"}))}catch(x){}}f.addEventListener("pointerdown",go,{once:true});f.addEventListener("keydown",go,{once:true})})()</script>';

export function labelPage(res, cfg, variant) {
  const label = `AB:${cfg.test}:${variant}`;
  const out = new HTMLRewriter()
    .on('input[name="vmform_lp1id"]', { element(el) { el.setAttribute('value', label); } })
    .on('body', { element(el) { el.setAttribute('data-ab', label); el.append(BEACON, { html: true }); } })
    .transform(res);
  const headers = new Headers(out.headers);
  headers.set('cache-control', 'private, no-store');
  headers.set('x-ab-variant', variant);
  return new Response(out.body, { status: out.status, headers });
}

// POST /ab-event  (form-start beacon)
export async function handleBeacon(request, env, ctx, url, liveHosts) {
  try {
    const text = await request.text();
    if (text.length > 400) return new Response(null, { status: 413 });
    const d = JSON.parse(text);
    const label = parseLabel(d && d.l);
    const cfg = abConfig(env);
    const ua = request.headers.get('user-agent') || '';
    const isLive = liveHosts.includes(url.hostname.toLowerCase()) && !/[?&]vmtest=1/.test(request.headers.get('referer') || '');
    if (label && d.e === 'start' && isLive && !isBot(ua)) {
      logEvent(env, ctx, { site: cfg.site, test: label.test, variant: label.variant, event: 'start', device: deviceOf(ua) });
    }
  } catch (e) { /* ignore */ }
  return new Response(null, { status: 204 });
}

// ---------- dashboard ----------
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pct = (n, d) => (d > 0 ? (100 * n / d) : 0);
const f1 = x => (Math.round(x * 10) / 10).toFixed(1);
const nf = n => Number(n || 0).toLocaleString('en-GB');
function phi(z) { // standard normal CDF
  const t = 1 / (1 + 0.2316419 * Math.abs(z)), d = 0.3989423 * Math.exp(-z * z / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return z > 0 ? 1 - p : p;
}

export function authorised(request, env) {
  const pw = env.DASH_PASSWORD;
  if (!pw) return null; // not configured
  const h = request.headers.get('authorization') || '';
  if (!h.startsWith('Basic ')) return false;
  let given = '';
  try { given = atob(h.slice(6)).split(':').slice(1).join(':'); } catch (e) { return false; }
  if (given.length !== pw.length) return false;
  let diff = 0; for (let i = 0; i < pw.length; i++) diff |= given.charCodeAt(i) ^ pw.charCodeAt(i);
  return diff === 0;
}

const PAGE_RE = /^\/[A-Za-z0-9\/_-]*\/$/;
const candidatePages = env => (env.AB_PAGES || '/life-quote/,/get-quote/,/your-life-quote/,/your-life-quote-c/').split(',').map(s => s.trim()).filter(Boolean);

// Save the controls (POST from the dashboard). Returns a short message to show at the top.
async function saveSettings(request, env, url) {
  const origin = request.headers.get('origin');
  if (origin && origin !== url.origin) return 'Rejected: the request came from another site.';
  const base = abConfig(env);
  if (!base.site) return 'No site configured.';
  const f = await request.formData();
  const val = k => String(f.get(k) || '').trim();
  if (val('reset') === '1') {
    const t = val('test');
    if (!/^[A-Za-z0-9_-]{1,70}$/.test(t)) return 'Nothing reset: unknown test name.';
    const r = await env.DB.prepare('DELETE FROM events WHERE site = ? AND test = ?').bind(base.site, t).run();
    return `Reset done: all counts for ${t} were cleared (${(r.meta && r.meta.changes) || 0} records). Counting starts again from zero.`;
  }
  const norm = p => { p = p.startsWith('/') ? p : '/' + p; return p.endsWith('/') ? p : p + '/'; };
  const a = norm(val('a_custom') || val('a_path')), b = norm(val('b_custom') || val('b_path'));
  const split = Math.round(Number(val('split')));
  const enabled = val('enabled') === '1' ? 1 : 0;
  if (!PAGE_RE.test(a) || !PAGE_RE.test(b)) return 'Page addresses can only contain letters, numbers, dashes and slashes, for example /get-quote/. Got A=' + a + ' B=' + b + '.';
  if (a === b) return 'Pages A and B must be different.';
  if (!(split >= 1 && split <= 99)) return 'The split must be between 1 and 99.';
  for (const p of [a, b]) {
    try {
      const r = await env.ASSETS.fetch(new Request(new URL(p, url).toString()));
      if (r.status !== 200 || !(r.headers.get('content-type') || '').includes('text/html')) return `${p} is not a working page on this site, so nothing was saved.`;
      const html = await r.text();
      if (!html.includes('name="vmform_lp1id"')) return `${p} has no lead form, so nothing was saved.`;
    } catch (e) { return `Could not check ${p}, so nothing was saved.`; }
  }
  await writeRun(env, base.site, { enabled, split, a, b });
  clearConfigCache();
  return enabled ? `Saved. The test is ON: ${a} (A) against ${b} (B), ${split}% to B. It reaches visitors within about 10 seconds.` : 'Saved. The test is OFF: everyone sees the normal page.';
}

export async function dashboard(request, env, url) {
  const auth = authorised(request, env);
  if (auth === null) return new Response('Dashboard not set up yet: add the DASH_PASSWORD secret to this Worker.', { status: 503 });
  if (!auth) return new Response('Password needed', { status: 401, headers: { 'www-authenticate': 'Basic realm="Split tests", charset="UTF-8"', 'cache-control': 'no-store' } });
  if (!env.DB) return new Response('Database not bound (binding name DB).', { status: 503 });

  await ensureSchema(env);
  let notice = '';
  if (request.method === 'POST') notice = await saveSettings(request, env, url);
  const pairs = (await env.DB.prepare('SELECT DISTINCT site, test FROM events ORDER BY site, test').all()).results || [];
  clearConfigCache();
  const cfg = await getAbConfig(env);
  if (cfg.site && cfg.test && !pairs.some(p => p.site === cfg.site && p.test === cfg.test)) pairs.unshift({ site: cfg.site, test: cfg.test });
  const site = url.searchParams.get('site') || (pairs[0] && pairs[0].site) || '';
  const sitePairs = pairs.filter(p => p.site === site);
  const test = url.searchParams.get('test') || (sitePairs[0] && sitePairs[0].test) || '';
  const days = [7, 14, 30, 90].includes(parseInt(url.searchParams.get('days'), 10)) ? parseInt(url.searchParams.get('days'), 10) : 14;
  const since = Date.now() - days * 86400000;
  const embed = url.searchParams.get('embed') === '1';
  const act = embed ? '/ab-dashboard/?embed=1' : '/ab-dashboard/';

  const rows = (await env.DB.prepare("SELECT variant, event, outcome, reason, device, strftime('%Y-%m-%d', ts/1000, 'unixepoch') AS day, COUNT(*) AS n FROM events WHERE site=? AND test=? AND ts>=? GROUP BY 1,2,3,4,5,6")
    .bind(site, test, since).all()).results || [];

  const blank = () => ({ views: 0, starts: 0, submits: 0, accepted: 0, rejected: 0 });
  const tot = { A: blank(), B: blank() }, dev = { mobile: { A: blank(), B: blank() }, desktop: { A: blank(), B: blank() } };
  const daily = {}, reasons = { A: {}, B: {} };
  for (const r of rows) {
    const v = r.variant; if (v !== 'A' && v !== 'B') continue;
    const add = o => {
      if (r.event === 'view') o.views += r.n;
      else if (r.event === 'start') o.starts += r.n;
      else if (r.event === 'submit') { o.submits += r.n; if (r.outcome === 'accepted') o.accepted += r.n; else o.rejected += r.n; }
    };
    add(tot[v]); if (dev[r.device]) add(dev[r.device][v]);
    daily[r.day] = daily[r.day] || { A: blank(), B: blank() }; add(daily[r.day][v]);
    if (r.event === 'submit' && r.outcome !== 'accepted') reasons[v][r.reason || r.outcome || 'other'] = (reasons[v][r.reason || r.outcome || 'other'] || 0) + r.n;
  }

  const rA = pct(tot.A.accepted, tot.A.views), rB = pct(tot.B.accepted, tot.B.views);
  let pB = null, verdict = 'Waiting for data. Nothing has been counted yet.', tone = 'neutral';
  if (tot.A.views >= 30 && tot.B.views >= 30) {
    const pa = tot.A.accepted / tot.A.views, pb = tot.B.accepted / tot.B.views;
    const pool = (tot.A.accepted + tot.B.accepted) / (tot.A.views + tot.B.views);
    const se = Math.sqrt(pool * (1 - pool) * (1 / tot.A.views + 1 / tot.B.views)) || 1e-9;
    pB = phi((pb - pa) / se);
    const enough = tot.A.accepted + tot.B.accepted >= 40 && Math.min(tot.A.views, tot.B.views) >= 200;
    const lead = pB >= 0.5 ? 'B' : 'A', conf = Math.round(100 * (pB >= 0.5 ? pB : 1 - pB));
    if (!enough) { verdict = `Too early to call. ${lead} is ahead, about ${conf}% likely to be better, but the sample is still small.`; tone = 'neutral'; }
    else if (conf >= 95) { verdict = `${lead} is the winner, about ${conf}% likely to be the better page.`; tone = 'good'; }
    else { verdict = `${lead} is ahead, about ${conf}% likely to be better. Keep running for a firmer call.`; tone = 'accent'; }
  } else if (tot.A.views + tot.B.views > 0) { verdict = 'Too early to call. Each page needs at least 30 visitors before any comparison is shown.'; }

  const labels = Object.keys(daily).sort();
  const series = v => labels.map(d => daily[d][v].views ? Math.round(1000 * daily[d][v].accepted / daily[d][v].views) / 10 : null);
  const trow = (name, t) => `<tr><td>${name}</td><td>${nf(t.views)}</td><td>${nf(t.starts)}</td><td>${nf(t.submits)}</td><td>${nf(t.accepted)}</td><td>${nf(t.rejected)}</td><td><b>${f1(pct(t.accepted, t.views))}%</b></td></tr>`;
  const devLine = d => `A ${f1(pct(dev[d].A.accepted, dev[d].A.views))}% (${nf(dev[d].A.views)}) · B <b>${f1(pct(dev[d].B.accepted, dev[d].B.views))}%</b> (${nf(dev[d].B.views)})`;
  const reasonLine = v => { const e = Object.entries(reasons[v]).sort((a, b) => b[1] - a[1]).slice(0, 3); return e.length ? e.map(([k, n]) => `${esc(k)} ${n}`).join(', ') : 'none'; };
  const optSite = [...new Set(pairs.map(p => p.site))].map(s => `<option${s === site ? ' selected' : ''}>${esc(s)}</option>`).join('');
  const optTest = sitePairs.map(p => `<option${p.test === test ? ' selected' : ''}>${esc(p.test)}</option>`).join('');
  const optDays = [7, 14, 30, 90].map(d => `<option value="${d}"${d === days ? ' selected' : ''}>Last ${d} days</option>`).join('');
  const diff = rB - rA;
  const running = cfg.enabled && cfg.site === site && cfg.test === test;
  const pageOpts = cur => [...new Set([cur, ...candidatePages(env)])].map(p => `<option value="${esc(p)}"${p === cur ? ' selected' : ''}>${esc(p)}</option>`).join('');
  const hid = (k, v) => `<input type="hidden" name="${k}" value="${esc(v)}">`;
  const controls = `<h2>Test settings</h2>${notice ? `<div class="verdict accent" style="margin-bottom:10px">${esc(notice)}</div>` : ''}
<div class="card"><form method="post" action="${act}" class="statusrow">${hid('enabled', cfg.enabled ? '0' : '1')}${hid('a_path', cfg.aPath)}${hid('b_path', cfg.bPath)}${hid('split', cfg.split)}<div><p class="l" style="margin:0">Test status</p><p class="s" style="margin:2px 0 0">${cfg.enabled ? cfg.split + '% of visitors see page B' : 'Everyone sees the normal page'}</p></div><button class="sw ${cfg.enabled ? 'on' : 'off'}" type="submit" title="${cfg.enabled ? 'Turn the test off' : 'Turn the test on'}"><span class="dot"></span>${cfg.enabled ? 'On' : 'Off'}<span class="knob"></span></button></form>
<form method="post" action="${act}" style="display:block;margin:0">${hid('enabled', cfg.enabled ? '1' : '0')}
<p class="l" style="margin:0 0 4px">Address visitors use (fixed)</p><p style="margin:0 0 10px;color:#fff">${esc(cfg.site)}${esc(cfg.path)}</p>
<div class="tiles"><div style="flex:1;min-width:150px"><p class="l" style="margin:0 0 4px">Page A (control)</p><select name="a_path" style="width:100%">${pageOpts(cfg.aPath)}</select><input class="tx" name="a_custom" placeholder="or type another page, e.g. /my-page/"></div>
<div style="flex:1;min-width:150px"><p class="l" style="margin:0 0 4px">Page B (challenger)</p><select name="b_path" style="width:100%">${pageOpts(cfg.bPath)}</select><input class="tx" name="b_custom" placeholder="or type another page, e.g. /my-page/"></div>
<div style="flex:0 0 110px"><p class="l" style="margin:0 0 4px">Share to B</p><select name="split" style="width:100%">${[10, 20, 30, 40, 50, 60, 70, 80, 90].map(n => `<option value="${n}"${n === Number(cfg.split) ? ' selected' : ''}>${n}%</option>`).join('')}</select></div></div>
<div class="btnrow"><button class="sv" type="submit">Save settings</button><button class="sv danger" type="submit" form="ab-reset">Reset counts for this test</button></div></form>
<form method="post" action="${act}" id="ab-reset" style="display:none" onsubmit="return confirm('Clear ALL counts for this test (' + this.test.value + ')? This cannot be undone.')">${hid('reset', '1')}${hid('test', test)}</form>
<p class="s" style="margin:8px 0 0">Changing a page starts a new test (new name, new numbers). Older tests stay available in the test list above. Every page must contain the lead form.</p></div>`;

  const gauge = (value, max, color, big, label) => {
    const frac = Math.max(0, Math.min(1, max > 0 ? value / max : 0)), L = Math.PI * 38;
    return `<div class="g"><svg viewBox="0 0 100 58" width="100%" role="img" aria-label="${esc(label)} ${esc(big)}"><path d="M12 50 A38 38 0 0 1 88 50" fill="none" stroke="#1c2d4a" stroke-width="9" stroke-linecap="round"/><path d="M12 50 A38 38 0 0 1 88 50" fill="none" stroke="${color}" stroke-width="9" stroke-linecap="round" stroke-dasharray="${f1(L * frac)} ${f1(L)}"/></svg><p class="gv">${esc(big)}</p><p class="gl">${esc(label)}</p></div>`;
  };
  const gMax = Math.max(10, Math.ceil(Math.max(rA, rB) * 1.5 / 5) * 5);
  const confTxt = pB == null ? 'n/a' : Math.round(100 * (pB >= 0.5 ? pB : 1 - pB)) + '%';
  const confLead = pB == null ? '' : (pB >= 0.5 ? 'B' : 'A');
  const diffCls = diff > 0 ? 'up' : diff < 0 ? 'down' : '';

  const html = `<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Split tests</title><link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>:root{--bg:#0c0f14;--card:#141820;--line:#2a3040;--ink:#e8e6e1;--mut:#9b9a95;--blue:#4a9eff;--bluebg:#4a9eff1f;--red:#f87171;--redbg:#f871711f;--grn:#34d399;--grnbg:#34d3991f}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:14px/1.45 'DM Sans',system-ui,-apple-system,Segoe UI,Roboto,sans-serif}body.embed .top,body.embed .nav{display:none}.g svg{max-width:210px}.statusrow{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:0 0 14px;margin:0 0 14px;border-bottom:1px solid var(--line)}.sw{width:auto;display:inline-flex;align-items:center;gap:8px;border-radius:999px;padding:6px 6px 6px 14px;font:600 13px 'DM Sans',system-ui,sans-serif;cursor:pointer;border:1px solid;transition:background .15s}.sw .dot{width:8px;height:8px;border-radius:50%;background:currentColor;box-shadow:0 0 0 3px rgba(255,255,255,.06)}.sw .knob{width:34px;height:20px;border-radius:999px;position:relative;background:rgba(255,255,255,.08);margin-left:4px}.sw .knob:after{content:"";position:absolute;top:2px;width:16px;height:16px;border-radius:50%;background:currentColor;transition:left .15s}.sw.on .knob:after{left:16px}.sw.off .knob:after{left:2px}.sw.on{background:#34d3991a;color:#34d399;border-color:#34d39966}.sw.off{background:#f871711a;color:#f87171;border-color:#f8717166}.sw:hover{filter:brightness(1.15)}.btnrow{display:flex;gap:10px;flex-wrap:wrap;margin-top:14px}.sv{width:auto;margin:0;padding:9px 18px;border-radius:8px;font:500 13px 'DM Sans',system-ui,sans-serif;cursor:pointer;background:#4a9eff;border:1px solid #4a9eff;color:#fff}.sv:hover{filter:brightness(1.1)}.sv.danger{background:transparent;border-color:#f8717166;color:#f87171;margin-left:auto}.sv.danger:hover{background:#f871711a}body.embed{background:#0c0f14}body.embed .w{max-width:none;margin:0;padding:0 0 24px}body.embed h2{text-align:left;font:600 12px/1.4 'DM Sans',sans-serif;letter-spacing:1.4px;color:#9b9a95;margin:28px 0 10px}body.embed h2:first-of-type{margin-top:6px}body.embed .gs{display:none}body.embed form{gap:8px}body.embed select{background:#141820;border:1px solid #2a3040;border-radius:8px;color:#e8e6e1;font:13px 'DM Sans',sans-serif;padding:7px 10px}body.embed .tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px}body.embed .t,body.embed .t.a,body.embed .t.b,body.embed .t.up,body.embed .t.down{text-align:left;background:#141820;border:1px solid #2a3040;border-radius:12px;padding:12px 14px}body.embed .t.b{border-top:2px solid #4a9eff}body.embed .t.a{border-top:2px solid #9b9a95}body.embed .t.up{border-top:2px solid #34d399}body.embed .t.down{border-top:2px solid #f87171}body.embed .l{font:500 11px 'DM Sans',sans-serif;letter-spacing:.8px;color:#6a6965;text-transform:uppercase}body.embed .n,body.embed .t.b .n{font-size:24px;font-weight:700;color:#e8e6e1}body.embed .t.up .n{color:#34d399}body.embed .t.down .n{color:#f87171}body.embed .s{font:12px 'DM Mono',ui-monospace,monospace;color:#6a6965}body.embed .card{background:#141820;border:1px solid #2a3040;border-radius:12px;padding:14px 16px}body.embed .verdict,body.embed .verdict.good,body.embed .verdict.accent{text-align:left;background:#1a1f2a;border:1px solid #2a3040;border-radius:10px;padding:12px 14px;color:#e8e6e1;font-weight:500}body.embed .verdict.good{border-left:3px solid #34d399}body.embed .verdict.accent{border-left:3px solid #4a9eff}body.embed th{font:500 10.5px 'DM Mono',ui-monospace,monospace;letter-spacing:.7px;color:#6a6965;border-bottom:1px solid #2a3040}body.embed td{border-bottom:1px solid #1d2230}body.embed td b{color:#e8e6e1}body.embed .tx{background:#1a1f2a;border-color:#2a3040;color:#e8e6e1}body.embed .k{text-align:left;color:#6a6965;font-size:12px;border-top:1px solid #2a3040;padding-top:12px;margin-top:28px}.w{max-width:620px;margin:0 auto;padding:16px 14px 36px}
.top{display:flex;justify-content:space-between;align-items:center;gap:8px}.logo{font-size:20px;font-weight:700;letter-spacing:.5px}.logo b{color:var(--blue)}
.pill{font-size:12px;border:1px solid var(--line);border-radius:8px;padding:3px 10px;color:var(--mut)}.pill.on{border-color:var(--grn);color:var(--grn);background:var(--grnbg)}
.nav{display:flex;margin:12px 0 4px;border-bottom:1px solid var(--line)}.nav span{flex:1;text-align:center;padding:8px 0;font-size:13px;letter-spacing:.5px;color:var(--mut)}.nav .on{color:#fff;border-bottom:2px solid #fff}
form{display:flex;gap:6px;flex-wrap:wrap;margin:10px 0}select{background:var(--card);color:var(--ink);border:1px solid var(--line);border-radius:8px;padding:6px 8px;font:inherit;flex:1;min-width:120px}
h2{font-size:14px;font-weight:600;letter-spacing:1px;text-align:center;margin:22px 0 10px;color:#fff;text-transform:uppercase}
.verdict{border:1px solid var(--line);background:var(--card);border-radius:10px;padding:10px 12px;text-align:center;font-weight:500}.verdict.good{border-color:var(--grn);background:var(--grnbg);color:#b8f0d2}.verdict.accent{border-color:var(--blue);background:var(--bluebg);color:#cfe3ff}
.tiles{display:flex;gap:8px;flex-wrap:wrap}.t{flex:1;min-width:130px;text-align:center;border:1px solid var(--line);background:var(--card);border-radius:10px;padding:10px 8px}.t.a{border-color:#40557a}.t.b{border-color:var(--blue);background:var(--bluebg)}.t.up{border-color:var(--grn);background:var(--grnbg)}.t.down{border-color:var(--red);background:var(--redbg)}
.l{font-size:11px;letter-spacing:.8px;color:var(--mut);text-transform:uppercase;margin:0}.n{font-size:25px;font-weight:700;margin:2px 0 0;font-variant-numeric:tabular-nums;color:#fff}.t.b .n{color:#9cc4ff}.t.up .n{color:#7ee0ab}.t.down .n{color:#ff8f8c}.s{font-size:12px;color:var(--mut);margin:0}
.gs{display:flex;gap:8px}.g{flex:1;text-align:center}.gv{margin:-22px 0 0;font-size:15px;font-weight:600;color:#fff}.gl{margin:2px 0 0;font-size:11px;letter-spacing:.8px;color:var(--mut);text-transform:uppercase}
.card{border:1px solid var(--line);background:var(--card);border-radius:10px;padding:10px}table{width:100%;border-collapse:collapse;font-variant-numeric:tabular-nums}th{font-weight:500;color:var(--mut);text-align:right;padding:6px 4px;border-bottom:1px solid var(--line);font-size:11px;letter-spacing:.6px;text-transform:uppercase}td{padding:8px 4px;text-align:right;border-bottom:1px solid #162843}th:first-child,td:first-child{text-align:left}tr:last-child td{border-bottom:0}td b{color:#fff}
.k{text-align:center;color:var(--mut);font-size:11px;margin-top:22px}

.tx{width:100%;margin-top:6px;background:var(--bg);color:var(--ink);border:1px solid var(--line);border-radius:8px;padding:6px 8px;font:inherit}</style></head><body${embed ? ' class="embed"' : ''}><div class="w">
<div class="top"><div class="logo"><b>A/B</b> SPLIT TESTS</div><span class="pill${running ? ' on' : ''}">${running ? cfg.split + '% to B · running' : 'not running'}</span></div>
<div class="nav"><span class="on">OVERVIEW</span><span>LIVE LEADS ONLY</span><span>UK TIME</span></div>
<form method="get">${embed ? '<input type="hidden" name="embed" value="1">' : ''}<select name="site" onchange="this.form.test.value='';this.form.submit()">${optSite || '<option>No data yet</option>'}</select><select name="test" onchange="this.form.submit()">${optTest}</select><select name="days" onchange="this.form.submit()">${optDays}</select></form>
${controls}
<h2>Result</h2><div class="verdict ${tone}">${esc(verdict)}</div>
<h2>Conversion</h2>
<div class="gs">${gauge(rA, gMax, '#8aa0c4', f1(rA) + '%', 'A control')}${gauge(rB, gMax, '#4a8fe8', f1(rB) + '%', 'B new page')}${gauge(pB == null ? 0 : Math.max(pB, 1 - pB) - 0.5, 0.5, confLead === 'B' ? '#3fb97a' : '#8aa0c4', confTxt, confLead ? confLead + ' confidence' : 'confidence')}</div>
<div class="tiles" style="margin-top:10px"><div class="t a"><p class="l">A · control</p><p class="n">${f1(rA)}%</p><p class="s">${nf(tot.A.accepted)} leads / ${nf(tot.A.views)} visitors</p></div>
<div class="t b"><p class="l">B · new page</p><p class="n">${f1(rB)}%</p><p class="s">${nf(tot.B.accepted)} leads / ${nf(tot.B.views)} visitors</p></div>
<div class="t ${diffCls}"><p class="l">Difference</p><p class="n">${diff >= 0 ? '+' : ''}${f1(diff)} pts</p><p class="s">${rA > 0 ? (diff >= 0 ? '+' : '') + f1(100 * diff / rA) + '% relative' : 'n/a'}</p></div></div>
<h2>Daily trend</h2><div class="card"><div style="position:relative;height:190px"><canvas id="c"></canvas></div><p class="s" style="margin:6px 0 0;text-align:center">Accepted leads per visitor. Grey dashed A, blue B. Single days are noisy.</p></div>
<h2>Funnel</h2><div class="card"><table><tr><th>Version</th><th>Visitors</th><th>Starts</th><th>Submitted</th><th>Accepted</th><th>Rejected</th><th>Rate</th></tr>${trow('A · control', tot.A)}${trow('B · new page', tot.B)}</table></div>
<h2>Breakdown</h2><div class="tiles"><div class="t"><p class="l">Phone</p><p class="s" style="color:var(--ink)">${devLine('mobile')}</p></div><div class="t"><p class="l">Desktop</p><p class="s" style="color:var(--ink)">${devLine('desktop')}</p></div><div class="t"><p class="l">Top rejections</p><p class="s" style="color:var(--ink)">A: ${reasonLine('A')}<br>B: ${reasonLine('B')}</p></div></div>
<p class="k">Accepted leads per visitor, recorded by the website, independent of Google Ads. Lead quality and payouts are not included.</p></div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js"></script><script>
if(window.Chart){var m='#9b9a95';new Chart(document.getElementById('c'),{type:'line',data:{labels:${JSON.stringify(labels)},datasets:[{label:'A',data:${JSON.stringify(series('A'))},borderColor:'#9b9a95',backgroundColor:'#9b9a95',borderDash:[5,3],borderWidth:2,pointRadius:3,tension:.3,spanGaps:true},{label:'B',data:${JSON.stringify(series('B'))},borderColor:'#4a9eff',backgroundColor:'#4a9eff',borderWidth:2,pointRadius:3,tension:.3,spanGaps:true}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{y:{beginAtZero:true,ticks:{callback:function(v){return v+'%'},color:m},grid:{color:'rgba(127,149,184,.15)'}},x:{ticks:{color:m},grid:{display:false}}}}})}
</script><script>(function(){function s(){try{parent.postMessage({abHeight:Math.ceil(document.querySelector(".w").getBoundingClientRect().height)},location.origin)}catch(e){}}addEventListener("load",s);addEventListener("resize",s);setTimeout(s,600)})()</script></body></html>`;
  return new Response(html, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex' } });
}
