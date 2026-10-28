# CONTEXT

This file records everything that was added, changed or decided in the project.

## 2026-07-27 - Audio files are converted too (1.3.0)

### Decisions that were taken with the user

| Question | Chosen answer |
| --- | --- |
| What the audio support means | Standalone audio files (mp3, aac, m4a, flac, ogg, wma, ...) are converted too, in the same batch as the videos |
| What an audio file becomes | A WAV file, with the codec of the existing Audio setting (`pcm16` or `pcm24`) |
| Are audio files taken from a scanned folder | Only when the user asks for it, with a switch. An audio file added one by one is always converted |

The `copy` audio setting cannot be followed for a standalone audio file, because a
WAV file cannot hold a compressed track. Those files become 16-bit PCM, and the
audio option says this in its own docstring.

### New files

| File | Class | What it does |
| --- | --- | --- |
| `core/media_kind.py` | `MediaKind` | The kind of a source file (video or audio) and the extension it is converted into |
| `core/batch_description.py` | `BatchDescription` | Tells in words what a batch is made of, for example "1 video to DNxHR MOV and 5 audio files to WAV" |

### Changed files

- `core/ffmpeg_command_builder.py`: `FfmpegCommandBuilder` became an abstract class
  that holds everything both conversions need (quiet run, input, progress), and the
  two kinds only describe their own encoding: `VideoCommandBuilder` (DNxHR MOV) and
  `AudioCommandBuilder` (WAV, without any picture, so a cover image in an MP3 cannot
  break the output). `CommandBuilderSelector` gives the builder of a kind.
- `core/video_converter.py` became `core/media_converter.py`, and `VideoConverter`
  became `MediaConverter`: it converts a file of any kind, the command comes from the
  selector. The old name would have been a lie.
- `core/media_file_finder.py`: knows the audio extensions as well, `FoundVideo` became
  `FoundMedia` and carries the kind of the file. A folder gives its audio files only
  when the switch is on, a file added one by one is always taken.
- `core/output_path_builder.py`: the extension of a destination comes from the kind of
  the source, so a video becomes `.mov` and an audio file becomes `.wav`.
- `core/conversion_job.py`: a job knows the kind of its source.
- `core/conversion_settings.py`: new `convert_audio_files` setting and the
  `codec_for_an_audio_file` property of the audio options.
- `core/source_compatibility_checker.py`: the profile check only looks at the videos,
  because a DNxHR profile says nothing about an audio file.
- `core/progress_reporter.py`, `core/batch_converter.py`: `batch_started` receives the
  jobs themselves, so a reporter can tell what the batch is made of.
- `cli/argument_parser.py`: new `--audio-files` switch.
- `cli/console_progress_reporter.py`, `gui/application_window.py`: the first line of a
  batch names both kinds instead of always saying "DNxHR MOV".
- `gui/file_list_panel.py`: new "Also convert the audio files" checkbox, the file dialog
  offers audio files too, and the panel hands over its choices in one `SourceSelection`
  value instead of several separate properties.
- `gui/settings_panel.py`, `gui/application_window.py`: they use that value.

### How it was tested

- A folder with a video, an MP3, an M4A, a FLAC, an OGG and an MP3 with a cover image:
  without the switch only the video was converted, with the switch all 6 files were,
  the audio files became `pcm_s16le` WAV files in the mirrored subfolders, and the
  cover image did not end up in the WAV.
- `-a pcm24` gave a `pcm_s24le` WAV; `-a copy` kept the AAC track of the video and made
  the standalone audio file 16-bit PCM.
- An audio file named one by one was converted even without the switch.
- A WAV folder converted into itself: refused with "The output file would replace the
  source file", the source stayed untouched.
- The `444` and `hqx` warning does not appear for an audio only batch, and still
  appears for the videos of a mixed batch.
- Damaged video and damaged audio files both failed cleanly, without leaving anything
  behind.
