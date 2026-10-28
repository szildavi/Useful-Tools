# CONTEXT

A running record of everything added to this project, why it exists and how it fits together.
See [SPECIFICATION.md](SPECIFICATION.md) for the requirements and [CLAUDE.md](CLAUDE.md) for the coding rules.

## 1. Decisions taken up front

Four questions were asked before any code was written. The answers were:

| Question | Choice |
| --- | --- |
| Tech stack | Vanilla HTML / CSS / JavaScript — no build step, no dependencies |
| QR encoding | Written from scratch against ISO/IEC 18004, not a third-party library |
| Export formats | PNG, JPG **and** SVG |

Because there is no build step and no npm install, the app runs by opening `index.html`
directly in a browser. Plain `<script>` tags are used instead of ES modules on purpose:
ES modules are blocked by the browser on `file://` URLs, which would have forced the user
to run a local web server.

## 2. How to use it

1. Open `index.html` in any modern browser.
2. Type a link or text; the preview updates as you type.
3. Adjust shapes, colours, size and logo on the left.
4. Pick a file name and press **PNG**, **JPG** or **SVG**.

## 3. Requirement coverage

| Requirement from the specification | Where it is met |
| --- | --- |
| Generate QR codes in a website | `js/core/QrCodeGenerator.js` driven by `js/app/QrStudioApp.js` |
| Different square types (round, square, …) | `js/render/ModuleShape.js`, `js/render/EyeShape.js` |
| Different colours | `js/render/ColorFill.js` — solid colours and gradients, separate colours for the corners |
| Logos in .jpg / .png (and more) | `js/app/LogoImageLoader.js`, drawn by both renderers |
| Export as a high-quality image | `js/export/QrExporter.js` — up to 8192 px raster, or lossless SVG |
| Different sizes | "Export size" control, honoured by every renderer |

## 4. Project layout

```
index.html            The page and the script load order
css/styles.css        All styling, light and dark theme
js/main.js            Starts the app once the page is ready

js/core/              Turning text into a QR matrix (no drawing, no DOM)
js/render/            Turning a matrix into shapes, colours and pixels
js/export/            Saving the result as a file
js/app/               The control panel, the preview and user feedback
```

The four folders form a one-way chain: `app` → `export` → `render` → `core`.
Nothing in `core` knows about the DOM, which is what made it testable on its own.

## 5. The QR core (`js/core/`)

An implementation of ISO/IEC 18004 covering versions 1–40 and all four error-correction levels.

| File | Responsibility |
| --- | --- |
| `BitBuffer.js` | Append-only bit sequence, converts to codewords |
| `GaloisField256.js` | Multiplication in GF(256) with polynomial 0x11D |
| `ReedSolomonEncoder.js` | Builds the divisor polynomial and the error-correction codewords |
| `ErrorCorrectionLevel.js` | The L / M / Q / H levels and their format bits |
| `QrMode.js` | Numeric, alphanumeric and byte modes with their character-count field sizes |
| `QrVersionTable.js` | Capacity tables, block counts and alignment-pattern positions |
| `QrSegment.js` | Encoded text plus its bit cost in a given version |
| `QrSegmentEncoder.js` | Picks the most compact mode the text allows and encodes it |
| `QrCodewordBuilder.js` | Padding, block splitting, error correction and interleaving |
| `QrMaskPattern.js` | The eight mask formulas |
| `QrPenaltyScorer.js` | Scores a masked matrix so the best mask can be chosen |
| `QrMatrix.js` | The finished grid plus its metadata |
| `QrMatrixBuilder.js` | Function patterns, data placement, masking, format and version info |
| `QrCodeGenerator.js` | The entry point: text in, `QrMatrix` out |

Notable behaviour:

- **Automatic version choice.** The smallest version that fits the content is used.
- **Error-correction boost** (on by default). If the chosen version has spare room,
  the level is raised for free, so a short link often ends up at H instead of M.
  Turn it off with the checkbox if you need an exact level.
- **UTF-8** text is handled through byte mode.

## 6. Rendering (`js/render/`)

The key design decision: **geometry is described once, as SVG path strings, and both
renderers consume it.** The canvas renderer feeds those strings to `Path2D`, and the SVG
renderer writes them into `<path d="…">`. Without this, every shape would have had to be
implemented twice (rule 2: no two code segments doing the same thing).

