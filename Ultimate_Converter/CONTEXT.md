# Context

A running record of what exists in this project, why it is built that way, and
what is deliberately left out. Update this file whenever something changes.

---

## What was built

Two separate programs that share one design, exactly as `SPECIFICATION.md` asks:

| | Desktop application | Website |
|---|---|---|
| Location | `app/` | `web/` |
| Language | Python 3 + Tkinter | Vanilla JavaScript (ES modules) |
| Runs on | Linux and Windows | Any modern browser |
| Backend | None - drives local command line tools | None at all |
| Conversions | **1308** declared, 1067 usable on this machine | **82** |
| Parallelism | Thread pool, one worker per CPU core | Web Worker pool, one per CPU core |

The website deliberately offers fewer formats than the application, which is
what the specification requires. Everything a browser genuinely cannot do -
video encoding, camera RAW, office documents, e-books, 3D meshes - lives only in
the desktop application.

---

## The idea that shapes both codebases

Conversions are **never listed by hand**. Each converter declares the *families*
of formats it understands, and a helper expands those families into every
(source, target) pair. Two consequences:

1. Round trips come for free. If a family is both readable and writable, then
   `A → B` and `B → A` both exist without extra code, which satisfies the
   specification's "converting from and back too" requirement.
2. Adding a format means adding one entry to a family, not editing a table.

This is why the count is 1308 rather than the 100 rows in `CONVERSIONS.md`.

Both programs implement the same four ideas under the same names:

- **Format families** - declare formats once, expand them into pairs.
- **Converter** - one engine, one backing tool, one job: `declare_conversion_pairs`,
  `declare_options`, `convert`.
- **Registry** - indexes every converter and answers "what can this file become?".
- **Runner / scheduler** - runs a batch across CPU cores and reports progress.

---

## Desktop application (`app/`)

```
run_ultimate_converter.py       launcher; also what PyInstaller freezes
build_binary.py                 builds the standalone executable
app/
├── main.py                     entry point: python -m app.main
├── self_check.py               the --self-test report
├── core/
│   ├── bundled_resources.py    finds bundled files from source or from a binary
│   ├── format_families.py      format families + pair expansion + name aliases
│   ├── conversion_option.py    the option model (choice / integer / toggle)
│   ├── conversion_job.py       one input file on its way to one output file
│   ├── converter.py            the abstract Converter contract
│   ├── conversion_registry.py  pair → converter index and format lookups
│   ├── external_tool.py        finds ffmpeg, ImageMagick, … and install hints
│   ├── command_runner.py       the single place external commands are run
│   └── parallel_conversion_runner.py   thread pool, one worker per core
├── converters/
│   ├── media_converter.py      FFmpeg - audio and video          (485 pairs)
│   ├── image_converter.py      ImageMagick - raster and RAW      (254 pairs)
│   ├── pdf_converter.py        Poppler - PDF text and HTML       (2 pairs)
│   ├── office_converter.py     LibreOffice - documents           (118 pairs)
│   ├── data_converter.py       pure Python - csv/json/yaml/xml   (25 pairs)
│   ├── ebook_converter.py      Calibre - e-books                 (158 pairs)
│   ├── latex_converter.py      TeX engine - LaTeX to PDF         (2 pairs)
│   ├── vector_converter.py     Inkscape + Potrace - vectors      (75 pairs)
│   ├── cad_converter.py        LibreDWG + Inkscape - DWG         (6 pairs)
│   ├── archive_converter.py    7-Zip - archives                  (66 pairs)
│   ├── model_converter.py      Assimp - 3D meshes                (117 pairs)
│   └── converter_catalogue.py  the priority order (first listed wins a tie)
└── ui/
    ├── main_window.py          queue, "Convert to" dropdown, settings, status bar
    ├── file_queue_view.py      the file table
    ├── option_panel.py         builds a control per conversion option
    ├── scrollable_frame.py     reusable vertical scroller
    ├── tool_status_dialog.py   which tools are installed, and how to get the rest
    ├── theme.py                colours, fonts and ttk styles
    └── assets/icon.png|.ico    application icon
```

### Decisions worth remembering

- **Missing tools degrade gracefully.** Nothing is installed behind the user's
  back. `external_tool.py` probes for each program, the registry hides
  conversions whose tool is absent, and **Tools…** shows the exact install
  command for Linux and for Windows. This is what keeps the app working on a
  fresh Windows machine.
- **LibreOffice gets a private profile per job.** Two LibreOffice instances
  cannot share one user profile, so each job runs against a throwaway profile in
  a temporary directory. That is what lets office conversions run in parallel
  with the rest of the batch.
- **Threads, not processes.** Every converter shells out to an external program,
  so threads spend their time waiting on subprocesses rather than competing for
  the interpreter lock. `os.cpu_count()` workers by default, adjustable in the
  status bar.
