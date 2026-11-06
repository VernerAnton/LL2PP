# LL2PP — notes for agents

## Bump the version when work ships

`src/version.ts` holds `APP_VERSION`, a hand-maintained integer shown in the footer as `V1`, `V2`, …
Bump it by one in any change that ships to users (anything merged to `main`, which deploys to
GitHub Pages). It is how the owner tells at a glance whether a device is running the current build,
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

## Other notes

- Claude is the only AI provider. The app always uses the newest active Claude Sonnet, looked up via
  the Models API, falling back to `claude-sonnet-5-5` (`src/services/aiService.ts`).
- `dist/` is old build output still tracked in git; deploys build in CI. Don't commit rebuilt `dist/` files.
