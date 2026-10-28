/**
 * Runs every browser conversion against generated sample files.
 *
 * This exercises the real scheduler, the real worker pool and the real
 * converters, so a green run means the website works in this browser.
 */

import { ConversionJob, JobStatus } from './core/conversion-job.js';
import { applyOptionDefaults } from './core/conversion-option.js';
import { ParallelConversionScheduler } from './core/parallel-conversion-scheduler.js';
import { buildConversionRegistry } from './converters/converter-catalogue.js';
import { writeZip, archiveEntry } from './converters/archive-formats.js';

const registry = buildConversionRegistry();

/** Build one sample file per source family the tests need. */
async function buildSampleFiles() {
  return {
    png: new File([await buildSamplePngBytes()], 'sample.png'),
    csv: new File(['name,age,city\nAda,36,London\nLin,29,"Oslo, Norway"\n'], 'sample.csv'),
    json: new File([JSON.stringify([{ name: 'Ada', age: 36 }, { name: 'Lin', age: 29 }])], 'sample.json'),
    xml: new File(
      ['<?xml version="1.0"?><records><record><name>Ada</name><age>36</age></record></records>'],
      'sample.xml',
    ),
    yaml: new File(['- name: Ada\n  age: 36\n- name: Lin\n  age: 29\n'], 'sample.yaml'),
    md: new File(['# Title\n\nSome **bold** text with a [link](https://example.com).\n\n- one\n- two\n'], 'sample.md'),
    txt: new File(['Hello world\n\nSecond paragraph.\n'], 'sample.txt'),
    html: new File(['<h1>Title</h1><p>Hello <strong>world</strong></p>'], 'sample.html'),
    wav: new File([buildSampleWavBytes()], 'sample.wav'),
    zip: new File([await buildSampleZipBytes()], 'sample.zip'),
  };
}

async function buildSamplePngBytes() {
  const canvas = new OffscreenCanvas(120, 80);
  const context = canvas.getContext('2d');
  context.fillStyle = '#4c8dff';
  context.fillRect(0, 0, 120, 80);
  context.fillStyle = '#ffffff';
  context.fillRect(20, 20, 40, 40);
  return canvas.convertToBlob({ type: 'image/png' });
}

/** Build half a second of a 440 Hz tone as a 16-bit mono WAV file. */
function buildSampleWavBytes() {
  const sampleRate = 8000;
  const frameCount = sampleRate / 2;
  const view = new DataView(new ArrayBuffer(44 + frameCount * 2));
  writeAscii(view, 0, 'RIFF');
  view.setUint32(4, 36 + frameCount * 2, true);
  writeAscii(view, 8, 'WAVEfmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeAscii(view, 36, 'data');
  view.setUint32(40, frameCount * 2, true);
  for (let index = 0; index < frameCount; index += 1) {
    const sample = Math.sin((index / sampleRate) * 440 * 2 * Math.PI) * 0.4;
    view.setInt16(44 + index * 2, Math.round(sample * 0x7fff), true);
  }
  return view.buffer;
}

function writeAscii(view, offset, text) {
  for (let index = 0; index < text.length; index += 1) {
    view.setUint8(offset + index, text.charCodeAt(index));
  }
}

async function buildSampleZipBytes() {
  const encoder = new TextEncoder();
  return writeZip([
    archiveEntry('notes/first.txt', encoder.encode('first file contents')),
    archiveEntry('notes/second.txt', encoder.encode('second file contents, a little longer')),
  ]);
}

/** Build one job for every conversion the registry offers for our samples. */
function buildJobsForSamples(samples) {
  const jobs = [];
  for (const [sourceFormat, file] of Object.entries(samples)) {
    for (const targetFormat of registry.targetFormatsFor(sourceFormat)) {
      const job = new ConversionJob(file);
      job.targetFormat = targetFormat;
      job.options = applyOptionDefaults(registry.optionsFor(sourceFormat, targetFormat));
      jobs.push(job);
    }
  }
  return jobs;
}

function renderResults(jobs) {
  const tableBody = document.getElementById('results');
  tableBody.replaceChildren(
    ...jobs.map((job) => {
      const row = document.createElement('tr');
      row.append(
        buildCell(`.${job.sourceFormat} → .${job.targetFormat}`),
        buildStatusCell(job),
        buildCell(describeOutput(job), 'detail'),
      );
      return row;
    }),
  );
  const passed = jobs.filter((job) => job.status === JobStatus.DONE).length;
  const summary = document.getElementById('summary');
  summary.textContent = `${passed} of ${jobs.length} conversions passed`;
  summary.className = passed === jobs.length ? 'pass' : 'fail';
}

function buildCell(text, className = '') {
  const cell = document.createElement('td');
  cell.textContent = text;
  cell.className = className;
  return cell;
}

function buildStatusCell(job) {
  const cell = document.createElement('td');
  const passed = job.status === JobStatus.DONE;
  cell.textContent = passed ? 'PASS' : 'FAIL';
  cell.className = passed ? 'pass' : 'fail';
  return cell;
}

function describeOutput(job) {
  if (job.status !== JobStatus.DONE) {
    return job.errorMessage;
  }
  return `${job.result.fileName} · ${job.result.blob.size} bytes · ${job.result.blob.type || 'no type'}`;
}

/**
 * Send the results to a listener when the page is opened with `?report=1`.
 *
 * This lets the suite run in a headless browser during development. Opening the
 * page normally never contacts anything.
 */
async function reportResultsIfRequested(jobs) {
  if (new URLSearchParams(location.search).get('report') !== '1') {
    return;
  }
  const summary = jobs.map((job) => ({
    conversion: `${job.sourceFormat}>${job.targetFormat}`,
    status: job.status,
    detail: describeOutput(job),
  }));
  await fetch('/report', { method: 'POST', body: JSON.stringify(summary) }).catch(() => {});
}

const samples = await buildSampleFiles();
const jobs = buildJobsForSamples(samples);
const scheduler = new ParallelConversionScheduler(registry, { onJobChanged: () => {} });
await scheduler.run(jobs);
renderResults(jobs);
await reportResultsIfRequested(jobs);