- The batch header says "1 audio file to WAV", "1 video to DNxHR MOV" or
  "1 video to DNxHR MOV and 5 audio files to WAV", whichever fits.
- Cancelling a mixed parallel batch: the running conversions stopped, the file that had
  really finished before the cancelling stayed complete, the rest were cancelled.
- The window: the checkbox off converted only the video, the checkbox on converted all
  6 files into the mirrored folders.
- Everything from the earlier versions was checked again: mirroring, skipping,
  overwriting, the two added folders, the missing input and the parallel work.

## 2026-07-27 - The folders of the source are kept (1.2.0)

### Decisions that were taken with the user

| Question | Chosen answer |
| --- | --- |
| Is the folder structure kept | Always, there is no switch for it |
| What happens with several added folders | Every added folder gets its own folder in the output, named after it |

With one added folder the wish of the user works exactly as asked: a source folder
with the subfolders `a` and `b` gives an output folder with the subfolders `a` and
`b`, with the converted videos inside them. Files that are added one by one still
land directly in the output folder.

### Changed files

- `core/media_file_finder.py`: new `FoundVideo` value, it holds the file **and** the
  folder the user added it with. Without that the converter cannot know which part
  of the path has to be recreated in the output. `find_in_paths` returns these
  values now, still without duplicates and in a stable order.
- `core/output_path_builder.py`: builds `output folder / subfolders of the source /
  name.mov`. When the videos come from several added folders, the name of the added
  folder is put in front, so two subfolders called `a` never mix. The uniqueness of
  the names is checked per folder now, so the same name in two different folders is
  not a collision any more.
- `core/conversion_planner.py`: decides whether the videos come from more than one
  added folder and tells it to the path builder.
- `core/conversion_job.py`: new `describe_destination`, it returns the destination
  as it is seen inside the output folder (`a/deep/d1.mov`). Both interfaces use it,
  so the text is built in one single place.
- `core/progress_reporter.py`, `core/batch_converter.py`: `batch_started` receives
  the settings as well, so a reporter knows the output folder and can show the
  destinations with their folders.
- `cli/console_progress_reporter.py`, `gui/gui_progress_reporter.py`,
  `gui/application_window.py`: the log lines and the running lines show the
  destination with its folders instead of a bare file name.

### Behaviour that was decided during the implementation

- The subfolders are created only when they are really needed, the converter already
  created the missing folders of a destination before writing into it.
- Adding a folder and one of its own subfolders at the same time does not convert
  anything twice and does not switch on the grouping by folder name.
- Two videos with the same name added one by one still become `name.mov` and
  `name_2.mov`, because they land in the same folder.

### How it was tested

- A source tree of `top.mp4`, `a/a1.mp4`, `a/deep/d1.mp4`, `b/b1.mp4` converted with
  `-r`: the output folder got exactly `top.mov`, `a/a1.mov`, `a/deep/d1.mov` and
  `b/b1.mov`, and the nested result was a valid DNxHR HQ file.
- The same batch started again: all 4 files were skipped inside their own subfolders.
- Without `-r` only the file of the top folder was converted.
- Two added folders that both contain an `a` subfolder: the results went into
  `root1/a/same.mov` and `root2/a/same.mov`, nothing was mixed.
- A folder and a single file added together: the file landed in the output folder,
  the folder kept its structure.
- A folder added together with its own subfolder, and the same folder added twice:
  no duplicated work, no unwanted grouping.
- The window converted the same tree and recreated the same folders.
- The whole earlier behaviour was checked again after the change: skipping,
  overwriting, the damaged file, the missing input, the 8-bit warning and the
  cancelling of a parallel batch all work as before.

## 2026-07-27 - Parallel conversion and the profile warning (1.1.0)

### Decisions that were taken with the user

