"""The events a running conversion sends to the graphical interface."""

from __future__ import annotations

import queue
from dataclasses import dataclass, field
from enum import Enum, auto
from typing import Any


class ConversionEventName(Enum):
    """Names the graphical interface can react to."""

    BATCH_STARTED = auto()
    JOB_STARTED = auto()
    JOB_PROGRESSED = auto()
    JOB_FINISHED = auto()
    BATCH_FINISHED = auto()
    ENGINE_FAILED = auto()


@dataclass(frozen=True)
class ConversionEvent:
    """One thing that happened during a conversion, with its details."""

    name: ConversionEventName
    details: dict[str, Any] = field(default_factory=dict)


class ConversionEventQueue:
    """Carries the events from the conversion thread to the interface thread."""

    def __init__(self) -> None:
        self._events: queue.Queue[ConversionEvent] = queue.Queue()

    def publish(self, name: ConversionEventName, **details: Any) -> None:
        """Put a new event into the queue."""
        self._events.put(ConversionEvent(name, details))

    def collect_pending(self) -> list[ConversionEvent]:
        """Return and remove every event that is waiting in the queue."""
        pending_events: list[ConversionEvent] = []
        while True:
            try:
                pending_events.append(self._events.get_nowait())
            except queue.Empty:
                return pending_events
