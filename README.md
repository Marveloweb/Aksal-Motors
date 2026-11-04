# Aksal Motors website

One-page site for Aksal Motors Ltd, 101 Newlands Road, Newlands, Wellington.
Built by MarveloWeb. Plain HTML, CSS and JavaScript, no build step.

## Files
- `index.html`: the page, including the icon set (inline SVG `<symbol>`s) and LocalBusiness schema.
- `assets/css/styles.css`: brand tokens at the top (`--navy`, `--red`, `--gold`), then sections, then responsive rules.
- `assets/js/main.js`: mobile menu toggle and footer year.
- `assets/img/`: logo, workshop photo and payment badges from the client's current site, plus `favicon.svg`.

When CSS or JS changes, bump its `?v=` number in `index.html`.

## Deploy
GitHub Pages from the `main` branch root (Settings → Pages). `.nojekyll` is included.
Live: https://marveloweb.github.io/Aksal-Motors/

## Before launch
- Confirm with the client: which car makes to list, using "Dan" in the sign-off, and the star ratings on the five reviews.
- Google lists the Newtown workshop as permanently closed, so the site only shows Newlands. Confirm.
- Point the domain (aksalmotors.co.nz) at the new site.
