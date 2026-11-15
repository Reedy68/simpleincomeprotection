# Cutover checklist: WordPress to Cloudflare

Nothing here has been done. DNS and the live domain are untouched. Do the steps in this order.

## Before the switch
1. **Cloudflare Worker.** Connect this repository to Cloudflare (Workers Builds) or run `npx wrangler deploy`. The Worker is named `simpleincomeprotection`. Open the `*.workers.dev` address (or the branch preview) and check the pages. Leads from there are always sent to VM as TESTS.
2. **Confirm `vmform_source` with VM.** The WordPress form did not send one (the server added it), so the Worker sends `ppcsearch` (the value Simple Life Cover uses). Ask VM whether that is right for Income Protection, or give the right value. It is `DEFAULT_SOURCE` in `wrangler.jsonc`.
3. **One test lead.** With the owner's go-ahead, submit a test lead from the workers.dev address, confirm VM shows it as a test, and delete it. Check the "Submit lead form GTM" conversion in Tag Assistant on the thank-you page.
4. **Check the three Google tags on the preview** with Tag Assistant: the page view, the two conversion tags (labels in container GTM-P2MH4BCL) and the consent default. They fire after "Accept all" and not after "Reject non-essential".
5. **Disclaimer sync.** In the repo settings, switch on Settings > Actions > General > "Allow GitHub Actions to create and approve pull requests" (leave workflow permission on "Read repository contents"). After merging, run the "Disclaimer sync" workflow once from the Actions tab to confirm it works.
6. **PageSpeed Insights on the preview** for the home page and `/self-employed-quote/`, mobile and desktop.

## Switch
7. **Custom domain.** In Cloudflare, add `simpleincomeprotection.co.uk` and `www.simpleincomeprotection.co.uk` as custom domains on the Worker. Keep the old WordPress origin available until step 11.
8. **DNS.** Point the domain at the Worker (Cloudflare does this automatically for a custom domain on a zone in the same account). Lower the TTL a day before.
9. **Redirects.** None are needed: every old address keeps its address (`docs/URL-MAP.md`). Check `www` redirects the way you want.
10. **Re-test the live form** with `?vmtest=1` on the live address, then one real submission when you are ready.

## After the switch
11. **GTM.** Confirm GTM-P2MH4BCL fires on the live pages and the two conversion tags fire on `/thank-you/`.
12. **Google Search Console.** Submit `https://simpleincomeprotection.co.uk/sitemap.xml` and remove the old `wp-sitemap.xml`. Use URL Inspection on the home page and `/self-employed-quote/`.
13. **Google Ads.** The ad final URLs do not change. Check the landing-page status of the live ads a day later.
14. **Cancel or park WordPress hosting** only after a week of clean leads.

## Rollback
Point the DNS records back at the WordPress host (keep the old records written down before step 8) and remove the custom domain from the Worker. The Worker keeps no data, so nothing needs undoing. Leads submitted during the switch are in VM either way.

## Things that no longer exist after the switch
- The Contact Us form (it ran on WordPress). The page now shows the email address and registered address from the privacy policy. A working form needs a small Worker route; ask if you want it.
- Complianz consent logging in the WordPress database. Consent choices are now written to the Worker log (Workers Logs).
- WordPress login, plugins and any server-side job that ran in WordPress.
