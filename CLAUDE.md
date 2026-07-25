# Working rules for this repo

## Never move the live branch

`live-website` is what **plebbian.com** serves. GitHub Pages builds from it.

**Do not push to `live-website`. Do not merge pull requests into it.**

Opening a PR is fine and expected. Merging is the owner's decision, every
time, without exception — no "it's only a small change", no "CI is green so
it's safe", no "the previous one was approved so this one is too". Approval
of one deploy is never approval of the next.

This is enforced locally by `scripts/hooks/pre-push`, enabled with:

```sh
git config core.hooksPath scripts/hooks
```

Server-side branch protection cannot cover this on its own: tooling operating
through the owner's credentials is indistinguishable from the owner, so the
rule has to hold here.

### The only correct way to ship

```sh
git push origin main                       # always safe
gh pr create --base live-website --head main --title "..." --body "..."
# then stop, and tell the owner the PR is ready
```

## Other standing rules

- `main` is the working branch — push there freely.
- Run `node scripts/verify.js` before opening a PR; `scripts/browser-check.js`
  too if the change touches layout, CSS or the wordmark.
- Never commit `.idea/`.
- Never put a GitHub token in client-side code. The site deliberately uses
  only unauthenticated public API data.
