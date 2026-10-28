# CONTEXT

A running log of everything added, changed or decided in this project, as required by `CLAUDE.md`.

---

## 1. Decisions taken with the user

Asked before any code was written; the user chose:

| Question | Choice |
| --- | --- |
| How to handle Office ↔ PDF conversion | **100% browser-only, no server at all** |
| Stack | **React + TypeScript + Vite** |
| How faithful "edit texts" must be | **Overlay / redact-and-retype** |
| Delivery sequencing | **Foundation first, then features** |

### Consequences the user was told about

- With no server, `pptx` / `odp` / `ods` → PDF cannot be done faithfully, and `docx` / `xlsx` → PDF
  will be an approximate re-render (text, styles, tables — not pixel-exact layout). The converter
  layer is built as a pluggable seam so a high-fidelity engine could be added later without
  touching the rest of the app.
- Text editing covers original glyphs and writes replacement text on top. It does not reflow the
  surrounding paragraph, because the original text operators are left untouched.

---

## 2. Project setup

- Scaffolded with `npm create vite` (`react-ts` template). Config files were copied into the
  existing folder because the directory already contained `CLAUDE.md` / `SPECIFICATION.md`.
- `package.json` renamed to `pdf-editor`, version `0.1.0`.
- Scripts: `npm run dev`, `npm run build`, `npm run lint`, `npm run preview`.

### Dependencies and why

| Package | Purpose |
| --- | --- |
| `pdfjs-dist` | Rendering pages to canvas, and reading positioned text |
| `pdf-lib` | Building and writing PDFs (copy pages, rotate, draw, export) |
| `@pdf-lib/fontkit` | Embedding TrueType fonts, needed for full Unicode text |
| `@dnd-kit/*` | Drag-and-drop page reordering |
| `mammoth` | Reading `.docx` into HTML |
| `jszip` | Reading OOXML / ODF containers, and bundling split output |
| `docx` | Writing `.docx` when exporting out of PDF |

`mammoth`, `jszip` and `docx` are loaded with dynamic `import()` at the moment they are first
needed, so they are separate chunks rather than part of the initial download. That took the first
load from 947 kB to **723 kB gzipped**.

### `xlsx` (SheetJS) was deliberately removed

It was installed, then uninstalled. The copy published on npm is a stale 2022 build with two
unpatched advisories (prototype pollution, ReDoS) and **no fix available**, and this app parses
untrusted files directly in the user's browser. Spreadsheets will instead be read through the same
`jszip` + `DOMParser` path already needed for `pptx` / `odp` / `ods`, which also avoids two code
paths doing the same job. `npm audit` now reports **0 vulnerabilities**.

### Bundled assets (privacy-critical)

- `public/fonts/` — 12 DejaVu TTF files (Sans / Serif / Mono × regular, bold, italic, bold-italic)
  plus their licence. **Why:** pdf-lib's built-in fonts are WinAnsi-only and cannot encode letters
  such as `ő` or `ű`; any text the user typed would fail to export. DejaVu is embedded instead, and
  subset on export so output files stay small. Fetched from the app's own origin, only when an
  export actually needs them.
- `public/pdfjs/` — `cmaps/`, `standard_fonts/`, `wasm/`, `iccs/` copied from `pdfjs-dist`.
  **Why:** pdf.js loads these on demand and would otherwise fetch them from a public CDN. Serving
  them locally is what makes the editor work offline and stops the fact that a document uses, say,
  a Japanese font from ever leaving the machine.
- `.oxlintrc.json` — added `ignorePatterns` for `public/**` and `dist/**` so the linter does not
  scan vendored assets.

---

## 3. Architecture

Two layers, deliberately separated so the PDF logic is testable and free of React:

```
src/core/    framework-free document, PDF, export and conversion logic
src/state/   React state hooks
src/hooks/   React hooks that bridge core services into components
src/components/  presentation
```

### `src/core/pdf/` — reading PDFs

| File | Responsibility |
| --- | --- |
| `PdfJsRuntime.ts` | Registers the bundled pdf.js worker once; exports `PDF_JS_ASSET_URLS` so every load points at local assets |
| `PdfDocumentLoader.ts` | Opens bytes with pdf.js; converts failures into `PdfLoadError` (with a `requiresPassword` flag) |
| `PdfPageRenderer.ts` | Renders one page to a blob-URL image at a target width; `releaseRenderedPage` frees it |
| `PdfTextExtractor.ts` | Reads positioned text runs (for overlay text editing) and plain text (for export) |
| `PageRotation.ts` | The `0 | 90 | 180 | 270` rotation type and turn helpers |
| `SourcePageGeometry.ts` | Reads a page's **unrotated** size and its **intrinsic** rotation |
| `TextLineGrouper.ts` | Reassembles pdf.js text fragments into visual lines |
| `RenderQueue.ts` | Limits how many pages render at once |

