# LL2PP - LongList to PowerPoint

**Turn CV PDFs into candidate presentation slides.**

LL2PP reads CV PDFs (one longlist PDF or individual CVs), uses Claude to extract each candidate's name, recent work history and education, and generates a downloadable `.pptx` with four candidates per slide. It runs on Cloudflare behind a login.

## Features

- **PDF parsing** in the browser with PDF.js. Longlist mode splits one PDF into CVs at each "Page 1 of …" marker; individual mode treats each PDF as one CV.
- **Scanned CVs**: an individual CV PDF with no readable text (a scan or picture) is sent to Claude as the PDF itself, and Claude reads the page images. Not stored, like CV text. Scanned longlists can't be split into CVs and get a clear message instead.
- **Claude extraction** on the server with structured outputs, so every answer is valid JSON in the expected shape. Board roles are excluded and dates normalised to `MM/YYYY - MM/YYYY` or `YYYY - YYYY`. The Anthropic API key lives only on the server.
- **Always the newest Claude Sonnet**: the server asks the Anthropic Models API for the newest active Sonnet that supports what the app needs, falling back to Claude Sonnet 5.5.
- **Thinking level**: Auto, Low, Medium or High. Auto uses low for longlist exports and medium for individual CVs, and retries a CV that comes back incomplete once at high.
- **Extra details** for one-off client requests: pick up to 3 of Location, Languages, Years of experience and Industry. They appear after the name on the slide (**JANE DOE** · Helsinki).
- **Clients and logos**: add a client once, upload its logo (empty borders trimmed automatically, crop by hand), and drag/resize it on a preview of the real first slide. Pick the client when making a deck and the logo goes exactly where you placed it.
- **First slide**: logo, then LONGLIST, the position and today's date (e.g. 24.11.2026).
- **Saved searches** for individual CVs that arrive in batches: create a search (name, client, position, extra details), add CVs over days or weeks, reorder/edit/remove candidates, download the deck any time, then **Finish & delete**. Each CV is saved as extracted data only, as soon as it's processed.
- **Slide design** (DESIGN tab): replace the first, candidate and last slide backgrounds and drag every text box into place. The slide size (4:3 or 16:9 widescreen) follows the images' proportions. The original template in `public/assets/` is the built-in design.
- **PowerPoint output** generated in the browser with PptxGenJS, using the current slide design, already formatted as the old PowerPoint macro used to leave it: bold institutions with bulleted degrees, Calibri throughout, and the Suorahakutoimisto Yellow theme. No macro step needed.
- **Cost tracking**: token usage and estimated cost per run.
- **Version stamp and update notice**: the footer shows the app version (`V1`, …) and build; an open tab offers a reload when a newer build is deployed.
- **Keeps only what's needed**: longlists and CV text are never stored. Clients and logos are saved, and saved searches keep extracted data until you finish and delete them (Cloudflare D1 + R2, EU jurisdiction).

## Using it

1. Open the app and log in with your Cloudflare account (Cloudflare Access).
2. Optional: on the **CLIENTS** tab, add the client and its logo.
3. Longlist: on the **CVs** tab pick the thinking level, mode, extra details, and the client and position for the first slide. Upload the PDF, click **PROCESS CVs**, review, then **DOWNLOAD .PPTX**. Nothing is saved.
4. Individual CVs in batches: on the **SEARCHES** tab create a search, add each batch as it arrives, and when done download the deck and **Finish & delete**.

## Architecture

- `src/`: the React app (served as static assets). PDF parsing and PPTX generation run in the browser.
- `worker/`: a Cloudflare Worker serving `/api/*`: Claude extraction, the model lookup, and clients/logos.
- **D1** database `ll2pp` (clients with logo crop and placement; saved searches and their candidates' extracted data; the slide design) and **R2** bucket `ll2pp-assets` (logos and uploaded slide backgrounds), both EU jurisdiction.
- **Cloudflare Access** in front of the Worker (log in with a Cloudflare account that is a member of the account). The Worker also verifies the Access token on every `/api` request and rejects requests without one.
- Secret `ANTHROPIC_API_KEY` is set on the Worker (dashboard: Workers & Pages → ll2pp → Settings → Variables and Secrets).

## Development

Requires Node.js 20.19+ or 22.12+.

```bash
npm install
npx wrangler d1 migrations apply ll2pp --local   # once: create the local database
npm run dev      # app + Worker locally, with local D1/R2
npm run build    # type-check (app and Worker) and production build into dist/
npm run deploy   # build, apply database migrations, deploy to Cloudflare
```

Local development needs a `.dev.vars` file (gitignored):

```
DEV_SKIP_AUTH=true
ANTHROPIC_API_KEY=<a key, or anything when ANTHROPIC_BASE_URL points at a mock>
```

Bump `APP_VERSION` in `src/version.ts` with every change that ships.

## Project structure

```
src/
├── App.tsx                      # Main application and processing flow
├── components/
│   ├── AiSettings.tsx           # Model in use and thinking level
│   ├── ClientsPage.tsx          # Client library
│   ├── LogoEditor.tsx           # Logo upload, trim/crop, placement on the first slide
│   ├── FirstSlideInput.tsx      # Client and position for the first slide
│   ├── SearchesPage.tsx         # Saved searches: batches, candidate list, finish & delete
│   ├── CandidateEditor.tsx      # Fix a saved candidate by hand
│   ├── DesignPage.tsx           # Slide backgrounds and box positions
│   ├── ExtraDetailsInput.tsx    # Extra details picklist
│   ├── …                        # Mode, concurrency, upload, progress, output, update prompt
├── services/
│   ├── aiService.ts             # Calls /api/extract; Auto thinking level logic
│   ├── api.ts                   # /api client
│   ├── clientsService.ts        # Clients and logos API
│   ├── searchesService.ts       # Saved searches API
│   ├── designService.ts         # Slide design API and the current design (React context)
│   ├── imageTools.ts            # SVG conversion, auto-trim, crop
│   ├── firstSlide.ts            # First slide geometry, date format
│   ├── slideGenerator.ts        # PPTX generation
│   ├── pptxFinish.ts            # Theme + bullet font finishing (replaces the old macro)
│   └── …
├── shared/apiTypes.ts           # Types shared by the app and the Worker
├── shared/design.ts             # Slide design: sizes, built-in design, validation
worker/
├── index.ts                     # /api router
├── auth.ts                      # Cloudflare Access token check
├── extract.ts                   # Claude extraction (prompt, schema, model lookup)
├── clients.ts                   # Clients (D1) and logos (R2)
├── searches.ts                  # Saved searches and candidates (D1)
└── design.ts                    # Slide design (D1) and uploaded backgrounds (R2)
migrations/                      # D1 schema
```

## Tech stack

React 19, TypeScript, Vite, Cloudflare Workers (D1, R2, Access), PDF.js, PptxGenJS, Zod and the Anthropic TypeScript SDK.
