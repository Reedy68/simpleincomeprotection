# Static rebuild of simpleincomeprotection.co.uk (pull request text)

Not opened as a pull request yet: the repository has no `main` branch, and GitHub cannot open a pull request into a branch that does not exist. See "Needs you" below.

## What this is
The 15 pages of the live WordPress site as a static site on a Cloudflare Worker (Static Assets), with the VM form, Data8 lookup, cookie consent and GTM kept. DNS and the live domain are untouched. No lead was sent to VM, live or test.

## URL map
All 15 live addresses keep their address, so no redirects are needed. All 15 return 200 locally; an unknown address returns the custom 404. Full table: `docs/URL-MAP.md`.

## PageSpeed (Lighthouse, three runs each, range shown)
Rebuild measured on a local server (gzip on, simulated throttling); live site measured over the real network. Please run PageSpeed Insights on the Cloudflare preview for the real figures.

| Page | Live WordPress | Rebuild |
| --- | --- | --- |
| Home, mobile | 69-78 | 91-98 |
| Self-employed quote, mobile | 49-53 (LCP 8.3-9.2 s) | 96-98 (LCP 1.2-1.6 s) |
| Home, desktop | 83-84 (layout shift 0.26-0.27) | 99 (layout shift 0.056) |
| Self-employed quote, desktop | 85-86 (layout shift 0.22-0.24) | 99 (layout shift 0.054) |

Home page: 630 KB of HTML down to 108 KB; render-blocking requests 15 down to 3; requests 53 down to about 32. Layout shift is 0 to 0.082 on mobile (under 0.1). Part of the gain is from GTM now loading on first interaction or 6 seconds after load (see differences).
What could not be fixed because it is VM's script: `public.js` (the form engine) costs about 300 ms of main-thread time on a throttled phone, and the 211 KB form definition it reads is VM's. Both are now cached files, not part of the page.

## Schema
Offline structural check (`tools/schema-check.mjs`): 15 pages, 0 problems. Not run through Google's Rich Results Test (needs a public address): please run it on the preview for `/`, `/self-employed-quote/` and `/income-protection/`.
- Organisation (`Organization` + `InsuranceAgency`, with @id, address, Companies House number, FRN 961549 and VM FRN 710569 wording) and `WebSite` on every page; `WebPage`/`ContactPage`, `Service` (no price) on the product pages; `FAQPage` on three pages, with questions and answers word for word as visible; `BreadcrumbList` only on the five content pages where a visible breadcrumb was added. No review or rating markup.

## Disclaimer check
`node tools/disclaimer-sync/sync.mjs --check` against https://api.vmleads.co.uk/forms/disclaimer/374/28F4F: 6 form pages, all in line. It found that the three older form pages (`/income-protection-cover/`, `/self-employed/`, `/form-test/`) did not underline or bold the disclaimer links, which VM requires; fixed. The firm pop-up opens with the current wording. Daily check: `.github/workflows/disclaimer-sync.yml`.

## Differences from the live site
1. **Titles and descriptions.** The home page title was just the domain and every other title was WordPress's default ("X - simpleincomeprotection.co.uk"); no page had a meta description. Now "X | Simple Income Protection" plus a description, canonical, Open Graph. H1s and body copy are unchanged. These need your sign-off.
2. **Noindex.** `/thank-you/`, `/thank-you-2/`, `/form-test/` and the two tag pages were indexable; now noindex (still served).
3. **Cookie banner.** Complianz replaced by the CookieConsent bar used on Simple Life Cover, with the same Consent Mode defaults, `ads_data_redaction` and `url_passthrough` as before. Choices are logged to Workers Logs.
4. **GTM.** Same container (GTM-P2MH4BCL), same tags and events (compared in the browser). It loads on first interaction or 6 s after load; on the thank-you pages it loads immediately so the conversion cannot be lost.
5. **Contact Us.** The Ninja Forms contact form needed WordPress. The page now shows the email address and registered address from the privacy policy.
6. **Thank-you pages.** Said "life insurance quote"; now "income protection quote".
7. **Breadcrumb** added to the five content pages (so the breadcrumb schema matches what is visible).
8. **Fonts and images.** Self-hosted, latin only (no Google Fonts). The three embedded photos became WebP files; 22 uploads converted to WebP.
9. **Dropped** (not needed on a static site): jQuery and the page-builder script on non-form pages, WordPress emoji, Ninja Forms, Complianz, `cscertify-load.js` (a trust-badge loader; say if you want it back).
10. **Worker default source.** The WordPress form sent no `vmform_source`; the Worker sends `ppcsearch`. Needs VM's confirmation.

## Left as it was, but you should look
- Trustpilot footer line is dated 11/6/2026 (June) on every page; VM requires date and figure to match the footer.
- `/income-protection/` FAQ still says an income protection expert will phone the visitor (kept: it was left in place on 2 Nov).
- Not tested: a real submission to VM, the Data8 postcode lookup (it only works on the live domain), full form walk-through past step 2 (steps 1 to 2 tested).

## Needs you
1. Create the `main` branch (for example add a README on GitHub), then tell me: I will rebase `static-rebuild` onto it and open this pull request.
2. Connect the repo to Cloudflare (or give me the Worker name to deploy) so there is a workers.dev preview.
3. Confirm `vmform_source` with VM; sign off titles and descriptions.
4. Allow Actions to create pull requests (repo Settings > Actions > General) before the first disclaimer sync run.

Cutover checklist: `docs/CUTOVER.md`.