`TextLineGrouper` exists because a PDF stores text as positioned runs with no notion of lines, and
one sentence is usually split across several runs. Grouping them lets the user click a sentence and
replace it whole instead of editing fragments.

`RenderQueue` caps rendering at three pages at a time. Every mounted thumbnail asks to render
immediately, so a long document would otherwise start hundreds of renders that all compete for the
single pdf.js worker while each holds a full-page canvas.

`SourcePageGeometry` exists because the viewer and the exporter must agree on the coordinate space,
otherwise edits land in the wrong place on pages that carry their own `/Rotate`.

### `src/core/editor/` — the document model

- **`EditorDocument`** — ordered list of pages plus the map of opened sources. Immutable: every
  operation returns a new instance, which is what makes undo/redo and React change detection
  trivial. Operations: append source, replace/remove/move/duplicate page, set order, sort, select.
- **`EditorPage`** — a *reference* into a source (`sourceId` + `sourcePageIndex`) plus the edits on
  top (rotation, annotations). Nothing is copied until export, so reorder, duplicate and merge are
  all cheap and the original bytes are never mutated.
- **`PdfSource`** — one opened file: original `bytes` (for export) and the pdf.js `renderer` (for
  preview). Several pages may point at one source.
- **`EditorHistory`** — undo/redo as a stack of previous `EditorDocument` instances, capped at 50.
- **`Identifiers.ts`** — branded `SourceId` / `PageId` / `AnnotationId` so they can't be mixed up.
- **`PdfSourceOpener`** / **`FileOpeningService`** — the single entry point for getting a user's
  file in: PDFs open directly, anything else is converted to PDF first.

Sources are **never** dropped when their last page is deleted, because undo has to be able to bring
that page back. They are released only when the whole document is closed (`allSources()`).

### `src/core/editor/geometry/`

All editor geometry is in **PDF points with the origin at the page's bottom-left** — the PDF's own
coordinate system, and the space a content stream draws in. `PageCoordinateMapper` is the single
place that converts to and from browser pixels (top-left origin, y down) and applies rotation.

The rotation cases are derived from which page corner ends up at the display's top-left, and this
mapping was verified numerically (round-trips exact, corners in bounds, for all four rotations):

| rotation | corner at display top-left | display size |
| --- | --- | --- |
| 0 | top-left `(0, H)` | W × H |
| 90 | bottom-left `(0, 0)` | H × W |
| 180 | bottom-right `(W, 0)` | W × H |
| 270 | top-right `(W, H)` | H × W |

### `src/core/editor/annotations/` — user edits

Abstract `Annotation` base (immutable, `boundsInPage()`, `movedBy()`, `containsPoint()`) with:

- `DrawingAnnotation` — freehand polyline, colour, stroke width.
- `TextBoxAnnotation` — new text the user adds, in an area.
- `TextReplacementAnnotation` — the answer to "edit text in a PDF": covers a region with an opaque
  rectangle and writes replacement text in its place. Keeping cover + text as **one** annotation
  means the UI never has to hold two objects in sync.

`TextStyle` is shared by composition (not inheritance) so both text annotation types describe
styling identically.

### `src/core/export/` — writing the PDF

| File | Responsibility |
| --- | --- |
| `PdfExporter.ts` | Copies each page from its original file, applies rotation, paints edits. Untouched pages keep their exact original content, fonts and quality |
| `AnnotationPainter.ts` | One painter per annotation kind + a registry, so adding an annotation type means adding a painter and nothing else |
| `PdfFontProvider.ts` | Embeds and caches the DejaVu faces, subset per export |
| `TextLineWrapper.ts` | Wraps text to a width; honours explicit line breaks |
| `FileDownloader.ts` | Hands bytes to the browser's download flow via a blob |
| `SplitStrategy.ts` | How a document divides: per page, every N pages, or selected pages |
| `DocumentSplitter.ts` | Exports each group, bundling several files into one zip |
| `PdfTextReader.ts` | Reads a document's wording **with the user's edits applied** |
| `DocumentFormatExporter.ts` | Saves as PDF, plain text or Word |

