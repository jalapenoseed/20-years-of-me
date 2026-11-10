# QA record — Facebook Autopsy 0.2.0

Date: November 10, 2026. Source: supplied functional MVP, preserved and extended.

## Automated validation

The Node test suite passes **30 tests**, covering:

- Meta post containers, seconds/milliseconds/ISO timestamps, top-level authored text, invalid dates, and title-only activity exclusion.
- Message, comment, tagged-content and unrelated-file exclusions.
- Valid files surviving malformed companions, split archive folders, exact full-text deduplication, and multiple-archive duplicate handling.
- Combined input limits, cancellation, traversal caps, damaged/encrypted/ZIP64 archives, size discrepancies, bounded decompression, and forged central-directory sizes using the actual JSZip inflater.
- Calendar gaps, normalized topic shares, sparse-year suppression, dated evidence, recurring topics, and explicitly uncertain hobby wording changes.
- AI prompt exclusion of raw text, filenames, email-like strings, individual post dates, and token frequencies; response citation validation and clinical-label rejection.

`npm run verify` builds the static app and checks module syntax/imports, relative assets, the mobile viewport, and exclusion of development/data directories. Release packaging uses only the production output for the HTML5 ZIP.

## Browser regression suite

`npm run test:browser` launches Chromium against the production build at desktop and iPhone 13 viewport sizes. GitHub Actions installs the browser and runs this suite before Pages deployment.

Covered flows: demo loading, year/search filters, pasted text, worker ZIP import, message exclusion, HTML rendered as text, aggregate-only share caption, PNG download signature, private-export confirmation cancellation, valid AI response display, clear/reload, horizontal overflow, and absence of unexpected external HTTP requests. Fixtures are synthetic and kept in memory.

GitHub Actions run 42917545174 passed the desktop and iPhone 13 Chromium suite against application commit e11ae372cecd870766ef548256eb1a706759d384. Final run 42917745659 also passed the added pasted-text HTML regression on desktop and iPhone Chromium, and its Pages deployment succeeded.

## Repairs found in independent review

| Finding | Repair |
| --- | --- |
| Distinct long posts could collapse after an identical 12,000-character prefix | Preserve full authored text before exact deduplication; regression exercises a longer shared prefix. |
| Actual ZIP expansion was checked only after whole-entry decoding | Accumulate bounded inflater chunks, stop on excess bytes, and reject declared-size discrepancies. |
| Possible hobby wording changes were hidden when normalized topic shifts were absent | Render wording-review candidates independently. |
| Plain-text AI prompt used a JSON extension and media type | Download as `.txt` with a text media type. |
| Import guidance described the limit per archive instead of per selection | State the combined selected-file limit. |

## Remaining limits

- Import validation uses synthetic fixtures representing supported Meta structures. No real personal Facebook archive was provided for QA; unrepresented export layouts may require adaptation.
- English keyword categories cannot establish endorsement, intent, offline events, personality, or psychiatric conditions. Sarcasm, quotations, multilingual text and incomplete exports affect findings.
- ZIP64, encrypted/split ZIPs, HTML exports, media understanding and Messenger analysis are intentionally unsupported. Safety limits may require separate date-range exports.
- AI is a deliberate aggregate-prompt export/response-import workflow, not an automatic hosted model. Citation and format checks do not prove a generated interpretation is true. Clinical term filtering is a guardrail with false positives and misses.
- iPhone-sized Chromium tests do not substitute for physical iOS Safari or the Facebook native share sheet. Native share availability depends on device/browser support; PNG download and summary copy are the fallback.
- Clearing the tab removes the app’s references and cancels its worker. It cannot erase saved downloads, copied text, browser-level remnants, or data already sent to another service.

## Release owner verification

Repository created: https://github.com/jalapenoseed/20-years-of-me

GitHub Pages source is configured to GitHub Actions. Run 42917545174 passed 30 unit tests, production build checks, desktop and iPhone Chromium playtests. Browser logs explicitly confirm worker ZIP import, message exclusion, XSS escaping, filters, PNG generation, private export, AI response validation, clear/reload and layout. The app is deployed by the dependent Pages job.

Direct browser testing also verified demo year/search filtering, invalid AI JSON rejection, literal rendering of pasted HTML (zero created image elements), and aggregate share text excluding the pasted post.

Verified public app: https://jalapenoseed.github.io/20-years-of-me/

The public app was opened and its fictional demo generated 26 timeline posts and an aggregate-only share preview successfully. Both verification and deployment jobs in final run 42917745659 completed successfully. Application assets are identical between the two verified release commits.

HTML5 release ZIP is prepared; itch.io publication has not been performed. Physical iOS Safari and actual Facebook native sharing remain unverified.
