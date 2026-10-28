# PDF Editor

A PDF editor that runs entirely in your browser. There is no server, nothing is uploaded, and
closing the tab erases everything.

## Running it

```bash
npm install
npm run dev
```

Then open the address Vite prints. To check the production build:

```bash
npm run build
npm run preview
```

## What it does

**Pages** — view every page as a thumbnail, reorder them by dragging, select one or several
(ctrl/shift-click), rotate, duplicate, delete, and reverse the whole order. Opening more files
appends their pages, which is how merging works.

**Editing** — double-click a page to open it large, then:

- *Draw* freehand in a colour and width of your choosing.
- *Add text* by dragging a box and typing into it.
- *Edit text* by clicking a line of the page's existing text and retyping it. The original is
  covered and your wording written in its place, matching the original's size, weight, slant and
  colour, with the cover colour sampled from the page so it blends in.
- *Select* to move or remove an edit.

The **Layers** panel on the right lists every edit on the page, top-most first, so you can bring one
forward, send it backward, or remove it. That order is the order it is drawn in the saved file.

**Saving** — save the whole document as PDF, PNG, JPG, plain text or Word, or split it into several
PDFs (one per page, every N pages, or the pages you selected). Anything that produces more than one
file arrives as a zip. Images can be saved at 96, 150 or 300 DPI and include all your edits.

**Opening other formats** — `pdf`, `txt`, `docx`, `odt`, `xlsx`, `ods`, `pptx`, `odp`. Anything that
is not already a PDF is converted to one first.

## Keyboard

| Key | Action |
| --- | --- |
| `Ctrl+Z` | Undo |
| `Ctrl+Shift+Z` or `Ctrl+Y` | Redo |
| `Ctrl+A` | Select every page |
| `Delete` | Delete the selected pages, or the selected edit while editing a page |
| `Escape` | Deselect the current edit |

## Worth knowing

Converting an Office file to PDF re-renders its **content** — headings, paragraphs, lists and
tables. It does not reproduce exact layout, images or slide graphics; that needs a real word
processor, which a browser-only tool cannot provide.

Editing text covers the original and writes over it, so surrounding paragraphs do not reflow. A
replacement stays on one line and runs on past where the original ended if it is longer — visible on
purpose, so you can shorten it or reduce the size in the panel on the right.

Replacement text is set in DejaVu rather than the page's own typeface. Its size, weight, slant and
colour are matched, but the exact font cannot be reused: PDFs normally embed only the glyphs a
document already uses, so the original font has no letters to spare for new words. DejaVu is
slightly wider than Helvetica, so replaced text takes a little more room.

The cover colour is sampled from the page, which matches a flat background exactly. Over a gradient
or a photograph no single colour can match, so pick one yourself in the panel.

Encrypted PDFs are recognised but cannot be opened yet, and scanned pages have no text to edit
because there is no OCR.

## Privacy

Every dependency the app needs at runtime is bundled and served from its own origin, including
pdf.js's character maps, standard fonts, WebAssembly decoders and colour profiles, which pdf.js
would otherwise fetch from a public CDN. Verified by driving the app in a real browser and asserting
that no request left the origin.

## Layout

```
src/core/       document, PDF, export and conversion logic, free of React
src/state/      React state
src/hooks/      hooks bridging core services into components
src/components/ presentation
public/fonts/   DejaVu fonts, embedded into exported PDFs
public/pdfjs/   pdf.js support files
```

`CONTEXT.md` records the decisions, architecture and verification behind all of this.