Annotations are painted in the page's unrotated space with **no conversion**, because that is
already the content-stream space — so they rotate together with the page.

`PdfTextReader` matters for correctness: without it, saving as Word would extract the *original*
page text and silently discard every replacement the user made. It applies replacements to the
extracted text and appends the text the user added.

### `src/core/conversion/` — other formats in

The important design point (rule 2, no duplicated logic): reading and rendering are separate.

```
file → DocumentReader → DocumentContent (neutral blocks) → PdfContentRenderer → PDF bytes
```

- `DocumentContent.ts` — format-neutral blocks: heading, paragraph, list, table, page break.
- `DocumentReader.ts` — abstract reader; each format only describes what it contains and never
  touches pdf-lib.
- `rendering/PageLayoutCursor.ts` — all vertical flow and page-break logic for generated PDFs.
- `rendering/ContentTypography.ts` — the single source of typographic decisions.
- `rendering/ContentBlockRenderers.ts` — one renderer per block kind. Tables are **measured before
  they are drawn**, so a row that does not fit moves to the next page whole and the header row is
  repeated above it.
- `rendering/PdfContentRenderer.ts` — orchestrates the above; the only place that lays out
  generated PDFs, so every input format comes out looking consistent.
Readers, one per format family:

| Reader | Formats | How it reads them |
| --- | --- | --- |
| `PlainTextReader` | `txt` | Blank lines separate paragraphs, a form feed breaks a page |
| `WordDocumentReader` | `docx` | Through the semantic HTML mammoth produces |
| `OpenDocumentTextReader` | `odt` | Walks the body of `content.xml` directly |
| `SpreadsheetReader` | `xlsx`, `ods` | Each sheet becomes a table on its own page |
| `PresentationReader` | `pptx`, `odp` | Each slide becomes a page: title plus its text |

Shared helpers:

- `ZippedXmlDocument.ts` — one zip+XML reader for every Office and ODF format, with lookups by
  *local* name so the `w:` / `a:` / `text:` prefixes different producers emit do not matter.
- `HtmlToContentBlocks.ts` — HTML to content blocks, usable by anything that can produce HTML.

`SpreadsheetReader` reads Excel's XML itself rather than using a spreadsheet library — see the note
on `xlsx` above. It resolves shared strings, places values by their cell reference (`C5`) because
empty cells are simply absent, expands repeated ODF columns with a cap so a 900-column repeat
cannot explode, and trims the empty rows and columns spreadsheets keep beyond their content.

### `src/state/` — React state

- `useDocumentHistory` — the document plus its undo/redo stack.
- `usePageSelection` — takes the document and filters the selection against it on every read, so
  deleting or undoing can never leave a stale id selected.
- `useBackgroundTask` — shared busy message + error capture, so no async failure becomes an
  unhandled rejection.
- `useEditorSession` — the single source of truth, wiring the model to the UI. Every action is
  intentionally tiny: it describes one change and hands it to the history.
- `EditorTool.ts`, `ToolSettings.ts` — tool identity and drawing/text settings.

### `src/hooks/`

- `useRenderedPage` — renders a page to fit an area and keeps it in sync with rotation. The
  previous image stays on screen until the new one is ready (no flash), and each image is released
  exactly once. Only raster-affecting properties are watched, so adding an annotation does not
  re-render the page image. Work goes through the shared `RenderQueue`.
- `useFileDropTarget` — lets any element accept dropped files; counts enter/leave events because
  they fire repeatedly over child elements.
- `useElementSize` — reports an element's size via `ResizeObserver`, rounded so sub-pixel changes
  do not cause a re-render storm.
- `useSourcePageGeometry` — the unrotated size and intrinsic rotation the overlay needs.
- `usePageTextLines` — the existing text lines of a page, read only when the text tool is active,
  because extracting text costs more than rendering the image.
- `useKeyboardShortcuts` — Ctrl+Z, Ctrl+Shift+Z / Ctrl+Y, Ctrl+A and Delete, ignored while the user
  is typing in a field. Added because the toolbar tooltips already advertised these.

### `src/components/`

Page management: `App`, `WelcomeScreen`, `TopBar`, `PageGrid`, `PageCard`, `PageThumbnail`,
`FilePicker`, `StatusOverlay`, `SaveDialog`.

