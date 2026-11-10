# Release guide

Repository: [jalapenoseed/20-years-of-me](https://github.com/jalapenoseed/20-years-of-me). Pages is configured to use GitHub Actions. Expected public URL: [jalapenoseed.github.io/20-years-of-me](https://jalapenoseed.github.io/20-years-of-me/). A successful remote workflow result establishes the deployed revision; a workflow file alone does not establish a live deployment.

## Verify and package

1. Use Node.js 22+ and Python 3.9+.
2. Run `npm run verify` from the repository root.
3. Run `npm ci`, `npx playwright install chromium`, and `npm run test:browser` for the automated browser smoke suite. Use `npm run preview` for interactive checks: import, cancellation, date filters, search, share preview, PNG saving, private-export confirmation, AI prompt review/import, and Clear all data. Playtest narrow mobile and desktop layouts.
4. Run `python3 scripts/package-release.py` for `releases/20-years-of-me-html5.zip`. To choose a destination, pass `--output /absolute/path/20-years-of-me-html5.zip`.

The packager includes only `dist/`, places `index.html` at the ZIP root, sorts entries, normalizes permissions and timestamps, and verifies the resulting ZIP. Build output contains only the app, local vendored JSZip, and `.nojekyll`. Tests, source archives, user data, credentials, and repository metadata are not copied.

## GitHub Pages

1. Create the repository with the requested owner/name and push the inspected source to `main`.
2. In **Settings → Pages → Build and deployment**, set **Source: GitHub Actions**.
3. The **Test and deploy to GitHub Pages** workflow runs on pushes to `main` and manual dispatch. Pull requests run verification without deployment.
4. The verify job installs the locked QA dependency, runs tests, build checks, and Chromium browser smoke checks, creates an itch HTML ZIP artifact, and uploads the Pages artifact. The deploy job publishes only after verification succeeds.
5. Check the workflow result and the returned `github-pages` environment URL before reporting the site live.

No hosting secrets are required for Pages. Relative assets and Workers support a project subpath such as `/20-years-of-me/`. Keep imported archives out of Git; no real Facebook data is needed to deploy.

## itch.io HTML5

Create an itch project under `jalapenoseed` with **Kind of project: HTML**. A draft is sufficient for a private release review.

Manual upload: upload `releases/20-years-of-me-html5.zip`, mark **This file will be played in the browser**, choose a responsive/embed layout, and enable fullscreen. Test file selection and share/download actions inside itch's iframe; browser permissions may require a new tab or PNG-download fallback. Choose the app title and page copy to explain that archives stay on the user's device.

Optional CI upload: add repository secret `BUTLER_API_KEY` using an itch API key, then run **Publish HTML5 build to itch.io**. The workflow verifies the build, downloads the official Butler CLI, and uploads `dist/` to the chosen existing project channel `html5`. It is manually triggered and does not publish the itch project's draft page. Never paste keys into code, chat, issue text, or workflow logs.

## Release notes and outstanding checks

- Automated unit and build results should be recorded in the QA report for the exact source revision.
- Browser and mobile checks should distinguish desktop narrow-layout testing from testing on a physical iPhone.
- Native file sharing depends on browser support and HTTPS. Facebook's composer cannot receive arbitrary image attachments through its URL sharer; the app supplies the device share sheet, saved image, and copied caption.
- Optional AI is a user-mediated prompt workflow, not an integrated inference service. Citation validation checks allowed evidence IDs and response shape, not the correctness of prose.
- No production hosting or itch publication should be claimed until its remote result is observed.

## Rollback

Revert the offending source commit and let Pages redeploy the previous app. Rebuild and upload the prior verified static release for itch. Since no archive data is stored by the application, releases do not require user-data migrations.
