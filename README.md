# simpleincomeprotection.co.uk: static site

Static rebuild of the WordPress site, served by a Cloudflare Worker with Static Assets (same pattern as simplelifecover.com).

- `public/` is the site, exactly as served. One folder per page with an `index.html`, so every address ends in a slash.
- `src/worker.js` forwards the VM form to VM (validate step and lead), logs cookie-consent choices, and marks any lead as a TEST unless it comes from a live hostname. `wrangler.jsonc` holds the Worker name and `LIVE_HOSTS`.
- `docs/URL-MAP.md` lists every old address and what happened to it. `docs/CUTOVER.md` is the go-live checklist.
- `tools/` rebuilds the site from the live WordPress pages (`crawl.mjs` -> `build.mjs` -> `optimize.mjs`), checks it (`verify.mjs`, `seo-check.mjs`, `schema-check.mjs`) and runs a local test server with a mock broker (`serve.mjs`: nothing leaves your machine).
- `tools/disclaimer-sync/` checks VM's disclaimer wording daily (`.github/workflows/disclaimer-sync.yml`). See its README.

This repository is public: no secrets belong in it. VM identifies the campaign from the form's own hidden fields, so the Worker needs no keys.

## Test mode
Leads are sent to VM as TEST on every host not listed in `LIVE_HOSTS` (workers.dev and branch previews), and on a live host with `?vmtest=1`. Only `simpleincomeprotection.co.uk` and `www.simpleincomeprotection.co.uk` send real leads.

## Branches
Work on a branch and open a pull request; the owner merges to `main`.