Single-page editing, in `components/viewer/`:

- `PageEditor` — the page shown large, with the overlay and tools around it. It receives the active
  page as a prop rather than reading it from the session, so its hooks always run.
- `AnnotationLayer` — draws edits over the page image: strokes as SVG, text as positioned HTML.
- `usePageGestures` — turns pointer gestures into edits according to the active tool. Work in
  progress is held locally and only handed to the document when the gesture ends, so one pen stroke
  is one undo step rather than hundreds.
- `ToolPalette` — the tool buttons and their colour, width, font and size settings.
- `AnnotationInspector` — edits the selected annotation's wording, size, colour, and for a
  replacement the colour covering the original text.
- `PageFilmstrip` — a vertical strip for moving between pages while editing.

Each has a co-located `.css` file. Shared button styling lives once in `styles/global.css` as
`.button` and its modifiers.

---

## 4. Notable corrections made during the build

Recorded because they were real bugs, not style choices:

1. **270° rotation mapping was wrong** — width and height were swapped in both directions of
   `PageCoordinateMapper`. Self-consistent, so it would have silently misplaced every edit on
   270°-rotated pages. Re-derived and verified numerically.
2. **Parameter properties are not allowed** — the Vite template sets `erasableSyntaxOnly: true`,
   which forbids `constructor(private readonly x)`. All classes use explicit field declarations.
3. **Table header repeat was checked after drawing the row**, so it could never fire. Split into
   measure-then-draw.
4. **`useRenderedPage` released the on-screen image** in its effect cleanup, which would have
   flashed a broken image on every rotation change. Reworked around a ref.
5. **`usePdfJs` renamed to `getConfiguredPdfJs`** — it looked like a React hook and was not one.
6. **`usePageSelection` had a `selectAll` stub** plus a smuggled extra method; rewritten to take
   the document directly.
7. **Pages did not stay inside their card** (reported by the user, measured in the browser and
   fixed). Two bugs with one root cause — sizing by width instead of fitting a box:
   - Unrotated portrait pages **overflowed and were clipped**: displayed at 247px inside a 229px
     card (108% of card height) with `overflow: hidden` cutting off the top and bottom. The
     `max-height: 100%` on the image never applied, because the grid area it resolves against has
     no definite height.
   - Rotated pages filled only **54%** of the card, because scaling to a target *width* says
     nothing about fit once a portrait page has become landscape.

   `PdfPageRenderer.renderPageToWidth` was replaced by **`renderPageWithinBox`**, which scales by
   `min(boxWidth / pageWidth, boxHeight / pageHeight)` so the page is as large as it can be while
   still fitting whole. The image CSS was changed to `width/height: 100%` with
   `object-fit: contain`, so containment is guaranteed by the layout independently of the render
   size. `useRenderedPage` now takes an area (width and height in CSS pixels) and renders at the
   screen's pixel density, capped at 2×. Card proportions changed to A4 (`1 / 1.414`).

   Verified after the fix: portrait pages 260×367 and rotated pages 260×183, both inside a
   260×368 box, nothing clipped.
8. **The text preview disagreed with the exported file.** Replacement text that did not fit its box
   was clipped on screen (`overflow: hidden`) but flowed past the box on export, so wording could
   vanish from the preview while appearing in the file — or run off the page unnoticed. Found while
   testing a replacement on a large watermark. Text is now deliberately *not* clipped to its box in
   either place: it flows exactly as the exporter writes it, the page edge being the only clip, so
   the preview always matches the output and the user can see when text needs resizing.
   `overflow-wrap` was set to `normal` to match `TextLineWrapper`, which leaves an over-long word
   overflowing rather than splitting it.
9. **Delete was ambiguous** once the page editor existed: it meant both "delete selected pages" and
   "delete the selected edit". The document-level shortcut now stands down while one page is open.
10. **Dead code removed** rather than left to rot: `EditorDocument.withPagesSortedBy`,
    `PageCoordinateMapper.toPageLength`, the `PdfJsPage` and `FileExtension` type aliases, and a
    re-exported zip MIME constant. `reversePageOrder` and `closeDocument` existed in the session but
    had no UI, so they were given toolbar buttons instead of being deleted.

---

## 4b. Second round of fixes, from the user's report

The user reported that replacement text lost the original's style and background colour, that
drawings "went back" behind text, and asked for PNG/JPG export.

