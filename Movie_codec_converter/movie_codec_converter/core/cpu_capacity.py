"""The processor capacity that decides how many files are converted at once."""

from __future__ import annotations

import os

CORES_NEEDED_BY_ONE_CONVERSION = 4
MAXIMUM_RECOMMENDED_JOB_COUNT = 4


class CpuCapacity:
    """Tells how many conversions and how many ffmpeg threads the processor can carry."""

    def available_core_count(self) -> int:
        """Return the number of processor cores this program is allowed to use."""
        try:
            return max(len(os.sched_getaffinity(0)), 1)
        except AttributeError:
            return max(os.cpu_count() or 1, 1)

    def recommended_parallel_job_count(self) -> int:
        """Return how many files should be converted at the same time by default.

        One ffmpeg already uses several cores, so a quarter of the cores is given
        to the parallel jobs. More jobs than that only make them fight for the
        processor and for the disk.
        """
        core_share = self.available_core_count() // CORES_NEEDED_BY_ONE_CONVERSION
        return max(1, min(MAXIMUM_RECOMMENDED_JOB_COUNT, core_share))

    def threads_for_each_job(self, parallel_job_count: int) -> int:
        """Return how many threads one ffmpeg may use when jobs run side by side."""
        return max(1, self.available_core_count() // max(1, parallel_job_count))
