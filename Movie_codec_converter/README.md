# Movie Codec Converter

Converts H.264 / H.265 videos with AAC audio into **DNxHR MOV** files, and audio
files (MP3, AAC, M4A, FLAC, OGG, WMA, ...) into **WAV**, so they can be edited
natively on Linux. It works on one file or on a whole folder, and it has both a
graphical and a terminal interface.

## Requirements

- `ffmpeg` and `ffprobe`
- Python 3.10 or newer
- `tkinter` for the graphical interface (optional, the terminal interface works without it)

```bash
# Fedora
sudo dnf install ffmpeg python3 python3-tkinter
# Debian / Ubuntu
sudo apt install ffmpeg python3 python3-tk
# Arch
sudo pacman -S ffmpeg python tk
# macOS
brew install ffmpeg python-tk
```

## Start

```bash
./movie-codec-converter          # opens the graphical interface
./movie-codec-converter --gui    # the same
```

To be able to start it from anywhere:

```bash
ln -s "$PWD/movie-codec-converter" ~/.local/bin/movie-codec-converter
```

## The graphical interface

1. **Add files...** or **Add folder...** - choose what has to be converted.
   Turn on *Also search the subfolders* when the folder has subfolders, and
   *Also convert the audio files* when the folder holds music or sound files too.
2. **Output folder** - choose where the MOV files are written. The folder is
   created when it does not exist yet.
3. **DNxHR profile** and **Audio** - choose the quality.
4. **Files at once** - how many videos are converted at the same time. The default
   comes from the number of processor cores of the machine.
5. **Start conversion** - every running file gets its own progress bar, under them
   the progress of the whole batch is shown and every result is written into the
   log. **Cancel** stops the work.

## The terminal interface

```bash
# one file
./movie-codec-converter holiday.mp4 -o ~/Videos/DNxHR

# a whole folder with its subfolders, in 10-bit quality
./movie-codec-converter ~/Videos/raw -r -o ~/Videos/DNxHR --profile hqx

# more files, keeping the original audio, converting again the existing outputs
./movie-codec-converter clip1.mp4 clip2.mkv -o ./edit_ready --audio copy --overwrite

# four files converted at the same time
./movie-codec-converter ~/Videos/raw -r -o ~/Videos/DNxHR --jobs 4

# the videos and the audio files of a folder as well
./movie-codec-converter ~/Videos/raw -r --audio-files -o ~/Videos/DNxHR

# a single audio file: it becomes song.wav
./movie-codec-converter song.mp3 -o ~/Music/edit_ready

# only show what would happen
./movie-codec-converter ~/Videos/raw -r -o ~/Videos/DNxHR --list
```

| Option | Meaning |
| --- | --- |
| `-o`, `--output` | the folder the MOV files are written into (default: the current folder) |
| `-r`, `--recursive` | also search the subfolders of the given folders |
| `--audio-files` | also convert the audio files of the given folders into WAV |
| `-p`, `--profile` | `lb`, `sq`, `hq` (default), `hqx`, `444` |
| `-a`, `--audio` | `pcm16` (default), `pcm24`, `copy` |
| `-j`, `--jobs` | how many files are converted at the same time (default: a quarter of the cores) |
| `--overwrite` | convert again even when the output file already exists |
| `-l`, `--list` | only list the planned conversions |
| `-g`, `--gui` | open the graphical interface |

Exit codes: `0` everything succeeded, `1` at least one file failed, `2` there was
nothing to convert, `130` the user cancelled the batch.

## Audio files

Audio files become uncompressed **WAV** files, with the codec of the **Audio**
setting (`pcm16` or `pcm24`). Recognised sources: `mp3`, `aac`, `m4a`, `m4b`,
`wav`, `flac`, `ogg`, `oga`, `opus`, `wma`, `aiff`, `aif`, `ac3`, `dts`, `mka`,
`amr`.

- A folder gives its audio files only with `--audio-files` (or the checkbox in
  the window). An audio file you name yourself is always converted.
- The `copy` audio setting cannot be kept for a standalone audio file, because a
  WAV file cannot hold a compressed track: those become 16-bit PCM.
- A cover image inside an MP3 is dropped, only the sound is written.

## The DNxHR profiles

| Profile | Bit depth | Good for |
| --- | --- | --- |
| `lb` | 8-bit 4:2:2 | offline editing, smallest files |
| `sq` | 8-bit 4:2:2 | everyday editing |
| `hq` | 8-bit 4:2:2 | high quality editing (default) |
| `hqx` | 10-bit 4:2:2 | colour grading |
| `444` | 10-bit 4:4:4 | finishing, effects |

DNxHR files are much bigger than the H.264 or H.265 source, this is normal: they
are made for editing, not for storage.

`hqx` and `444` store 10-bit video, but the usual H.264 and H.265 videos are 8-bit.
When such a source is converted with them, the program warns about it: the window
asks whether to continue, the terminal writes a warning and goes on. Those profiles
do not make an 8-bit source better, they only make the files much bigger.

## Converting more files at the same time

One ffmpeg already uses several processor cores, so the program converts a quarter
of the cores worth of files at once (at most 4) and gives `cores ÷ jobs` threads to
each of them. On a 12 core machine that means 3 files at a time with 4 threads each.

The number can be changed with `--jobs` or in the window. More is not always faster:
DNxHR writes a lot of data, so on a slow disk too many parallel jobs only make them
wait for each other.

## The folders are kept

The subfolders of the added folder are recreated in the output folder:

```
~/Videos/raw/            ->   ~/Videos/DNxHR/
├── holiday.mp4               ├── holiday.mov
├── wedding/                  ├── wedding/
│   ├── church.mp4            │   ├── church.mov
│   └── party.mp4             │   └── party.mov
└── concert/                  └── concert/
    └── stage.mp4                 └── stage.mov
```

Videos that you add one by one land directly in the output folder. When you add
several folders at once, each one gets its own folder in the output named after
it, so two subfolders with the same name never mix.

## Good to know

- Files that already exist in the output folder are skipped, so an interrupted
  batch can simply be started again.
- A failed or cancelled conversion deletes its own half written file.
- Videos without an audio track are converted as well.
- Two videos with the same name that would land in the same folder become
  `name.mov` and `name_2.mov`.