### Replacement text now keeps the original's appearance

Only the font *size* was carried over; family, weight, slant and colour all came from the tool's
defaults, so replacing red bold serif text produced black regular sans. The cover colour was always
white, which showed as a white rectangle on any coloured background.

- `PdfTextExtractor` now reports each run's family, weight and slant. Family comes from pdf.js's
  `styles` map; weight and slant come from the loaded font objects, which are **not** part of
  pdf.js's published types — that single cast is isolated in `PdfJsInternals.ts` so there is one
  place to revisit if pdf.js changes. Fonts only exist after a page has been drawn and asking too
  early throws, so a page whose fonts are not ready reports plain text rather than failing.
- `TextLineGrouper` gives each line a full `TextStyle`, taken from the run covering most of the line.
- **Colour cannot be recovered from the text layer at all**, and the colour *behind* the text is
  recorded nowhere. `PageImageColorSampler` therefore reads both from the pixels that were actually
  drawn: it buckets the pixels in the line's box, takes the largest group as the background and the
  most distant meaningful group as the text.
- Buckets report the **average true colour of their pixels**, not the bucket's centre. Rounding to
  the nearest bucket left the cover up to half a step off, which was visible as a faint rectangle
  over a coloured band. Averaging makes it exact — verified as `rgb(33, 107, 217)` against a band
  drawn at `rgb(33.15, 107.1, 216.75)`.

### Layer order

`AnnotationLayer` grouped edits by kind — one SVG holding every drawing, then every text edit — so
**all text always painted above all drawings on screen**, whatever order they were made in, while the
exporter painted them in the real order. A drawing made after a text replacement appeared to slide
behind it, and the replacement's opaque backing swallowed it.

Edits now render strictly in the page's own order, each in its own stacked element, so the screen
matches the exported file. `EditorPage.withAnnotationMoved` reorders an edit within the page, and a
new **`LayerPanel`** lists the edits top-most first with bring-forward, send-backward and remove.

### Two further problems found while testing this

- **A replacement wrapped like a paragraph.** Since the embedded DejaVu is wider than the Helvetica
  it replaces, the same words no longer fitted the original line's width and wrapped onto a second
  line, sliding down over whatever followed. A replacement stands in for *one line*, so it now stays
  on one line and simply runs on past the original width; only line breaks the user types break it.
  Applied in both the painter and the overlay, so preview still matches export.
- **Clicking an already-replaced line stacked a second block on top of the first.** Clicking one now
  reopens the existing edit.

### PNG and JPG export

`PageImageExporter` renders one image per page. It renders the **exported PDF**, not the original
files, which is what makes drawings and replaced text appear in the images, and means there is no
second drawing path that could disagree with the PDF. Resolution is selectable (96, 150 or 300 DPI);
JPEG gets a white background painted first, because it cannot store transparency and unpainted areas
would otherwise come out black. One page yields one image, several yield a zip.

`ZipArchiveWriter` was extracted at this point, because splitting and image export both needed
bundling and rule 2 forbids two copies of it.

---

## 5. Verification performed

The app was driven in **headless Edge over the Chrome DevTools Protocol** (no extra dependencies —
Node 26 has a built-in `WebSocket`), using real mouse press/move/release events so the drawing and
text gestures are exercised the way a person would. Test fixtures were generated programmatically:
a 6-page PDF (one page carrying an intrinsic `/Rotate 90`), a 60-page PDF, and genuine `docx`,
`xlsx`, `pptx`, `odt`, `ods` and `odp` files.

**Everything below was run against the production build (`npm run build` + `vite preview`), not the
dev server.**

Page management:

- All 6 pages render as thumbnails; 0 stuck placeholders, 0 page errors.
- Selecting and rotating a page works and marks it "edited".
- Export produces valid PDF bytes: after rotating page 2 twice and deleting page 4, the exported
  file has 5 pages, page 2 at `180°`, and the intrinsically-rotated source page still at `90°`.

Editing:

- A freehand stroke drawn by real mouse movement appears in the overlay and in the exported file.
- The text tool finds 4 editable lines on the sample page; clicking one opens the inspector showing
  the original wording.
- Replacement and added text containing `Átírt`, `őrült`, `ÁÉÍÓÖŐÚÜŰ` render on screen **and are
  present in the exported PDF's extracted text** — proving the embedded-font work was necessary and
  correct. pdf-lib's built-in fonts would have failed outright on `ő` and `ű`.

