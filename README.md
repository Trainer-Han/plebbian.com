# plebbian.com

Personal site — a small hand-built homage to my Discord profile.
Once a pleb, always a pleb ;)

Static HTML with no build step, served by GitHub Pages on
[plebbian.com](https://plebbian.com). The `CNAME` file wires the custom
domain; DNS lives at the registrar.

## How this ships

**`main` is where work happens. `live-website` is what the public sees.**

GitHub Pages is configured to build from `live-website` (root), *not* `main`.
So pushing to `main` — or any other branch — cannot break the live site. It
only goes live when `live-website` moves.

```
  main ──────●───●───●──────●         ← push freely, experiment, break things
                          ╲
                           PR + CI     ← required: no direct pushes
                            ╲
  live-website ──●───────────●        ← Pages builds this → plebbian.com
```

Rules on `live-website`:

- **Direct pushes are blocked.** Everything arrives through a pull request.
- **The `verify` check must pass** before the PR can merge.
- **The branch must be up to date** with its base before merging.
- No approving review is required, since this is a one-person repo — the
  gate is CI, not a second pair of eyes.

### Shipping a change

```sh
git switch main
# ...work, commit...
git push origin main                       # safe: does not touch the live site

gh pr create --base live-website --head main \
  --title "Ship: what changed" --body "..."
# wait for `verify` to go green, then:
gh pr merge --merge                        # Pages rebuilds, ~40s
```

### What CI checks

`.github/workflows/verify.yml` runs two scripts, both runnable locally:

```sh
node scripts/verify.js          # static
CHROME_PATH="/path/to/chrome" node scripts/browser-check.js   # runtime
```

| Script | Catches |
| --- | --- |
| `verify.js` | Malformed HTML, dead asset references, anchors pointing at ids that don't exist, `<use>` with no matching `<symbol>`, emoji used as icons, text tokens below WCAG AA 4.5:1, missing skip link or `#main`, more than one `<h1>` |
| `browser-check.js` | Console errors, uncaught exceptions, failed requests, stylesheet not applying, horizontal overflow, controls with no accessible name, and the wordmark failing to settle on "Plebbian" or leaving inline styles behind |

`browser-check.js` serves the repo over HTTP the way Pages does — including
returning `404.html` for unknown paths — so the 404 page's root-absolute
asset paths are actually exercised. It uses `puppeteer-core` against an
already-installed Chrome, so there's no browser download.

Requests to `api.github.com` are allowed to fail: the pages are built to
degrade to a notice when the API is unreachable or rate-limited, and CI
runners frequently are.

## Layout

| Path | What it is |
| --- | --- |
| `index.html` | Landing page — animated wordmark, what-we-do bento, contact |
| `portfolio.html` | Work page — live GitHub repos, about, stack, contact |
| `404.html` | Styled not-found page (uses root-absolute asset paths) |
| `coming-soon.html` | The original launch page, kept for reference |
| `assets/style.css` | Whole design system: tokens, dark + light themes, components |
| `assets/app.js` | Nav, scroll spy, command palette, theme, dot field, GitHub data |
| `assets/wordmark.js` | The hero wordmark sequence |
| `assets/fonts/` | Self-hosted Archivo + Space Grotesk (see `LICENSE.md`) |

Nav markup is duplicated across the pages and every link is page-qualified
(`portfolio.html#about`), so the same block works from anywhere. If you edit
the nav, edit it in each page.

## The wordmark

The hero animates `Pleb` → `Pleb AI` → `PlebbAIn` → `PlebbIAn` → `Plebbian`,
then fades in the domain stamp. The point is that **Plebbian already contains
"ai"** — `Plebb·ia·n` — so the two glyphs that arrive as a glowing `AI` are the
same two that swap and lowercase into the finished name. Those letters keep a
gradient tint at rest so the static logo still carries the idea.

It runs once per session (`sessionStorage`), with a replay control under the
wordmark. The HTML holds the *finished* state, so anyone with JavaScript off or
`prefers-reduced-motion` set simply sees the correct logo.

## GitHub data

Repos and the hero stat strip come from the public GitHub API at page load —
unauthenticated, cached in `localStorage` for 6 hours to stay clear of the
60 requests/hour limit. There is deliberately no token: anything embedded in a
static page is public, so only public data is used. If the API is unreachable
or rate-limited, the sections fall back to a notice linking to the profile.

Repo **descriptions** are what fill the project cards, so adding a description
on GitHub improves this site with no code change.

## Local preview

Fonts and the theme work fine over `file://`, so opening `index.html` directly
is usually enough. To exercise it as it ships:

```sh
python -m http.server 8000
```

Then visit <http://localhost:8000>.
