# LL2PP — notes for agents

## Bump the version when work ships

`src/version.ts` holds `APP_VERSION`, a hand-maintained integer shown in the footer as `V1`, `V2`, …
Bump it by one in any change that ships to users (anything deployed to Cloudflare). It is how the owner tells at a glance whether a device is running the current build,
so a forgotten bump makes two different builds look identical. It counts shipped builds; it is not
semver, and it is not bumped per commit.

## Update detection is deliberate — don't "simplify" it away

The app has no service worker on purpose. Open tabs learn about new deploys by fetching
`version.json` (written by the `versionFile()` plugin in `vite.config.ts`) when the tab becomes
visible and hourly, and comparing its `build` id with the `__BUILD_ID__` baked into the bundle
(`src/useAppUpdate.ts`). If either side is removed or renamed, the check silently reports
"up to date" forever. The app must never reload by itself: a reload discards uploaded CVs and
extraction results, so it only offers a reload (`src/components/UpdatePrompt.tsx`). Ask the owner
before adding a service worker.

## Hosting, login and data

- The app runs on Cloudflare: a Worker (`worker/`) serves `/api/*`, the React app is static assets.
  Deploy with `npm run deploy` (build, D1 migrations, `wrangler deploy`). GitHub Pages is retired.
- Login is Cloudflare Access ("Cloudflare account members", like the owner's `clearance` app). The
  Worker *also* verifies the Access JWT on every `/api` request (`worker/auth.ts`) and fails closed if
  `ACCESS_AUD` is unset. Never weaken this; `DEV_SKIP_AUTH` belongs only in the local `.dev.vars`.
- The Anthropic API key is a Worker secret (`ANTHROPIC_API_KEY`). It must never be sent to or stored in
  the browser. Claude is called directly (not via OpenRouter), on the owner's choice: fewer parties see CVs.
- Keep only what's needed: longlists and CV text are never stored. D1/R2 (EU jurisdiction) hold clients
  and logos; saved searches (planned) store extracted data only and are deleted when finished.

## Other notes

- The app always uses the newest active Claude Sonnet, looked up via the Models API, falling back to
  `claude-sonnet-5-5` (`worker/extract.ts`).
- Extra details (location etc.) are a fixed picklist in `src/services/extraDetails.ts`, max 3 per run, not
  saved between loads. Free-text fields were tried and replaced on purpose (too prone to user error); add new
  options to that list instead.
- Build output (`dist/`) is not committed.