Conversion, all six formats, each producing the expected number of pages:

| File | Pages produced |
| --- | --- |
| `sample.docx` | 1 |
| `sample.odt` | 1 |
| `sample.xlsx` | 2 (one per sheet) |
| `sample.ods` | 2 (one per sheet) |
| `sample.pptx` | 3 (one per slide) |
| `sample.odp` | 2 (one per slide) |

Slides also sort numerically, so `slide10.xml` lands after `slide2.xml` rather than before it.

Saving:

- Plain text: 597 bytes, all six pages present.
- Word: 8.7 kB, valid `PK` zip container.
- Split one-file-per-page and every-2-pages both produce a zip; unpacking the every-2 zip gives
  `sample-pages-1-2.pdf`, `sample-pages-3-4.pdf`, `sample-pages-5-6.pdf`, each with 2 pages.

Scale and privacy:

- A **60-page** document renders its first thumbnail in 0.4 s and all 60 in 1.3 s, with 0 stuck
  placeholders, and selection still works afterwards.
- **No external network requests in any run** — every request was same-origin.

`npx tsc -b` clean, `npx oxlint` clean, `npm audit` reports 0 vulnerabilities, `npm run build`
succeeds.

### One thing worth recording honestly

During one run on a loaded machine (four servers up at once), two of six thumbnails were still
showing "Rendering…" after 20 seconds. Investigated rather than dismissed: on a clean profile all
six rendered in under 5 seconds, and no leftover browser processes remained, so the cause was CPU
contention rather than a hang. It did reveal a real scalability weakness though — every mounted
thumbnail started its own render — which is why `RenderQueue` now caps concurrency at three. The
60-page result above is the check on that.

---

## 6. Status against the specification

| Requirement | Status |
| --- | --- |
| Show the pages of the PDF | **Done** — thumbnail grid, plus a large single-page view |
| Sort/reorder pages as the user wants | **Done** — drag and drop, plus reverse order |
| Delete pages | **Done** |
| Merge pages | **Done** — opening more files appends their pages |
| Split pages | **Done** — per page, every N pages, or selected pages; several files arrive as a zip |
| Draw on the PDF | **Done** — freehand, with colour and stroke width |
| Edit texts in the PDF | **Done** — click a line of existing text and retype it; also add new text |
| Export to PDF | **Done** |
| Convert other formats → PDF | **Done** — `txt`, `docx`, `odt`, `xlsx`, `ods`, `pptx`, `odp` |
| Convert PDF → other formats | **Done** — plain text, Word, PNG and JPG, with the user's edits applied |
| Privacy first | **Done** — no server, no external requests, all assets bundled |

Added beyond the specification, at the user's request: **PNG/JPG export** and a **layer panel** for
managing which edit sits on top.

### Known limits, stated plainly

These follow from the browser-only decision and are not defects to be fixed later without changing
that decision:

- **Office → PDF is a re-render, not a faithful reproduction.** Headings, paragraphs, lists and
  tables come across; exact page layout, images, positioned objects, themes and slide graphics do
  not. Reproducing those needs a real word processor or presentation engine.
- **Text editing covers and rewrites; it does not reflow.** The original glyphs are hidden behind an
  opaque rectangle and the new text is written on top, which works on any PDF regardless of how its
  fonts are embedded or subset. Surrounding paragraphs do not move, and replacement text longer than
  the original runs on past where the original ended — deliberately visible rather than silently
  clipped, so it can be shortened or resized.
- **Replacement text is set in DejaVu, not the page's original font.** The style is matched (family
  class, weight, slant, size and colour) but the actual typeface is not, because a PDF's embedded
  fonts are usually subset to just the glyphs already used and cannot render new characters. DejaVu
  is a little wider than Helvetica, so replaced text takes slightly more room than the original.
- **The cover colour is sampled from the page**, which handles flat backgrounds exactly. Over a
  gradient, photograph or pattern a single flat colour cannot match, so the inspector still lets the
  user choose one.
- **PDF → Word/text carries wording only**, not layout, images or fonts. The save dialog says so
  before the file is written.
- **Encrypted PDFs are detected but not opened.** `PdfLoadError` carries a `requiresPassword` flag
  and the loader reports a clear message, but no password prompt is wired up yet.
- **Scanned PDFs have no text to edit.** There is no OCR, so the text tool finds nothing on a page
  that is just an image; drawing and page operations still work.
