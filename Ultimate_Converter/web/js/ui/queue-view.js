/** The list of queued files, their target formats and their progress. */

import { JobStatus } from '../core/conversion-job.js';

export class QueueView {
  #listElement;
  #countElement;
  #onSelectionChanged;
  #rowsByJobId = new Map();
  #jobs = [];
  #selectedJobIds = new Set();

  constructor({ listElement, countElement, onSelectionChanged }) {
    this.#listElement = listElement;
    this.#countElement = countElement;
    this.#onSelectionChanged = onSelectionChanged;
  }

  get jobs() {
    return [...this.#jobs];
  }

  get selectedJobs() {
    return this.#jobs.filter((job) => this.#selectedJobIds.has(job.jobId));
  }

  /** Append one job and select it when it is the only one queued. */
  addJob(job) {
    this.#jobs.push(job);
    const row = this.#buildRow(job);
    this.#rowsByJobId.set(job.jobId, row);
    this.#listElement.append(row);
    if (this.#jobs.length === 1) {
      this.selectOnly(job);
    }
    this.#refreshCount();
  }

  /** Repaint one row after its target format or status changed. */
  refreshJob(job) {
    const row = this.#rowsByJobId.get(job.jobId);
    if (row) {
      row.replaceChildren(...this.#buildRowContent(job));
      row.className = this.#rowClassName(job);
    }
    this.#refreshCount();
  }

  /** Make `job` the only selected row. */
  selectOnly(job) {
    this.#selectedJobIds = new Set([job.jobId]);
    this.#refreshSelectionStyling();
    this.#onSelectionChanged(this.selectedJobs);
  }

  /** Add or remove one row from the selection. */
  toggleSelection(job) {
    if (this.#selectedJobIds.has(job.jobId)) {
      this.#selectedJobIds.delete(job.jobId);
    } else {
      this.#selectedJobIds.add(job.jobId);
    }
    this.#refreshSelectionStyling();
    this.#onSelectionChanged(this.selectedJobs);
  }

  /** Remove one job from the queue. */
  removeJob(job) {
    this.#jobs = this.#jobs.filter((candidate) => candidate.jobId !== job.jobId);
    this.#rowsByJobId.get(job.jobId)?.remove();
    this.#rowsByJobId.delete(job.jobId);
    this.#selectedJobIds.delete(job.jobId);
    this.#refreshCount();
    this.#onSelectionChanged(this.selectedJobs);
  }

  /** Empty the queue. */
  clear() {
    this.#jobs = [];
    this.#rowsByJobId.clear();
    this.#selectedJobIds.clear();
    this.#listElement.replaceChildren();
    this.#refreshCount();
    this.#onSelectionChanged([]);
  }

  #buildRow(job) {
    const row = document.createElement('li');
    row.className = this.#rowClassName(job);
    row.append(...this.#buildRowContent(job));
    row.addEventListener('click', (event) => {
      if (event.target.closest('button')) {
        return;
      }
      if (event.ctrlKey || event.metaKey || event.shiftKey) {
        this.toggleSelection(job);
      } else {
        this.selectOnly(job);
      }
    });
    return row;
  }

  #rowClassName(job) {
    const selected = this.#selectedJobIds.has(job.jobId) ? ' queue-item--selected' : '';
    return `queue-item${selected}`;
  }

  #buildRowContent(job) {
    return [buildNameCell(job), buildStatusCell(job), buildActionCell(job, () => this.removeJob(job))];
  }

  #refreshSelectionStyling() {
    for (const job of this.#jobs) {
      const row = this.#rowsByJobId.get(job.jobId);
      if (row) {
        row.className = this.#rowClassName(job);
      }
    }
  }

  #refreshCount() {
    const finished = this.#jobs.filter((job) => job.isFinished).length;
    const succeeded = this.#jobs.filter((job) => job.status === JobStatus.DONE).length;
    this.#countElement.textContent =
      finished === 0
        ? `${this.#jobs.length} file${this.#jobs.length === 1 ? '' : 's'} queued`
        : `${finished} of ${this.#jobs.length} finished · ${succeeded} succeeded`;
  }
}

function buildNameCell(job) {
  const cell = document.createElement('div');
  cell.className = 'queue-item__name';
  cell.title = job.sourceName;
  cell.textContent = job.sourceName;
  const detail = document.createElement('span');
  detail.className = 'queue-item__detail';
  detail.textContent = `.${job.sourceFormat} → .${job.targetFormat} · ${formatByteSize(job.sourceSize)}`;
  cell.append(detail);
  return cell;
}

function buildStatusCell(job) {
  const cell = document.createElement('span');
  cell.className = `queue-item__status queue-item__status--${statusModifier(job.status)}`;
  cell.textContent = job.status === JobStatus.FAILED ? job.errorMessage : job.status;
  cell.title = job.errorMessage || job.status;
  return cell;
}

/** Build the trailing button: download when finished, remove otherwise. */
function buildActionCell(job, onRemove) {
  if (job.status === JobStatus.DONE) {
    return buildDownloadButton(job);
  }
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'button button--link';
  button.textContent = 'Remove';
  button.addEventListener('click', onRemove);
  return button;
}

function buildDownloadButton(job) {
  const link = document.createElement('a');
  link.className = 'button button--link';
  link.textContent = 'Download';
  link.href = URL.createObjectURL(job.result.blob);
  link.download = job.result.fileName;
  return link;
}

function statusModifier(status) {
  return status.replace(/\s+/g, '');
}

/** Format a byte count in the largest unit that stays readable. */
export function formatByteSize(byteCount) {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = byteCount;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  return `${unitIndex === 0 ? size : size.toFixed(1)} ${units[unitIndex]}`;
}
