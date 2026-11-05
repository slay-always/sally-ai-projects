# Repository preparation and verification

Prepared November 5, 2026 from the candidate's local project files. Original files were not changed.

## Sharing edits

### Interview workflow

- Converted selected parts of the supplied Colab Python export into a notebook with explanations and empty outputs.
- Included the original file readers, Word exporter, initial-codebook prompt/action, and two-pass feature extraction/consolidation code.
- Removed the hard-coded credential, original Colab document link, private folder reference, and identifying example from the codebook prompt. A hidden key prompt or environment variable now supplies credentials.
- Added a generic input-folder setting and two explicitly fictional example interviews.
- Removed the mode wrappers around the two selected actions; each is now a separate notebook action. Omitted the unused fast-model constant and unrelated package-uninstall command. The omitted theme-validation, frozen-codebook, and visualization sections remain in the untouched original export.
- Preserved the historical SDK, model names, and remaining workflow logic. No SDK migration or new model evaluation was performed.

### Slay Mandarin

- Used the `slay-mandarin-update` local source folder. This choice is based on the folder's name and inspected contents; correspondence with the last deployed build is not confirmed.
- Replaced eight hard-coded key references with a shared environment-configured client helper that stops Gemini requests when no key is configured.
- Excluded `.env.local`, dependencies, generated bundles, old versions, recordings, and exam archives.
- Included four inspected screenshots from the original app.
- Omitted the original embedded video-feed data and unused question-data file; supplied an empty feed list. Placed runtime manifest, icon, service worker, and feed under Vite's public-assets folder.
- Removed a reference to an absent `index.css` file. The original inline styling and CDN styling remain.
- Added project documentation and a credential-free environment example. No backend proxy or live deployment was added.

## Verification

These checks describe portfolio preparation, not validation performed during the original projects.

Passed:

- Slay Mandarin production build (`npm run build`) using a temporary copy of the existing local dependencies.
- TypeScript check (`tsc --noEmit`).
- Browser inspection of the built app's initial interface using a local preview server with no Gemini key configured.
- Parsing of all six notebook code cells, treating the Colab installation magic separately; all notebook outputs are empty.
- Isolated checks of the original TXT/DOCX readers, Word heading/list export, plain and fenced JSON parsing, malformed-JSON rejection, and filename-preserving extraction prompt.
- A pattern scan for Google/OpenAI credentials and the known identifying examples from the supplied transcript source.

Not tested: live Gemini calls, current model availability, a complete Colab run, the PDF reader at runtime, semantic extraction accuracy, quotation fidelity, live voice input/output, deployed PWA behavior, or learning outcomes. The historical source's exact match to the last deployed app remains unconfirmed.

No original credentials were used. Dependencies, generated bundles, and Git metadata are excluded from the upload ZIP. The repository has no remote configured and has not been published.