| Question | Chosen answer |
| --- | --- |
| How many files are converted at once by default | A quarter of the processor cores, at most 4, and every ffmpeg gets `cores ÷ jobs` threads |
| How the terminal shows a parallel run | One progress bar for the whole batch, plus one line per finished file |
| What happens when a 10-bit profile meets an 8-bit source | The user is warned: the window asks whether to continue, the terminal writes a warning and goes on |
| Which profiles are warned about | Both `hqx` and `444`, and `444` also warns about the subsampled colour |

### New files

| File | Class | What it does |
| --- | --- | --- |
| `core/cpu_capacity.py` | `CpuCapacity` | Tells how many parallel conversions and how many ffmpeg threads the processor can carry |
| `core/batch_progress_tracker.py` | `BatchProgressTracker` | Collects the progress of the running files into one batch progress, under a lock |
| `core/source_compatibility_checker.py` | `SourceCompatibilityChecker`, `ProfileWarning` | Compares the sources with the chosen profile and builds the warning text |
| `gui/running_jobs_view.py` | `RunningJobsView` | Shows one line with its own progress bar for every running conversion |

### Changed files

- `core/conversion_settings.py`: new `parallel_job_count` setting (its default comes
  from `CpuCapacity`) and the derived `ffmpeg_thread_count`. `DnxhrProfile` got the
  `is_ten_bit` and `keeps_full_chroma` properties, so the profile itself knows what
  it stores.
- `core/batch_converter.py`: the jobs run on a `ThreadPoolExecutor` whose size comes
  from the settings. With one job it behaves exactly like before, so there is only
  one implementation for the parallel and the one by one work. A thread that breaks
  down becomes a failed result instead of stopping the batch.
- `core/ffmpeg_command_builder.py`: `-threads` is added twice, before the input for
  the decoding and before the output for the encoding, so the parallel jobs do not
  fight for the processor.
- `core/media_inspector.py`: reads the pixel format and the bit depth as well
  (`bits_per_raw_sample`, and the pixel format name when ffprobe does not report it),
  and remembers every answer under a lock, so a file that was read for the profile
  check is not read again by the conversion.
- `core/converter_factory.py`: keeps one media inspector and one ffmpeg lookup, and
  builds the compatibility checker too.
- `cli/argument_parser.py`: new `-j` / `--jobs` argument, its help text shows the
  default of the actual machine.
- `cli/console_progress_reporter.py`: one bar for the whole batch, every printing is
  made under a lock because several threads report at the same time.
- `cli/cli_application.py`: writes the warning to the error output before the start
  and tells how many files convert at once.
- `gui/settings_panel.py`: new "Files at once" spinbox, it shows the number of cores.
- `gui/progress_panel.py`: the single file bar was replaced by `RunningJobsView`.
- `gui/application_window.py`: uses `BatchProgressTracker` for the batch bar, adds and
  removes the lines of the running files, and asks the user before starting a batch
  whose profile does not fit the sources.
- `gui/conversion_worker.py`: gets the factory from the window, so the window and the
  conversion share the ffprobe answers.

### Behaviour that was decided during the implementation

- A batch never starts more threads than the number of its files.
- The warning is not shown for `--list`, because that has to stay instant.
- The warning of `444` names two different problems: 8-bit sources and subsampled
  colour, and the closing advice changes with them (`lb/sq/hq` for the bit depth,
  `hqx` for the colour).
- Cancelling a parallel batch stops every running ffmpeg and marks the files that
  never started as cancelled.

### How it was tested

- 6 files of 1080p on a 12 core machine: `-j 1` 19.8 s, `-j 2` 17.0 s, `-j 3` 16.4 s,
  `-j 6` 17.0 s. The default (3 jobs, 4 threads each) was the fastest, more jobs than
  that became slower again, which is exactly why the default is a quarter of the cores.
  All 6 results were valid DNxHR MOV files of the right length.
- `Ctrl+C` during a parallel batch: the 3 running files were cancelled, the 3 waiting
  ones were marked as cancelled before they started, no half written file was left
  behind, no ffmpeg process stayed alive, the exit code was `130`.
