/**
 * Wires the website together: queue, settings sidebar and the conversion run.
 *
 * Everything happens inside the page. No file is ever uploaded anywhere.
 */

import { ConversionJob, JobStatus } from './core/conversion-job.js';
import { applyOptionDefaults } from './core/conversion-option.js';
import {
  ParallelConversionScheduler,
  defaultWorkerCount,
} from './core/parallel-conversion-scheduler.js';
import { buildConversionRegistry } from './converters/converter-catalogue.js';
import { DropZone } from './ui/drop-zone.js';
import { FormatsDialog } from './ui/formats-dialog.js';
import { OptionsView } from './ui/options-view.js';
import { preferredTargetFormat } from './ui/preferred-target-format.js';
import { QueueView } from './ui/queue-view.js';
import { TargetFormatView } from './ui/target-format-view.js';

class UltimateConverterPage {
  #registry = buildConversionRegistry();
  #scheduler;
  #queueView;
  #targetFormatView;
  #optionsView;
  #formatsDialog;
  #dropZone;
  #elements;

  constructor(elements) {
    this.#elements = elements;
    this.#scheduler = new ParallelConversionScheduler(this.#registry, {
      onJobChanged: (job) => this.#handleJobChanged(job),
    });
    this.#buildViews();
    this.#connectButtons();
    this.#showCapabilitySummary();
    this.#refreshControls();
  }

  #buildViews() {
    this.#queueView = new QueueView({
      listElement: this.#elements.queueList,
      countElement: this.#elements.queueCount,
      onSelectionChanged: (jobs) => this.#handleSelectionChanged(jobs),
    });
    this.#targetFormatView = new TargetFormatView({
      container: this.#elements.targetFormatContainer,
      onTargetFormatChosen: (format) => this.#applyTargetFormat(format),
    });
    this.#optionsView = new OptionsView({
      container: this.#elements.optionsContainer,
      onOptionsChanged: (values) => this.#applyOptions(values),
    });
    this.#formatsDialog = new FormatsDialog({
      dialog: this.#elements.formatsDialog,
      body: this.#elements.formatsDialogBody,
      closeButton: this.#elements.formatsCloseButton,
      registry: this.#registry,
    });
    this.#dropZone = new DropZone({
      element: this.#elements.dropZone,
      fileInput: this.#elements.fileInput,
      onFilesChosen: (files) => this.#enqueueFiles(files),
    });
  }

  #connectButtons() {
    this.#elements.addMoreButton.addEventListener('click', () => this.#dropZone.openFilePicker());
    this.#elements.clearButton.addEventListener('click', () => this.#clearQueue());
    this.#elements.convertButton.addEventListener('click', () => this.#startConversion());
    this.#elements.downloadAllButton.addEventListener('click', () => this.#downloadEverything());
    this.#elements.formatsButton.addEventListener('click', () => this.#formatsDialog.open());
    this.#connectWorkerCountSlider();
  }

  #connectWorkerCountSlider() {
    const slider = this.#elements.workerCount;
    slider.max = String(Math.max(4, defaultWorkerCount() * 2));
    slider.value = String(defaultWorkerCount());
    const applyValue = () => {
      this.#scheduler.workerCount = Number(slider.value);
      this.#elements.workerCountLabel.textContent =
        `${slider.value} file${slider.value === '1' ? '' : 's'} at a time` +
        ` (this machine reports ${defaultWorkerCount()} cores)`;
    };
    slider.addEventListener('input', applyValue);
    applyValue();
  }

  #showCapabilitySummary() {
    const available = this.#registry.countConversionPairs({ onlyAvailable: true });
    const total = this.#registry.countConversionPairs({ onlyAvailable: false });
    this.#elements.capabilitySummary.textContent =
      `${available} of ${total} browser conversions are available here · ` +
      'files never leave your computer';
  }

  // ------------------------------------------------------------ queue edits

  #enqueueFiles(files) {
    const skipped = [];
    for (const file of files) {
      if (!this.#enqueueSingleFile(file)) {
        skipped.push(file.name);
      }
    }
    this.#elements.queue.hidden = this.#queueView.jobs.length === 0;
    this.#refreshControls();
    if (skipped.length > 0) {
      this.#reportSkippedFiles(skipped);
    }
  }

  /** Queue one file; report whether a conversion target was found. */
  #enqueueSingleFile(file) {
    const job = new ConversionJob(file);
    const targets = this.#registry.targetFormatsFor(job.sourceFormat);
    if (targets.length === 0) {
      return false;
    }
    job.targetFormat = preferredTargetFormat(job.sourceFormat, targets);
    job.options = this.#defaultOptionsFor(job);
    this.#queueView.addJob(job);
    return true;
  }

  #reportSkippedFiles(skippedNames) {
    const names = skippedNames.slice(0, 8).join(', ');
    const remainder = skippedNames.length > 8 ? ` and ${skippedNames.length - 8} more` : '';
    window.alert(
      `These files cannot be converted in a browser: ${names}${remainder}.\n\n` +
        'Use the desktop application for video, RAW photos, office documents and e-books.',
    );
  }

  #clearQueue() {
    this.#queueView.clear();
    this.#elements.queue.hidden = true;
    this.#refreshControls();
  }

  // -------------------------------------------------------------- selection

  #handleSelectionChanged(selectedJobs) {
    if (selectedJobs.length === 0) {
      this.#targetFormatView.showMessage('Select a file to change its settings.');
      this.#optionsView.showMessage('Nothing selected.');
      return;
    }
    this.#targetFormatView.showFormats(
      this.#sharedTargetFormats(selectedJobs),
      selectedJobs[0].targetFormat,
      selectionSummary(selectedJobs),
    );
    this.#showOptionsFor(selectedJobs);
  }

  /** Return the targets reachable from every selected source format. */
  #sharedTargetFormats(selectedJobs) {
    const targetSets = selectedJobs.map(
      (job) => new Set(this.#registry.targetFormatsFor(job.sourceFormat)),
    );
    return [...targetSets[0]].filter((target) => targetSets.every((set) => set.has(target))).sort();
  }

  #showOptionsFor(selectedJobs) {
    const conversions = new Set(
      selectedJobs.map((job) => `${job.sourceFormat}>${job.targetFormat}`),
    );
    if (conversions.size !== 1) {
      this.#optionsView.showMessage(
        'The selected files use different conversions. Pick one to change its settings.',
      );
      return;
    }
    const [sourceFormat, targetFormat] = [...conversions][0].split('>');
    this.#optionsView.showOptions(
      this.#registry.optionsFor(sourceFormat, targetFormat),
      selectedJobs[0].options,
    );
  }

  // ------------------------------------------------------------------ edits

  #applyTargetFormat(targetFormat) {
    const selectedJobs = this.#queueView.selectedJobs;
    for (const job of selectedJobs) {
      job.targetFormat = targetFormat;
      job.options = this.#defaultOptionsFor(job);
      this.#queueView.refreshJob(job);
    }
    this.#showOptionsFor(selectedJobs);
  }

  #applyOptions(values) {
    for (const job of this.#queueView.selectedJobs) {
      Object.assign(job.options, values);
    }
  }

  #defaultOptionsFor(job) {
    return applyOptionDefaults(this.#registry.optionsFor(job.sourceFormat, job.targetFormat));
  }

  // ------------------------------------------------------------- conversion

  async #startConversion() {
    const jobs = this.#queueView.jobs;
    this.#resetFinishedJobs(jobs);
    this.#refreshControls({ isRunning: true });
    try {
      await this.#scheduler.run(jobs);
    } finally {
      this.#refreshControls();
      this.#announceFailures(jobs);
    }
  }

  /** Let a cancelled or failed job be retried by the next run. */
  #resetFinishedJobs(jobs) {
    for (const job of jobs) {
      if ([JobStatus.FAILED, JobStatus.CANCELLED].includes(job.status)) {
        job.status = JobStatus.PENDING;
        this.#queueView.refreshJob(job);
      }
    }
  }

  #handleJobChanged(job) {
    this.#queueView.refreshJob(job);
    this.#refreshControls({ isRunning: this.#scheduler.isRunning });
  }

  #announceFailures(jobs) {
    const failed = jobs.filter((job) => job.status === JobStatus.FAILED);
    if (failed.length === 0) {
      return;
    }
    const details = failed
      .slice(0, 8)
      .map((job) => `  ${job.sourceName}: ${job.errorMessage}`)
      .join('\n');
    window.alert(`${failed.length} of ${jobs.length} files could not be converted:\n\n${details}`);
  }

  #downloadEverything() {
    for (const job of this.#queueView.jobs.filter((job) => job.status === JobStatus.DONE)) {
      downloadBlob(job.result.blob, job.result.fileName);
    }
  }

  #refreshControls({ isRunning = this.#scheduler.isRunning } = {}) {
    const jobs = this.#queueView.jobs;
    const finishedCount = jobs.filter((job) => job.status === JobStatus.DONE).length;
    this.#elements.convertButton.disabled = isRunning || jobs.length === 0;
    this.#elements.convertButton.textContent = isRunning ? 'Converting…' : 'Convert all';
    this.#elements.clearButton.disabled = isRunning;
    this.#elements.downloadAllButton.hidden = finishedCount < 2;
  }
}

