# LL2PP - LongList to PowerPoint

**Turn CV PDFs into candidate presentation slides, entirely in your browser.**

LL2PP reads CV PDFs (one longlist PDF or individual CVs), uses Claude to extract each candidate's name, recent work history and education, and generates a downloadable `.pptx` with four candidates per slide.

## Features

- **PDF parsing** in the browser with PDF.js. Longlist mode splits one PDF into CVs at each "Page 1 of …" marker; individual mode treats each PDF as one CV.
- **Claude extraction** with structured outputs, so every answer is valid JSON in the expected shape. Board roles are excluded and dates normalised to `MM/YYYY - MM/YYYY` or `YYYY - YYYY`.
- **Always the newest Claude Sonnet**: on startup the app asks the Anthropic Models API for the newest active Sonnet that supports what the app needs, so new Sonnet releases are picked up automatically. If the lookup fails or the new model rejects the request, it falls back to Claude Sonnet 5.5.
- **Extended thinking** toggle for complex individual CVs (unusual layouts, ambiguous titles or dates).
- **PowerPoint output** generated client-side with PptxGenJS, using the template images in `public/assets/`.
- **Cost tracking**: token usage and estimated cost per run.
- **Version stamp and update notice**: the footer shows the app version (`V1`, …) and build. If a newer build is deployed while the app is open, it offers a reload instead of leaving you on the old build.
- **Private by design**: no backend. CVs and your API key stay in your browser and are only sent to the Anthropic API.

## Using it

1. Get an API key at [console.anthropic.com](https://console.anthropic.com).
2. Open the app and paste the key. Turn on extended thinking if the CVs are complex.
3. Choose longlist or individual mode and a concurrency level (1–2 for new accounts on API usage Tier 1).
4. Upload the PDF(s), click **PROCESS CVs**, review the results, then **DOWNLOAD .PPTX**.

## Development

Requires Node.js 20.19+ or 22.12+.

```bash
npm install
npm run dev      # local dev server
npm run build    # type-check and production build into dist/
npm run preview  # serve the production build
```

Pushing to `main` deploys to GitHub Pages via `.github/workflows/deploy.yml`. Bump `APP_VERSION` in `src/version.ts` with every change that ships.

## Project structure

```
src/
├── App.tsx                      # Main application and processing flow
├── components/
│   ├── LlmKeyInput.tsx          # API key, active model and extended-thinking settings
│   ├── ParseModeSelector.tsx    # Longlist vs individual mode
│   ├── ConcurrencySelector.tsx  # Parallel request level
│   ├── FileUploader.tsx         # PDF upload
│   ├── ProgressIndicator.tsx    # Processing status
│   ├── GenerateButton.tsx       # PPTX download
│   ├── ManualCopyOutput.tsx     # Copy-paste text output
│   └── ThemeToggle.tsx          # System/light/dark theme
├── services/
│   ├── aiService.ts             # Newest-Sonnet lookup and Claude extraction (Anthropic SDK)
│   ├── pdfService.ts            # PDF parsing and CV splitting
│   ├── rateLimiter.ts           # Spaces out API request starts
│   ├── slideGenerator.ts        # PPTX generation
│   ├── layoutConfig.ts          # Slide layout coordinates
│   └── storageService.ts        # localStorage settings
└── types.ts
```

To change the slide template, see `TEMPLATE-CHECKLIST.md` and `public/assets/README.md`.

## Tech stack

React 19, TypeScript, Vite, PDF.js, PptxGenJS, Zod and the Anthropic TypeScript SDK.
