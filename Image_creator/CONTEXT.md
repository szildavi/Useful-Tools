# Context

A running log of what the project contains and why it is built that way.

## 2026-07-27 — First implementation

The whole application described in [SPECIFICATION.md](SPECIFICATION.md) was created.

### Decisions taken with the user

| Question | Chosen answer |
| --- | --- |
| Tech stack | Vanilla HTML / CSS / JS, no build step, no npm |
| Arrangement | Automatic fitting with manual override (drag, resize, delete) |
| Page setup | Paper presets + orientation, custom size in mm/inch, DPI |
| Export | Fully client side |

Margin and gap inputs were added on top of the chosen page settings, because the
automatic packing cannot place anything without knowing the free space it has to
keep. Both default to a small value (5 mm margin, 3 mm gap).

### How to run

Open `index.html` in a browser. There is nothing to install and no server is
needed: every script is a plain classic script, so the page works from the file
system too.

### How the pieces fit together

```
index.html          markup + the load order of every script
styles/main.css     the whole look of the editor
js/App.js           creates every part and connects them
js/core/            Observable, the small publish/subscribe base class
js/utils/           unit conversion, DOM helpers, canvas helpers, byte builder, download
js/model/           the data: paper presets, page settings, image asset, placed item, project state
js/services/        ImageLoader: files -> image assets
js/layout/          the automatic arrangement
js/render/          drawing the page and the selection
js/interaction/     selection, hit testing, drag and resize gestures
js/export/          PNG, JPG and PDF writers
js/ui/              the sidebar panels and the status bar
```

Everything lives on one global namespace (`window.ImageCreator`), which is what
lets the project stay build free while keeping one class per file. ES modules
were rejected on purpose: browsers refuse to load them over `file://`, so the
"just open index.html" promise would have been broken.

### The automatic arrangement

Millimeter is the canonical unit of the whole project, pixels only appear when
something is drawn or exported.

1. `AutoFitArranger` creates one rectangle per requested copy. The base size of a
   rectangle is the pixel size of its source image, so an image that is bigger in
   pixels also stays bigger on the printed sheet.
2. `UniformScaleSolver` searches (by bisection) for the largest single scale
   factor at which every rectangle still fits into the printable area. One shared
   factor is used for all of them, which is what keeps the size relation between
   different images intact.
3. `ShelfPacker` does the actual placing: it fills one horizontal row after the
   other. Rows were chosen over a tighter packing because a printed sheet is
   usually cut apart, and aligned rows are far easier to cut.
4. The finished block is centered inside the printable area.

`LayoutCoordinator` decides when this may run. As long as the user has not moved
anything, the page is rebuilt after every change. The first drag or resize sets
`hasManualChanges`, from then on the page is only rebuilt when the user presses
*Auto arrange*.

### Export

`PageImageFactory` renders the page into an offscreen canvas at the chosen DPI
using the very same `PageRenderer` the preview uses, so the preview and the
exported file cannot drift apart. Every format then works from that canvas:

- **PNG** and **JPG**: the canvas is encoded by the browser.
- **PDF**: `PdfDocument` writes a one page PDF by hand. Its media box is the real
  paper size in points, so the file prints without any scaling. The page image is
  embedded either as a JPEG stream (`DCTDecode`, the default) or, when *lossless*
  is ticked, as a deflate compressed RGB stream (`FlateDecode`) produced with the
  browser's own `CompressionStream`.

Writing the PDF by hand keeps the project free of external libraries, which was
the point of the no build step stack.

### Verification done

- Node test of the pure logic: shelf packing (including gaps and impossible
  cases), the scale solver, the arranger on the exact example of the
  specification (4 copies of one image + 1 of another on A4), page size and
  orientation maths, and the byte offsets of the generated PDF cross reference
  table.
- The generated PDF was checked with `pdfinfo` (reported as a valid 1 page A4
  document) and rendered with `pdftoppm`; a deliberately asymmetric test image
  confirmed the page image is not flipped upside down.
- `CompressionStream('deflate')` output was confirmed to be inflatable by zlib,
  which is what `FlateDecode` requires.
- End to end run in headless Firefox with real images: the copies are packed and
  drawn at the expected pixel positions, the image list, the drag, the resize,
  the manual override rule and the PNG / JPG / PDF encoders all behaved as
  intended.

### Known limits, possible next steps

- One sheet at a time. Items that do not fit are simply not placed; a multi page
  mode would be the natural next feature.
- Items are never rotated. Allowing a 90 degree turn would let the packer fit
  more onto a sheet.
- The printed size of an image comes from its pixel size. A per image size or
  weight control could be added later if a different relation is wanted.
- The shelf packer favours predictable rows over the tightest possible packing.
