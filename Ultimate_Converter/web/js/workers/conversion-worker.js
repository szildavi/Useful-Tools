/**
 * Runs one conversion at a time, off the page's main thread.
 *
 * The pool owns several copies of this worker, which is how the website
 * converts as many files at once as the machine has CPU cores.
 */

import { buildConversionRegistry } from '../converters/converter-catalogue.js';

const registry = buildConversionRegistry();

self.addEventListener('message', async (event) => {
  const request = event.data;
  try {
    const reply = await runConversion(request);
    self.postMessage(reply, [reply.buffer]);
  } catch (error) {
    self.postMessage({ jobId: request.jobId, ok: false, error: error.message });
  }
});

/** Convert one file and package the reply the pool expects. */
async function runConversion(request) {
  const converter = registry.converterFor(request.sourceFormat, request.targetFormat);
  const { blob } = await converter.convert(request);
  return {
    jobId: request.jobId,
    ok: true,
    buffer: await blob.arrayBuffer(),
    mimeType: blob.type,
  };
}