- The profile check: `hq` warns about nothing; `hqx` warns only about the 8-bit files
  of a mixed batch and stays quiet for a 10-bit source; `444` warns about the bit depth
  and about the colour as well.
- The window: with the `444` profile the dialog appeared and answering "Cancel" really
  did not start anything and unlocked the settings again; with `hq` no dialog appeared,
  3 files converted at the same time, 3 lines were visible at once, no line stayed
  behind and the batch bar reached 100%.
- The remembered ffprobe answers: reading the same file twice runs ffprobe only once.

## 2026-07-27 - First working version (1.0.0)

### Decisions that were taken with the user

| Question | Chosen answer |
| --- | --- |
| Language and interface | Python 3 with a Tkinter graphical interface **and** a full command line interface |
| DNxHR profile | Selectable (`lb`, `sq`, `hq`, `hqx`, `444`), the default is `hq` |
| Input selection | Single files **and** folders, with an optional search of the subfolders |
| Audio | `pcm_s16le` by default, `pcm_s24le` and "keep the original" are also selectable |
| Existing output files | They are skipped, an explicit overwrite switch converts them again |

Reasons for Python instead of Bash: the progress reporting, the cancelling of a
running encoding and the graphical interface stay readable in Python, and
Tkinter is part of a normal Python installation, so no extra package has to be
installed on any UNIX system.

### What the program does

It converts H.264 / H.265 videos with AAC audio (and every other format ffmpeg
can read) into DNxHR MOV files, which Linux video editors can cut natively.
The ffmpeg call it builds is the one from `SPECIFICATION.md`, extended with the
pixel format of the chosen profile, constant frame rate output and machine
readable progress:

```
ffmpeg -hide_banner -nostdin -loglevel error -y -i INPUT \
       -map 0:v:0 -map 0:a? \
       -c:v dnxhd -profile:v dnxhr_hq -pix_fmt yuv422p -fps_mode cfr \
       -c:a pcm_s16le -nostats -progress pipe:1 OUTPUT.mov
```

### Files that were created

#### Entry points

| File | What it is for |
| --- | --- |
| `movie-codec-converter` | Bash launcher, works from any folder and through a symbolic link |
| `movie_codec_converter/__main__.py` | Entry point of `python3 -m movie_codec_converter` |
| `movie_codec_converter/application_launcher.py` | `ApplicationLauncher`: decides between the graphical and the terminal interface |

#### Conversion engine (`movie_codec_converter/core/`)

| File | Class | What it does |
| --- | --- | --- |
| `conversion_settings.py` | `DnxhrProfile`, `AudioOption`, `ConversionSettings` | Every option the user can choose, with the ffmpeg names and pixel formats that belong to them |
| `ffmpeg_locator.py` | `FfmpegLocator`, `FfmpegNotFoundError` | Finds ffmpeg and ffprobe, or tells how to install them |
| `media_file_finder.py` | `MediaFileFinder` | Collects the video files of the chosen files and folders |
| `output_path_builder.py` | `OutputPathBuilder` | Builds the MOV destination paths and keeps them unique |
| `conversion_planner.py` | `ConversionPlanner` | Turns the chosen paths into the jobs of a batch |
| `conversion_job.py` | `ConversionJob`, `ConversionResult`, `ConversionOutcome`, `ConversionSummary` | The description, the result and the summary of the conversions |
| `media_inspector.py` | `MediaInspector`, `MediaInfo` | Reads the duration and the codecs of a source file with ffprobe |
| `ffmpeg_command_builder.py` | `FfmpegCommandBuilder` | Builds the ffmpeg command of one conversion |
| `ffmpeg_progress_parser.py` | `FfmpegProgressParser` | Turns the progress lines of ffmpeg into a completion ratio |
| `progress_reporter.py` | `ProgressReporter`, `SilentProgressReporter` | The abstraction every interface implements to follow a batch |
| `video_converter.py` | `VideoConverter` | Runs ffmpeg for one file, follows it, cancels it, cleans up after a failure |
| `batch_converter.py` | `BatchConverter` | Runs the jobs one after the other, skips and cancels them when needed |
| `converter_factory.py` | `ConverterFactory` | Builds the whole engine in one place, so the two interfaces do not repeat the wiring |

