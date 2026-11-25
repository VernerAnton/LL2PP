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
  and logos, and saved searches (individual CVs in batches) with their candidates' extracted data only:
  `worker/searches.ts` whitelists the stored fields, so CV text can't be saved even if a client sends it.
  Searches are deleted with all candidates when the owner finishes them.

## Other notes

- The app always uses the newest active Claude Sonnet, looked up via the Models API, falling back to
  `claude-sonnet-5-5` (`worker/extract.ts`).
- Extra details (location etc.) are a fixed picklist in `src/services/extraDetails.ts`, max 3 per run, not
  saved between loads. Free-text fields were tried and replaced on purpose (too prone to user error); add new
  options to that list instead.
- The slide design (size, backgrounds, every box position) is data, not code: `src/shared/design.ts` holds
  the built-in design (the original template) and validation; the saved design lives in D1 with uploaded
  backgrounds in R2, edited on the DESIGN tab. Read positions from the design (`useDesign()`), never hard-code
  them. The slide size comes from the backgrounds' proportions (4:3 or 16:9); a 16:9 design needs all three
  backgrounds uploaded because the built-in ones are 4:3.
- The decks come out finished: the formatting the owner's old PowerPoint macro (FormatEducationBoxes +
  ApplyTemplate) applied is built in. `slideGenerator.ts` writes bold institution paragraphs and real
  13.5pt degree bullets in Calibri; `pptxFinish.ts` swaps in the company theme (`src/assets/pptx-theme.xml`,
  taken from a macro-processed deck) and sets the degree bullets to Arial. It was verified paragraph by
  paragraph against a deck the macro had processed; keep it that way. Don't reintroduce the `>>>` markers.
- Build output (`dist/`) is not committed.
