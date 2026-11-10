# 20 Years of Me — Facebook Autopsy

A private, local-first retrospective of Facebook posting history by Jalapeño Seed Productions. This project extends the original functional MVP rather than replacing it.

Public app: [jalapenoseed.github.io/20-years-of-me](https://jalapenoseed.github.io/20-years-of-me/) · Source: [jalapenoseed/20-years-of-me](https://github.com/jalapenoseed/20-years-of-me). The app URL becomes available after the Pages deployment succeeds.

## Features

- Import Facebook post JSON files, multiple export parts, or ZIP archives. Parsing runs in a cancellable Web Worker, with archive limits and coverage warnings.
- Explore chronological posting counts, changing keyword topics, recurring themes, dated evidence, and memorable examples. Missing calendar years remain visible.
- Switch between serious observations, affectionate roasts, and both. Findings describe the text in the sample, with no psychiatric diagnoses.
- Preview a customizable share card, save a PNG, copy a caption, or use the device share sheet when supported. Share cards contain selected aggregates; original posts are excluded.
- Optional generative commentary uses a reviewed, aggregate-only prompt that the user transfers to their chosen AI. Paste its JSON response back into the app for schema and evidence-ID checks. The app makes no automatic AI API requests and stores no API keys.
- Clear imported data from the tab. A separate, clearly labeled private JSON export contains the report and post text.

## Run locally

Requires Node.js 22 or newer. The application itself has no npm runtime dependencies. Python 3.9+ is used only to package the itch.io ZIP.

```sh
npm test
npm run dev
```

Open `http://localhost:4173`. Serve over HTTP; do not double-click `index.html`, because module and Worker loading require an HTTP origin. `PORT` overrides the default server port.

```sh
npm run verify
npm run preview
npm run release
```

`verify` runs all Node tests, builds the static app into `dist/`, and checks module syntax, relative asset paths, and build contents. `preview` serves that build. `release` also writes `releases/20-years-of-me-html5.zip`, with `index.html` at its root. Rebuilding unchanged files produces the same release ZIP bytes.

For automated browser smoke tests, install the locked development dependency and Chromium, then run the suite against the production build:

```sh
npm ci
npx playwright install chromium
npm run build
npm run test:browser
```

The browser dependency is for QA only; no Playwright files are included in the deployed app. CI runs the same suite before deployment.

## Import a Facebook export

In Meta Accounts Center, find **Your information and permissions → Export / Download your information**, select your Facebook profile and **Posts**, choose **All time** and **JSON**, then export to your device. Menu labels can change. Open the downloaded ZIP, select its individual JSON files, or paste dated text in the app's `YYYY-MM-DD: post text` format.

Recognized structures include root post arrays and post collections such as `posts`, `your_posts`, `status_updates`, `profile_posts`, `timeline`, and `statuses`. Text-bearing dated records are extracted; title-only activity metadata, comments, Messenger content, and tagged-media branches are excluded. Import notices explain unreadable or skipped files. Inspect the detected dates and examples before treating a report as complete.

Limits: 100 MiB combined selected files, 24 MiB per JSON file, 90 MiB combined expanded candidate JSON, 150 candidate/selected files, 10,000 ZIP entries, and a 250:1 candidate compression-ratio limit for expanded entries over 1 MiB. HTML exports, media analysis, encrypted/split ZIPs, and ZIP64 are unsupported. A full account export may exceed these limits; export Posts only or import smaller parts.

## Privacy

Local import and analysis run entirely in the browser tab. There is no application backend, analytics, third-party font, automatic cloud upload, or automatic browser persistence. The static host still receives ordinary page requests. Clearing the report cancels imports and removes application references to imported data; it does not erase the original downloaded archive, saved reports, shared files, external AI copies, or browser/system backups.

The optional AI prompt excludes raw post text, filenames, and token lists, but aggregate dates and topic counts can still be personal. Review it before transferring it. Imported AI prose is an unverified interpretation: valid citation IDs do not prove that its meaning or conclusions are correct. External providers control copies sent to them.

The private report JSON includes original post text and must be kept private. Public cards exclude original text and AI prose. Topic sharing is opt-in; review the exact card and caption before sharing. No Facebook login or posting permission is requested. Sharing opens a device flow or Facebook composer; the user completes the post.

## Analysis limits

Keyword categories overlap and are English-oriented. Topic mentions do not establish endorsement, personality, intent, health, or private life. Export coverage can change over time; zero posts mean no represented records, not proof of inactivity. Sparse years do not support strong trend claims. Possible opposing statements are review candidates, not established contradictions. Images, videos, deleted posts, inaccessible records, repost attribution, and comprehensive multilingual interpretation are outside this release.

## Deploy

The app is static and works on GitHub Pages, itch.io HTML5, and other static hosts. See [release instructions](docs/RELEASE.md) for CI, GitHub Pages configuration, and the optional itch.io upload workflow. The source must never include personal Facebook archives, private reports, API keys, or real-data test fixtures.

Independent of Meta and Facebook. No Facebook trademark affiliation is claimed.