#### Terminal interface (`movie_codec_converter/cli/`)

| File | Class | What it does |
| --- | --- | --- |
| `argument_parser.py` | `ArgumentParser`, `CommandLineRequest` | Describes and reads the command line arguments |
| `console_progress_reporter.py` | `ConsoleProgressReporter` | Draws the text progress bar and the messages in the terminal |
| `cli_application.py` | `CliApplication` | Runs one batch and returns the exit code |

#### Graphical interface (`movie_codec_converter/gui/`)

| File | Class | What it does |
| --- | --- | --- |
| `gui_application.py` | `GuiApplication`, `GuiUnavailableError` | Opens the main window, or reports that no display is available |
| `application_window.py` | `ApplicationWindow` | The main window, it reacts to the events of the conversion |
| `file_list_panel.py` | `FileListPanel` | The list of the chosen videos and folders |
| `settings_panel.py` | `SettingsPanel` | The output folder, the profile, the audio and the overwrite switch |
| `progress_panel.py` | `ProgressPanel` | The two progress bars and the log |
| `conversion_worker.py` | `ConversionWorker` | Runs the batch on a background thread so the window stays usable |
| `conversion_events.py` | `ConversionEvent`, `ConversionEventQueue` | Carries the events from the background thread to the window |
| `gui_progress_reporter.py` | `GuiProgressReporter` | The `ProgressReporter` that publishes the events of the window |

### Design rules that were followed

- Every class name says what the class does, every method does one single thing.
- The engine knows nothing about the interfaces: both of them only implement the
  `ProgressReporter` abstraction, so no conversion logic is written twice.
- The ffmpeg command exists in one single place (`FfmpegCommandBuilder`), the
  object wiring in one single place (`ConverterFactory`), the job planning in one
  single place (`ConversionPlanner`).
- The interfaces only collect the settings and show the events, they never call
  ffmpeg themselves.

### Behaviour that was decided during the implementation

- Two source files with the same name coming from different folders do not
  overwrite each other, the second one becomes `name_2.mov`.
- A failed or cancelled conversion deletes its half written MOV file, so a broken
  file can never be mistaken for a finished one.
- A job whose output would be the source file itself fails instead of destroying
  the source.
- `Ctrl+C` in the terminal and the Cancel button in the window stop the running
  ffmpeg gently, the exit code of a cancelled batch is `130`.
- Videos without an audio track are converted as well (`-map 0:a?`).
- The output folder is created when it does not exist.
- Exit codes: `0` success, `1` at least one failure or a missing ffmpeg,
  `2` nothing to convert, `130` cancelled.

### How it was tested

Every test was run on Fedora with ffmpeg 8.1.2:

- H.264 + AAC, H.265 + AAC and a video without audio, converted in one recursive
  batch: all three became DNxHR HQ MOV files with `pcm_s16le` audio.
- `--profile hqx --audio copy`: the result was `DNXHR HQX` with `yuv422p10le` and
  the original AAC track.
- Running the same batch again: all files were skipped; with `--overwrite` they
  were converted again.
- A damaged file: reported as failed with the ffmpeg error, no MOV was left behind.
- Two files with the same name in different folders: `same.mov` and `same_2.mov`.
- `Ctrl+C` during an encoding: cancelled, the half written file was deleted, no
  ffmpeg process stayed alive, exit code `130`.
- The graphical interface: a whole batch was run through the real window with
  the `sq` profile and 24-bit audio, the log, both progress bars, the locking of
  the settings during the run and the closing message all worked.
