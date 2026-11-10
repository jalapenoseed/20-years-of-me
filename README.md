# 20 Years of Me — Facebook Autopsy

A private, local-first retrospective of your Facebook posting history. Jalapeño Seed Productions.

## What is working

- Reads Facebook JSON exports, ZIP archives containing recognizable Facebook post-folder JSON files, or pasted dated posts.
- Computes year-by-year frequencies, keyword topic categories, recurring themes, and dated examples.
- Offers thoughtful assessment with light roast humor, separately toggleable.
- Shows an interactive (collapsible) evidence trail for each observation.
- Shares a sanitized, aggregate-only summary or PNG card; exports the complete **private** report as JSON.
- No backend, authentication, Meta permissions, analytics, external LLM calls, or uploaded data. All analysis is local.

**Limitations:** This MVP is a deterministic local analyzer — not a generative AI service. It cannot diagnose conditions, reliably infer personality or intent, read posts not present in the archive, parse HTML exports, analyze images/videos, or reconstruct deleted posts. Meta JSON export layouts vary; some may require parser adjustments. The app cannot automatically fetch Facebook timelines via login. Never publish the private JSON report, which contains post excerpts.

## Local development

```sh
npm test
npm run dev
```

To create a static web release:

```sh
npm run build
```

Deploy the contents of `dist/` to any static web host. A GitHub Pages workflow is provided in `.github/workflows/deploy.yml` (enable Pages -> Source: GitHub Actions). Alternatively upload `dist/` as an HTML game on itch.io; its HTML wrapper should serve `index.html` at the root.

## Facebook export

Go to Accounts Center → Your information and permissions → Download/Export your information; choose your Facebook account, **Posts**, All time, **JSON**, Download to device. Import the ZIP file. Avoid selecting Messenger or other unrelated categories. Meta's labeling may change.

## Privacy and threat model

- Nothing is transmitted by JavaScript to our backend: there is no backend.
- The page does not load any third-party scripts, fonts, or analytics.
- ZIP files are capped at 100 MB compressed, 90 MB of candidate JSON uncompressed, 24 MB per candidate JSON file, 150 matching files. This is not a perfect ZIP bomb defense; use a Web Worker for very large archives in a later release.
- JSON parser limits nesting and traversed objects, drops comment and private-message paths, and restricts ZIP candidate files to post-like paths. A generic JSON upload may still include non-post text in post-like records; users are responsible for selecting appropriate data.
- The complete private report export **does** contain imported post texts and should not be shared publicly.
- The aggregate share summary and image only contain derived metrics and topic names.
- No clinical diagnosis, profiling of non-consenting third parties, or targeted sensitive-trait inference.

## Next pass

Move ZIP parsing to a Web Worker; support more Facebook export schemas; distinguish authored original posts from reposts; allow per-finding edits/redactions and selective evidence export; add locally run opt-in LLM commentary if feasible; deploy to GitHub Pages or existing Fly/itch workflow after authorizing repo access.
