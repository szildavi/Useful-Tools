/**
 * Runs a batch of conversion jobs across as many CPU cores as the browser has.
 *
 * Most converters run inside Web Workers. The ones that need the Web Audio API
 * cannot, because audio contexts are not exposed to workers, so those run on
 * the main thread instead - but they still occupy a slot, which keeps the total
 * number of conversions in flight equal to the worker count either way.
 */

import { JobStatus } from './conversion-job.js';
import { WorkerPool } from './worker-pool.js';

const CONVERSION_WORKER_URL = new URL('../workers/conversion-worker.js', import.meta.url);

/** Return one worker per CPU core, which is what a batch is sized to. */
export function defaultWorkerCount() {
  return Math.max(1, navigator.hardwareConcurrency || 4);
}

export class ParallelConversionScheduler {
  #registry;
  #onJobChanged;
  #workerPool;
  #isCancelled = false;
  #isRunning = false;

  constructor(registry, { onJobChanged, workerCount = defaultWorkerCount() }) {
    this.#registry = registry;
    this.#onJobChanged = onJobChanged;
    this.#workerPool = new WorkerPool(CONVERSION_WORKER_URL, workerCount);
  }

  get isRunning() {
    return this.#isRunning;
  }

  get workerCount() {
    return this.#workerPool.size;
  }

  /** Change how many files are converted at the same time. */
  set workerCount(count) {
    this.#workerPool.size = count;
  }

  /** Ask the batch to stop; conversions already in flight finish their file. */
  cancel() {
    this.#isCancelled = true;
  }

  /** Convert every pending job, resolving once the whole batch has settled. */
  async run(jobs) {
    if (this.#isRunning) {
      throw new Error('A conversion batch is already running.');
    }
    this.#isCancelled = false;
    this.#isRunning = true;
    try {
      const pending = jobs.filter((job) => job.status === JobStatus.PENDING);
      await Promise.all(pending.map((job) => this.#runSingleJob(job)));
    } finally {
      this.#isRunning = false;
    }
    return jobs;
  }

  /** Convert one file, reporting every status change to the listener. */
  async #runSingleJob(job) {
    if (this.#isCancelled) {
      job.markCancelled();
      this.#onJobChanged(job);
      return;
    }
    job.markRunning();
    this.#onJobChanged(job);
    try {
      job.markDone(await this.#convert(job));
    } catch (error) {
      job.markFailed(error.message);
    }
    this.#onJobChanged(job);
  }

  /** Send the job to a worker, or run it here when it cannot be moved. */
  async #convert(job) {
    const converter = this.#registry.converterFor(job.sourceFormat, job.targetFormat);
    const request = await buildConversionRequest(job);
    if (converter.runsInWorker) {
      return toResult(await this.#workerPool.run(request), job);
    }
    return toResult(await converter.convert(request), job);
  }
}

/** Read the file once and package everything a converter needs. */
async function buildConversionRequest(job) {
  return {
    jobId: job.jobId,
    buffer: await job.file.arrayBuffer(),
    fileName: job.sourceName,
    sourceFormat: job.sourceFormat,
    targetFormat: job.targetFormat,
    options: job.options,
  };
}

/** Turn a converter's reply into the blob the download link will use. */
function toResult(reply, job) {
  const blob = reply.blob ?? new Blob([reply.buffer], { type: reply.mimeType });
  return { blob, fileName: reply.fileName ?? job.buildOutputName() };
}
