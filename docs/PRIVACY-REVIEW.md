# Privacy and security review

Review date: 2026-11-10. Scope: the existing MVP and the subsequent local implementation. This is a source and behavior review, not a penetration test or a guarantee about a visitor's browser, extensions, operating system, or downloaded files.

## Privacy contract

- Import raw archives only inside the current browser tab; no server upload, analytics, cookies, or persistent application storage.
- Treat imported text as untrusted data. Escape it before HTML rendering and never execute archive content.
- Share only a previewed, aggregate report selected by the user. Omit raw excerpts, source paths, identifiers, and AI output from public sharing by default.
- Keep complete report exports explicitly private: they contain posts and may identify other people.
- Make optional AI data transfer explicit and reviewable. Raw posts must not be included by default.
- Clearing a session must cancel pending work and discard the application's references to imported data. It cannot erase files already downloaded, shares already sent, browser/OS history, or independent extension capture.
- Describe writing patterns and archive coverage; avoid diagnoses or claims that keyword/punctuation measures establish psychological traits.

## Baseline findings

| Finding | Baseline evidence | Required repair |
| --- | --- | --- |
| Stale import can repopulate a cleared session | `handleFiles` awaits file reads and writes `state.result`; reset does not invalidate the job | Cancellable worker plus a session generation check before applying results |
| Metadata can become a post | A timestamp plus `title` is enough for `isPostNode`; a synthetic title-only object produced one post | Require authored body text; do not count generated activity titles |
| Private-category exports need explicit exclusion | Nested `messages`/`comments` are excluded, but a root timestamp/message object is accepted | Reject known private source paths and private record shapes; document uncertainty for anonymous standalone records |
| Expansion budgets are incomplete | ZIP uses private JSZip size metadata and batch totals reset per file | Validate central directory bounds and entry count, set whole-job budgets, check decoded lengths, reject unsupported archives, run parsing off the UI thread |
| Sharing can disclose a sensitive aggregate theme | Share text automatically includes top categories | Preview exact public content and let the user omit themes and roast text |
| Full report export is too easy to mistake for a public report | Download immediately includes `posts` and evidence | Separate private export and require an explicit content warning/confirmation |
| Browser restrictions absent | No content security policy in source HTML | Add a restrictive static CSP, without breaking itch framing or the local worker |

## Existing strengths

The MVP loads a vendored ZIP library and local code only. It makes no network requests for analysis and does not use localStorage, IndexedDB, service workers, or cookies. The shared text and PNG contain derived counts/categories rather than post excerpts. All currently rendered imported text is escaped through the HTML-escaping function. External account-center links use `noopener noreferrer`. Local analysis explicitly states uncertainty, overlapping keyword topics, incomplete exports, and the absence of clinical inference.

## Verification and limitations

Baseline tests: 4/4 pass. Source inspection confirmed no persistence or upload code. Synthetic probes confirmed title-only metadata and anonymous root message objects were accepted; nested message/comment collections were excluded.

## Implementation review

The importer now runs in a dedicated module worker and cancellation terminates it. The UI invalidates the active session generation before clearing, so old import callbacks cannot apply a result. Post extraction excludes private source paths/containers and activity titles, uses bounded traversal, and retains HTML as literal text. Duplicate matching uses the entire normalized text at the same timestamp.

ZIP parsing now checks central-directory bounds, entry counts, declared sizes, supported compression, encryption, ZIP64, and split-archive flags before loading candidate entries. Actual decompressed data is streamed and stopped if it exceeds declared size or the per-file limit. Whole-selection limits are 100 MiB input, 90 MiB candidate expanded JSON, 24 MiB per JSON file, and 150 candidate files. Malformed individual JSON files produce coverage notices without hiding valid files.

Public sharing defaults to counts and calendar-year range. Topics and local roast text are optional, previewed, and disabled initially. No raw excerpts, rare words, archive filenames, search terms, or external AI output enter public cards. Complete report downloads require a separate dialog explaining that the JSON contains original post text.

The optional AI round trip contains fixed category labels, year counts, and punctuation totals only. It excludes post text, names, archive paths, post dates, and rare-token frequencies. The visitor transfers the prompt manually and explicitly; this application makes no provider request and accepts no API key. Imported AI text is length/schema checked, clinical keywords are rejected, and every observation must reference an existing aggregate evidence ID. These checks validate format/references only, not factual meaning or inference. The displayed result states that its claims remain unverified.

All new post/AI HTML output inspected in source uses the escaping function; canvas output draws text, not HTML. A static content security policy restricts scripts and workers to this origin, forbids programmatic network connections, objects, form submission, and base-URL changes, and permits inline styles used for chart widths. It leaves embedding unrestricted for itch.io. Async AI import, prompt download, PNG save, and native-share preparation check the current session generation before applying data after an await. The roast selection warns that it can mention interests even when the separate topic option is disabled.

Topic shifts are normalized by the number of posts per represented year and suppressed for sparse years. Possible contradictions are explicitly uncertain paired preference statements about the same hobby, rather than established hypocrisy or psychological traits.

## Remaining review items and inherent limits

- The final browser smoke test should verify cancellation, literal rendering of HTML-shaped text, exact sharing previews, optional AI prompt round trip, and no analysis-related network requests.
- Final source review confirmed the requested CSP and asynchronous session guards. No unresolved release-blocking issue was found in the reviewed source; browser behavior still needs the separate smoke-test record.
- A generic anonymous standalone JSON record can be ambiguous: a timestamp/message pair cannot prove whether the author intended a public post. Known Meta private paths and containers are excluded, but visitors must select their own Posts export.
- A worker and streaming size checks reduce memory risk but do not guarantee every hostile ZIP is safe or that a 100 MiB archive fits a low-memory phone. Export smaller date ranges if necessary. JSZip must still load archive metadata, and JSON parsing temporarily duplicates decoded data in memory.
- AI evidence IDs are based on aggregate content, not a cryptographic fingerprint of raw posts. Identical aggregate reports can produce the same identifier. Clinical word filtering is a best-effort guard that can reject harmless disclaimers or miss rephrased unsupported claims; human review remains necessary.
- Clearing this tab cannot revoke downloaded private reports, external prompt/response copies, completed shares, browser/OS artifacts, or data captured independently by extensions. No server-side deletion endpoint is needed because the application stores no imported records on a server.
- HTML exports, media analysis, automatic Facebook account access, authored-versus-repost attribution, and non-English topic understanding remain outside this release.

Current automated verification: 25/25 tests pass, including importer privacy exclusions, malformed/oversized ZIP handling, bounded decompression, cancellation, duplicate safety, aggregate AI packet exclusion, invalid evidence rejection, and nonclinical/uncertainty behavior. Final browser behavior should be recorded in the release QA report.