- **Fonts are resolved at runtime.** Hardcoding "Segoe UI" made every button
  ~30% wider on Linux and pushed *Convert all* off the window. `theme.py` now
  picks the first installed family from a per-platform list, and the window
  derives its minimum width from the toolbar's measured size.
- **Silent videos give a readable error.** Extracting audio from a video with no
  audio track used to surface `ffmpeg exited with code 234`. It now says
  "sample.mp4 has no audio track to extract."
- **Output names never collide.** `ConversionJob.build_output_path` appends
  `(1)`, `(2)`, … rather than overwriting an existing file.

---

## Building the standalone binary

```bash
python build_binary.py     # result: dist/UltimateConverter  (~17 MB)
```

### Decisions worth remembering

- **One file, not a folder.** `--onefile` produces a single executable that can
  be copied and run anywhere. It costs one to two seconds of startup while it
  unpacks itself into a temporary directory; a folder build would start
  instantly but has to be kept together and zipped to share.
- **No conversion tools are bundled.** The binary stays ~17 MB and finds FFmpeg,
  ImageMagick, LibreOffice and the rest on the system at startup, exactly as the
  source version does. Bundling FFmpeg would push the binary past 200 MB and
  bring GPL/LGPL redistribution obligations; LibreOffice (~700 MB) could not be
  bundled at all.
- **No `.spec` file.** `build_binary.py` passes the options directly, so the
  build configuration lives in exactly one place.
- **Bundled files go through `bundled_resources.py`.** A frozen build unpacks
  data files into `sys._MEIPASS`, so paths derived from `__file__` break. Every
  bundled file (currently just the icon) is resolved through `resource_path`.
- **`--self-test` makes the binary verifiable.** `UltimateConverter --self-test`
  prints how it is running, which tools were found and how many conversions are
  available. `self_check.py` *builds* the report and the launcher *displays* it,
  because a windowed Windows build has no console and must show it in a window
  instead.
- **PyInstaller cannot cross-compile.** Run the script on Linux for a Linux
  binary and on Windows for a `.exe`. The script adapts the icon format and the
  `--add-data` separator to whichever platform it is running on.
- **Icons on Linux come from the window, not the file.** PyInstaller only embeds
  an icon resource on Windows and macOS, so `--icon` is passed only there, and
  the window sets its own icon with `iconphoto` on every platform.

---

## Website (`web/`)

```
web/
├── index.html                  the whole interface
├── self-test.html              runs every browser conversion, shows pass/fail
├── css/styles.css
└── js/
    ├── main.js                 wires the page together
    ├── self-test.js            the self-test's logic
    ├── core/                   same four ideas as the desktop app
    │   ├── format-families.js
    │   ├── conversion-option.js
    │   ├── conversion-job.js
    │   ├── converter.js
    │   ├── conversion-registry.js
    │   ├── worker-pool.js
    │   └── parallel-conversion-scheduler.js
    ├── converters/
    │   ├── image-converter.js      canvas: png/jpg/webp + bmp/gif/avif/svg/ico in
    │   ├── image-encoders.js       hand-written BMP, ICO and single-image PDF
    │   ├── audio-converter.js      Web Audio decode → 16-bit WAV
    │   ├── data-converter.js       csv/tsv/json/xml/yaml, all directions
    │   ├── text-converter.js       txt/md/html
    │   ├── archive-converter.js    zip/tar/tar.gz, all directions
    │   ├── archive-formats.js      hand-written ZIP and TAR readers/writers
    │   ├── binary-writer.js        shared little-endian byte buffer
    │   └── converter-catalogue.js
    ├── ui/                     drop zone, queue, options, formats dialog
    └── workers/conversion-worker.js
```

### Decisions worth remembering

- **Zero dependencies, zero build step.** No npm, no bundler, no CDN. Everything
  is either a browser API or written out by hand. The consequence is that the
  site works offline and can be dropped on any static host unchanged.
- **The archive and PDF writers are hand-written.** `CompressionStream` and
  `DecompressionStream` give raw DEFLATE and GZIP natively, which is all ZIP and
  TAR need. The ZIP/TAR output was verified against 7-Zip and GNU tar, and the
  generated PDF was verified with `pdfinfo` and re-rendered with `pdftoppm`.
- **Audio runs on the main thread.** `OfflineAudioContext` is not exposed to Web
  Workers, so `AudioConverter` declares `runsInWorker = false` and the scheduler
  runs it on the page. Everything else runs in the worker pool.
- **No DOMParser in the data converter.** `DOMParser` is window-only, so the XML
  reader picks records out directly and therefore works inside a worker.
- **The website needs a static file server.** ES modules and module workers are
  blocked over `file://`. `python3 -m http.server` is enough - that is a file
  server, not a backend.