function selectionSummary(selectedJobs) {
  if (selectedJobs.length === 1) {
    return `1 file selected · ${selectedJobs[0].sourceName}`;
  }
  const formats = [...new Set(selectedJobs.map((job) => `.${job.sourceFormat}`))].sort();
  return `${selectedJobs.length} files selected · ${formats.join(', ')}`;
}

/** Trigger a browser download for one converted file. */
function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

/** Look up every element the page needs exactly once. */
function collectElements() {
  const byId = (id) => document.getElementById(id);
  return {
    capabilitySummary: byId('capability-summary'),
    dropZone: byId('drop-zone'),
    fileInput: byId('file-input'),
    queue: byId('queue'),
    queueList: byId('queue-list'),
    queueCount: byId('queue-count'),
    addMoreButton: byId('add-more-button'),
    clearButton: byId('clear-button'),
    convertButton: byId('convert-button'),
    downloadAllButton: byId('download-all-button'),
    formatsButton: byId('formats-button'),
    formatsDialog: byId('formats-dialog'),
    formatsDialogBody: byId('formats-dialog-body'),
    formatsCloseButton: byId('formats-close-button'),
    targetFormatContainer: byId('target-format-container'),
    optionsContainer: byId('options-container'),
    workerCount: byId('worker-count'),
    workerCountLabel: byId('worker-count-label'),
  };
}

new UltimateConverterPage(collectElements());
