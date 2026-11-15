// local test server: static files + the worker's lead route against a MOCK broker (nothing leaves this machine)
import http from 'node:http'; import zlib from 'node:zlib'; import fs from 'node:fs'; import path from 'node:path';
const PUB = path.resolve(process.argv[2]); const PORT = +process.argv[3] || 8788;
const mime = {'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.svg':'image/svg+xml','.gif':'image/gif','.webp':'image/webp','.woff2':'font/woff2','.woff':'font/woff','.ttf':'font/ttf','.json':'application/json','.xml':'application/xml','.txt':'text/plain','.ico':'image/x-icon'};
const WK = path.resolve(process.argv[4] || path.join(PUB, "_worker.js"));
const worker = (await import('file://' + WK)).default;
const posts = [];
globalThis.HTMLRewriter = class { on(){return this} transform(r){return r} };
const realFetch = globalThis.fetch;
const env = { ASSETS: { fetch: async req => { const u = new URL(req.url); let p = decodeURIComponent(u.pathname); let f = path.join(PUB, p);
  if (!f.startsWith(PUB)) return new Response('no', {status:403});
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
  if (!fs.existsSync(f)) { const nf = path.join(PUB, '404.html'); return new Response(fs.readFileSync(nf), {status:404, headers:{'content-type':'text/html'}}); }
  return new Response(fs.readFileSync(f), {headers:{'content-type': mime[path.extname(f)] || 'application/octet-stream'}}); } } };
globalThis.fetch = async (u, o) => { if (String(u).startsWith('https://api.vmleads.co.uk')) { posts.push({u:String(u), body:String(o.body), referer:o.headers.referer});
  const validate = String(u).includes('rest-validate'); return new Response(JSON.stringify(validate ? {status:'',field_errors:{}} : {status:'success', lead_id:'MOCK-1', redirect:'/thank-you/'}), {status:200}); } return realFetch(u, o); };
http.createServer(async (req, res) => {
  const chunks = []; for await (const c of req) chunks.push(c); const body = Buffer.concat(chunks);
  if (req.url === '/__posts') { res.end(JSON.stringify(posts)); return; }
  const r = await worker.fetch(new Request('http://localhost:' + PORT + req.url, { method: req.method, headers: req.headers, body: ['GET','HEAD'].includes(req.method) ? undefined : body }), env, {});
  let out = Buffer.from(await r.arrayBuffer()); const hd = Object.fromEntries(r.headers);
  // like Cloudflare: compress text on the way out (so local timings are comparable); cache headers from public/_headers are applied by Cloudflare, so mimic the main ones here
  if (/^(text\/|application\/(json|javascript|xml)|image\/svg)/.test(hd['content-type'] || '') && /gzip/.test(req.headers['accept-encoding'] || '')) { out = zlib.gzipSync(out, { level: 6 }); hd['content-encoding'] = 'gzip'; }
  if (/\/assets\/(css|fonts)\/|\/assets\/img\/p-/.test(req.url)) hd['cache-control'] = 'public, max-age=31536000, immutable';
  else if (/\/assets\/|\/wp-content\/|\/wp-includes\//.test(req.url)) hd['cache-control'] = 'public, max-age=86400';
  hd['content-length'] = out.length; res.writeHead(r.status, hd); res.end(out);
}).listen(PORT, () => console.log('serving', PUB, 'on', PORT));