- **Browsers can decode far more than they can encode.** That asymmetry is the
  honest reason the site converts `mp3 → wav` but not `wav → mp3`; the desktop
  application covers the other direction.

---

## Coverage against `CONVERSIONS.md`

**97 of the 100 listed conversions are supported** (checked by walking the file
and asking the registry about each row). The three that are not:

| ID | Conversion | Why not |
|---|---|---|
| 039 | `.cdr` → `.ai` | No free tool writes Adobe Illustrator files. Inkscape reads `.cdr` and writes `.svg` / `.pdf` instead, both of which Illustrator opens. |
| 083 | `.pptx` → `.mp4` | Needs slide timing and narration that a batch converter cannot invent. Export the video from PowerPoint or Impress. |
| 097 | `.step` → `.stl` | Needs an OpenCASCADE kernel; Assimp cannot read STEP. |

Everything else is covered, and in both directions where the formats allow it.

Three of the rows needed converters added specifically for them, each following
the same detect-and-disable rule as the rest:

- **015 `.md` → `.pdf`** - LibreOffice 25.8 and newer import Markdown, so `md`
  joined the LibreOffice source formats. Verified: headings, bold and lists all
  survive into the PDF.
- **012 `.tex` → `.pdf`** - `latex_converter.py` drives whichever TeX engine is
  installed (`pdflatex`, `xelatex`, `lualatex` or `tectonic`), building in a
  temporary directory so the auxiliary files never land beside the source.
- **041 `.dwg` → `.pdf`** - `cad_converter.py` translates DWG to DXF with
  LibreDWG, then hands it to Inkscape. Both steps sit inside one converter, so
  the two-stage pipeline stays invisible to the registry.

---

## How it was verified

- **Desktop:** 22 real conversions run through the parallel runner
  (png→jpg/webp/ico/pdf, mp4→mov/webm/mp3/gif, wav→mp3/flac/ogg,
  csv→json/xml/xlsx/tsv, txt→pdf/docx/odt/html, md→pdf/docx/html). All passed.
  The Tkinter window was built, driven and screenshotted at both its default and
  minimum sizes, and a full batch was run through the interface end to end.
- **Coverage:** `CONVERSIONS.md` is parsed and every row checked against the
  registry, rather than the coverage being asserted by hand.
- **Website:** `self-test.html` ran all 29 conversions its sample files reach,
  in headless Firefox, through the real worker pool - all passed. Audio decoding
  was checked separately against real `.ogg`, `.mp3` and `.flac` files, with the
  sample-rate and channel options confirmed in the output WAV headers.
- **Cross-checked with system tools:** website ZIP and TAR output opened
  correctly in 7-Zip and GNU tar with byte-identical contents; website PDF
  output was parsed by `pdfinfo` and re-rendered by `pdftoppm`; ICO output was
  confirmed by ImageMagick to contain all four icon sizes.
- **Round trips:** `csv → json → csv`, `csv → yaml → csv` and `csv → xml → csv`
  all return byte-identical text, including quoted fields containing commas.

---

## Change log

### 2026-07-29 - standalone binary

- Added `build_binary.py`, `run_ultimate_converter.py`, `app/self_check.py`,
  `app/core/bundled_resources.py` and the application icon.
- Built and verified a 17.2 MB single-file Linux executable.
- Verified the frozen build really converts, not just starts: a throwaway
  console build ran six conversions (png→jpg, mp4→webm, wav→flac, csv→xlsx,
  md→pdf, txt→docx) under `env -i` with no Python on `PATH`. All six passed,
  which proves tool discovery and subprocess spawning survive freezing.
- Fixed, found by running the binary: the sidebar showed blank boxes instead of
  its hints when the queue was empty, because `_on_selection_changed` was never
  called at startup. Seeding those hints then made the paned window hand the
  sidebar too much width, so the split position is now set explicitly.

### 2026-07-29 - initial build

- Created the desktop application and the website from scratch.
- Chose family-based pair expansion over hand-written conversion tables, which
  is what produces 1308 desktop conversions from the 100 rows in
  `CONVERSIONS.md` and gives round trips for free.
- Added `latex_converter.py`, `cad_converter.py` and Markdown import after a
  coverage check showed six `CONVERSIONS.md` rows unsupported; that closed three
  of them and took coverage from 94/100 to 97/100.
- Chose graceful tool detection over auto-installing anything.
- Fixed, during verification: a Tkinter attribute (`_options`) that shadowed an
  internal widget method; hardcoded Windows fonts that broke the toolbar layout
  on Linux; unreadable read-only dropdowns in the dark theme; a settings panel
  that could not scroll; a collapsed column in the tool status dialog; and a
  default target format that turned videos into audio files.
