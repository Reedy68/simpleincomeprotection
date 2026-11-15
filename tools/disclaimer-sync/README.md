# Disclaimer sync

VM requires the form disclaimer to match its live wording (https://api.vmleads.co.uk/forms/disclaimer/374/28F4F) and to be refreshed daily.

- `node tools/disclaimer-sync/sync.mjs --check` reports only. `node tools/disclaimer-sync/sync.mjs` updates pages in place.
- It checks the main wording, the button text, the firm pop-up wording, that the three links exist, and that links are underlined or bold.
- `.github/workflows/disclaimer-sync.yml` runs it daily and opens a pull request if anything changed. Merge the PR to deploy.
- Exit 1 with "NEEDS A HUMAN" means a page has a problem the script will not guess at (missing link, button text mismatch).
- Needs Settings > Actions > General > "Allow GitHub Actions to create and approve pull requests" switched on in the repo.
