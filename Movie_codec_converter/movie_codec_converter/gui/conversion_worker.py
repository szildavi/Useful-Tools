"""Running a batch conversion in the background of the graphical interface."""

from __future__ import annotations

import threading

from ..core.conversion_job import ConversionJob
from ..core.conversion_settings import ConversionSettings
from ..core.converter_factory import ConverterFactory
from ..core.ffmpeg_locator import FfmpegNotFoundError
from .conversion_events import ConversionEventName, ConversionEventQueue
from .gui_progress_reporter import GuiProgressReporter


class ConversionWorker:
    """Converts a batch on its own thread so the window stays usable."""

    def __init__(self, event_queue: ConversionEventQueue, converter_factory: ConverterFactory) -> None:
        self._event_queue = event_queue
        self._converter_factory = converter_factory
        self._cancellation_event = threading.Event()
        self._worker_thread: threading.Thread | None = None

    @property
    def is_running(self) -> bool:
        """Tell whether a conversion is going on right now."""
        return self._worker_thread is not None and self._worker_thread.is_alive()

    def start(self, jobs: list[ConversionJob], settings: ConversionSettings) -> None:
        """Start the conversion of the given jobs in the background."""
        self._cancellation_event.clear()
        self._worker_thread = threading.Thread(
            target=self._convert_all,
            args=(jobs, settings),
            daemon=True,
        )
        self._worker_thread.start()

    def cancel(self) -> None:
        """Ask the running conversion to stop as soon as possible."""
        self._cancellation_event.set()

    def _convert_all(self, jobs: list[ConversionJob], settings: ConversionSettings) -> None:
        """Run the whole batch and report a missing ffmpeg as an event."""
        try:
            batch_converter = self._converter_factory.create_batch_converter(GuiProgressReporter(self._event_queue))
        except FfmpegNotFoundError as error:
            self._event_queue.publish(ConversionEventName.ENGINE_FAILED, message=str(error))
            return
        batch_converter.convert_all(jobs, settings, self._cancellation_event)
