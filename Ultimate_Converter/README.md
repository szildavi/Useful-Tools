# Ultimate Converter

Convert files between hundreds of formats — as a desktop application, or as a
website that runs entirely in the browser.

Nothing is ever uploaded anywhere. Both programs convert on your own machine.

| | Desktop application | Website |
|---|---|---|
| Formats | **1308 conversions** | **82 conversions** |
| Runs on | Linux and Windows | Any modern browser |
| Needs | nothing, if you build the binary — otherwise Python 3.10+ | Nothing at all |
| Handles | video, audio, images, RAW photos, documents, spreadsheets, slides, e-books, LaTeX, CAD, archives, 3D models | images, audio decoding, data files, text, archives |

The website covers what a browser can genuinely do on its own. Everything
heavier — video encoding, camera RAW, Word and Excel files, e-books, 3D
meshes — lives in the desktop application.

---

## Building a standalone binary

One command produces a single executable that runs without Python installed:

```bash
pip install pyinstaller
python build_binary.py
```

The result is `dist/UltimateConverter` (about 17 MB) — or
`dist/UltimateConverter.exe` on Windows. Copy it anywhere and run it.

PyInstaller cannot cross-compile: build on Linux for a Linux binary, on Windows
for a `.exe`. The script handles the platform differences itself.

The conversion tools are **not** bundled — the binary finds FFmpeg, ImageMagick,
LibreOffice and the rest on your system at startup, exactly as the source
version does. To see what it found:

```bash
./dist/UltimateConverter --self-test
```

which prints the tool list, the converters and how many conversions are
available.

---

## Running the desktop application from source

```bash
python -m app.main          # or: python run_ultimate_converter.py
```

Python 3.10 or newer, with Tkinter. Tkinter ships with Python on Windows and
macOS; on Fedora install `python3-tkinter`, on Debian or Ubuntu `python3-tk`.

### Optional: YAML support

```bash
pip install pyyaml
```

Everything except YAML works without any Python package.

### Conversion tools

The application drives well-known command line programs. **You do not need all
of them.** On startup it checks which are present, hides the conversions it
cannot perform, and the **Tools…** button shows exactly what to install for the
rest, with the command for your operating system.

| Tool | Gives you | Linux | Windows |
|---|---|---|---|
| FFmpeg | audio and video | `dnf install ffmpeg` | `winget install Gyan.FFmpeg` |
| ImageMagick | images and camera RAW | `dnf install ImageMagick` | `winget install ImageMagick.ImageMagick` |
| LibreOffice | documents, sheets, slides | `dnf install libreoffice` | `winget install TheDocumentFoundation.LibreOffice` |
| Poppler | PDF text extraction | `dnf install poppler-utils` | `winget install oschwartz10612.Poppler` |
| 7-Zip | archives | `dnf install p7zip p7zip-plugins` | `winget install 7zip.7zip` |
| Calibre | e-books | `dnf install calibre` | `winget install calibre.calibre` |
| Inkscape | vector graphics | `dnf install inkscape` | `winget install Inkscape.Inkscape` |
| Potrace | tracing images to vectors | `dnf install potrace` | [potrace.sourceforge.net](https://potrace.sourceforge.net) |
| Assimp | 3D models | `dnf install assimp` | [assimp releases](https://github.com/assimp/assimp/releases) |
| A TeX engine | LaTeX to PDF | `dnf install texlive-scheme-basic` | `winget install MiKTeX.MiKTeX` |
| LibreDWG | AutoCAD DWG drawings | `dnf install libredwg` | [libredwg releases](https://github.com/LibreDWG/libredwg/releases) |

On Debian and Ubuntu, swap `dnf install` for `apt install`.

### Using it

1. **Add files** or **Add folder** — a folder is searched recursively.
2. Each file is given a sensible target format automatically. Select a file to
   change it, or select several at once to change them together.
3. Adjust the settings on the right. A video offers codec, quality, resolution,
   frame rate and audio bitrate; an image offers quality, resizing and rotation;
   and so on for every conversion that has choices worth making.
4. Choose where results go, then **Convert all**.

Files are converted in parallel, one per processor core by default. The number
is adjustable in the status bar.

---

## Running the website

The site is plain HTML, CSS and JavaScript — no build step, no dependencies, no
server code. It does need to be *served* rather than opened from disk, because
browsers block ES modules and workers over `file://`:

```bash
cd web
python3 -m http.server 8000
```

Then open <http://localhost:8000>. Any static host works just as well —
GitHub Pages, Netlify, a folder on a web server. There is no backend to deploy.

### Using it

Drop files on the page (or click to choose them), pick a target format, adjust
the settings, and press **Convert all**. Results download individually or all at
once. **Supported formats** lists everything the site can do in your browser.

Like the application, it converts as many files at once as your processor has
cores, using Web Workers.

### Checking it works in your browser

Open `self-test.html`. It runs every conversion the site offers against
generated sample files and shows a pass/fail table.

---

## What converts into what

`CONVERSIONS.md` lists 100 common conversions; **97 of them are supported**, and
the application supports about 1300 in total because formats convert in both
directions wherever that is possible.

Not supported, with no good option available: `.cdr → .ai` (no free tool writes
Illustrator files — use `.svg` or `.pdf`, which Illustrator opens), `.pptx →
.mp4` (needs slide timings only PowerPoint or Impress can supply), and `.step →
.stl` (needs a CAD kernel Assimp does not have).

---

## Project layout

```
build_binary.py          builds the standalone executable
run_ultimate_converter.py  launcher (also what gets frozen)
app/          desktop application (Python + Tkinter)
  core/       conversion machinery, independent of any format
  converters/ one module per backing tool
  ui/         the window
web/          website (vanilla JavaScript, no build step)
  js/core/    the same machinery, for the browser
  js/converters/
  js/ui/
CONTEXT.md    design decisions, coverage notes and change log
CONVERSIONS.md  the reference list of common conversions
SPECIFICATION.md
```

`CONTEXT.md` explains why things are built the way they are — read it before
changing anything.
