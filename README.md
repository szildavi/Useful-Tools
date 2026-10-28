# Useful Tools

Five small, privacy-first tools for everyday file and image work. The browser
tools process files locally and do not upload them to a server.

## Tools

| Tool | Description | Technology | Start here |
| --- | --- | --- | --- |
| [Ultimate Converter](./Ultimate_Converter/) | Desktop and browser-based conversion between many file formats | Python, Tkinter, vanilla JavaScript | [README](./Ultimate_Converter/README.md) |
| [Movie Codec Converter](./Movie_codec_converter/) | Convert video to editing-friendly DNxHR MOV and audio to WAV | Python, FFmpeg | [README](./Movie_codec_converter/README.md) |
| [PDF Editor](./pdf_editor/) | Edit, merge, reorder, annotate and export PDF files in the browser | React, TypeScript, Vite | [README](./pdf_editor/README.md) |
| [Image Creator](./Image_creator/) | Arrange images on a page and export PNG, JPG or PDF | HTML, CSS, JavaScript | [specification](./Image_creator/SPECIFICATION.md) |
| [QR Code Generator](./qr_code_gen/) | Generate customizable QR codes and export high-quality images | HTML, CSS, JavaScript | [specification](./qr_code_gen/SPECIFICATION.md) |

## Quick start

### Browser tools

Serve the tool directory locally; opening the HTML file directly can prevent
browser modules and workers from loading.

```powershell
python -m http.server 8000 --directory Image_creator
python -m http.server 8001 --directory qr_code_gen
```

For the PDF editor:

```powershell
cd pdf_editor
npm install
npm run dev
```

### Python tools

See the tool-specific README files for system dependencies and usage:

```powershell
python -m Ultimate_Converter.app.main
cd Movie_codec_converter
python -m movie_codec_converter --help
```

The Movie Codec Converter requires FFmpeg and FFprobe. The Ultimate Converter
detects optional command-line converters installed on the host system.

## Privacy and security

- Browser tools run client-side; files are not sent to a project server.
- No credentials or API keys are required.
- Local settings, environment files, build output, dependencies and user test
  files are excluded by [.gitignore](./.gitignore).
- Do not commit credentials, private keys, personal documents or generated
  media. If a credential was ever committed, revoke it and remove it from the
  repository history before publishing.

## Repository layout

Each tool is self-contained and has its own documentation and build or start
instructions. Dependencies are intentionally not vendored: install them using
the commands documented by the relevant tool.

## License

This project is released under the MIT License. See [LICENSE](./LICENSE).