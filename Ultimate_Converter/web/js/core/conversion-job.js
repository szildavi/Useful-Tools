/** The unit of work shared by the queue, the scheduler and the interface. */

import { baseNameOfFileName, formatOfFileName } from './format-families.js';

export const JobStatus = Object.freeze({
  PENDING: 'Pending',
  RUNNING: 'Converting',
  DONE: 'Done',
  FAILED: 'Failed',
  CANCELLED: 'Cancelled',
});

let nextJobId = 1;

export class ConversionJob {
  constructor(file) {
    this.jobId = nextJobId++;
    this.file = file;
    this.sourceFormat = formatOfFileName(file.name);
    this.targetFormat = '';
    this.options = {};
    this.status = JobStatus.PENDING;
    this.errorMessage = '';
    this.result = null;
  }

  get sourceName() {
    return this.file.name;
  }

  get sourceSize() {
    return this.file.size;
  }

  /** Name the converted file keeps when it is downloaded. */
  buildOutputName() {
    return `${baseNameOfFileName(this.file.name)}.${this.targetFormat}`;
  }

  markRunning() {
    this.status = JobStatus.RUNNING;
    this.errorMessage = '';
  }

  markDone(result) {
    this.status = JobStatus.DONE;
    this.result = result;
  }

  markFailed(errorMessage) {
    this.status = JobStatus.FAILED;
    this.errorMessage = errorMessage;
  }

  markCancelled() {
    this.status = JobStatus.CANCELLED;
  }

  get isFinished() {
    return [JobStatus.DONE, JobStatus.FAILED, JobStatus.CANCELLED].includes(this.status);
  }
}