| File | Responsibility |
| --- | --- |
| `PathGeometry.js` | Rectangles, circles and rounded rectangles as path strings |
| `ShapeRegistry.js` | Named catalogue of shapes; also feeds the dropdown lists |
| `ColorFill.js` | `SolidColorFill` and `LinearGradientFill`, each able to paint on canvas and in SVG |
| `ModuleShape.js` | Square, rounded, extra rounded, dots, small dots |
| `EyeShape.js` | Corner frame and corner centre shapes: square, rounded, extra rounded, circle |
| `QrRenderOptions.js` | Every visual setting in one object, with defaults and the logo layout |
| `QrPathBuilder.js` | Matrix → body path, eye frame path, eye ball path |
| `QrRenderer.js` | Shared base: builds paths, fits the logo, defines the abstract `render` |
| `CanvasQrRenderer.js` | Draws to a canvas at any pixel size (preview, PNG, JPG) |
| `SvgPaintCollection.js` | Collects SVG paints so a reused fill is defined only once |
| `SvgQrRenderer.js` | Produces a standalone SVG document |

Details worth remembering:

- Rounded module shapes only round the corners that have **no** dark neighbour, so runs of
  modules flow into each other instead of looking like separate beads.
- Eye frames are drawn as an outer and an inner shape in one path with the **even-odd**
  fill rule, which punches the hole without a second colour.
- The three finder patterns are excluded from the body path and drawn by the eye shapes,
  which is what lets them have their own shape and colour.
- A logo **clears** the modules underneath it (`QrPathBuilder.isCleared`) rather than just
  covering them, so a transparent logo never shows pattern through it.

## 7. Export (`js/export/`)

- `FileDownloader.js` — turns a blob into a download.
- `QrExporter.js` — PNG (keeps transparency), JPG (forces an opaque background, quality 0.95),
  SVG (vector, so quality is independent of size). Raster exports render a fresh canvas at
  the requested size, so nothing is upscaled from the preview.

## 8. The app layer (`js/app/`)

| File | Responsibility |
| --- | --- |
| `ColorContrast.js` | WCAG relative luminance and contrast ratios |
| `LogoImageLoader.js` | Reads a picked PNG/JPG/WebP/GIF/SVG into an image plus a data URL |
| `ScanSafetyAdvisor.js` | Turns a design into plain-language warnings |
| `QrFormReader.js` | Reads the control panel into a design description |
| `QrStudioApp.js` | Events, live preview, feedback, downloads |

The preview redraws 100 ms after the last keystroke and is capped at 1000 px for speed;
exports always render at the full requested size.

### Scan-safety warnings

The advisor flags the mistakes that actually stop codes from scanning: a quiet zone under
4 modules, modules under 4 px wide, contrast below 3:1, a pattern lighter than its
background, a logo over 25% of the code, a logo without Q/H error correction, and
transparent backgrounds.

## 9. Verification

The core was checked before any interface was built on top of it.

- **Specification tables** — published byte capacities for 15 versions across all four levels,
  alignment-pattern positions, format-information codes (including the BCH minimum distance
  of 7), version-information codes (minimum distance 8), and Reed-Solomon syndromes.
- **Structural invariants** — for all 40 versions, the modules left free by the function
  patterns equal the raw data module count, and the interleaved stream length equals the
  version's total codeword count at every level.
- **Round-trip decoding** — an independent decoder reads the finished matrix back the way a
  scanner does: format information → unmask → zig-zag read → de-interleave → verify every
  block's Reed-Solomon syndromes are zero → decode the payload. **217 of 217 symbols**
  round-tripped exactly, covering every version 1–40 at every error-correction level, plus
  numeric, alphanumeric, UTF-8, Wi-Fi and vCard payloads.
- **Rendering** — every combination of module and eye shape produces one subpath per dark
  module with no malformed numbers; SVG structure, gradients, transparency and logo placement
  were all checked, and the output was rendered in a browser and inspected.
- **Export** — PNG and JPEG magic bytes verified, transparency confirmed present in PNG and
  correctly replaced with white in JPG, canvas dimensions confirmed to match the request.

Two real bugs were found and fixed this way:

1. `QrVersionTable` — the error-correction block-count row for level H was missing its
   version 32 entry, which shifted every value from version 32 upward and gave version 40-H
   the wrong capacity (1186 instead of 1276 data codewords).
2. `QrMatrixBuilder.appendBchRemainder` — the BCH remainder loop tested the wrong bit
   (`>>> remainderBitCount` instead of `>>> remainderBitCount - 1`), corrupting format and
   version information.

A third bug was found by looking at the rendered page: `.field-row { display: flex }`
overrode the browser's default styling for the `hidden` attribute, so the gradient and
custom-eye-colour controls stayed visible when they should have been hidden. Fixed with an
explicit `[hidden] { display: none !important; }` rule in `css/styles.css`.

## 10. Known limits

- One encoding mode is chosen for the whole text. Mixing modes inside a single code
  (for example numeric digits inside a URL) could squeeze out a few more characters,
  but it is not implemented.
- Kanji mode and ECI are not implemented; non-Latin text goes through UTF-8 byte mode,
  which every modern scanner reads.
- Very large exports (4096 px and above) can take a moment on slower machines.
