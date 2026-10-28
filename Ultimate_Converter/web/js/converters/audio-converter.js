/**
 * Audio conversion using the Web Audio API's decoder and a built-in WAV writer.
 *
 * The browser can decode every common compressed format but can encode none of
 * them, so the website offers decoding to WAV. Re-compressing to MP3 or AAC is
 * what the desktop application is for.
 */

import { AUTOMATIC, choiceOption, isAutomatic } from '../core/conversion-option.js';
import { Converter } from '../core/converter.js';
import {
  DECODABLE_AUDIO_FORMATS,
  ENCODABLE_AUDIO_FORMATS,
  buildConversionPairs,
} from '../core/format-families.js';
import { BinaryWriter } from './binary-writer.js';

const WAV_PCM_FORMAT_TAG = 1;
const BITS_PER_SAMPLE = 16;

export class AudioConverter extends Converter {
  get displayName() {
    return 'Web Audio decoder';
  }

  /** Audio contexts are not exposed to workers, so this stays on the page. */
  get runsInWorker() {
    return false;
  }

  declareConversionPairs() {
    return buildConversionPairs(DECODABLE_AUDIO_FORMATS, ENCODABLE_AUDIO_FORMATS);
  }

  missingCapabilities() {
    return typeof OfflineAudioContext === 'undefined' ? ['OfflineAudioContext'] : [];
  }

  declareOptions() {
    return AUDIO_OPTIONS;
  }

  async convert(request) {
    const decoded = await decodeAudio(request);
    const resampled = await resampleIfRequested(decoded, request.options);
    return { blob: encodeWav(resampled, request.options) };
  }
}

const AUDIO_OPTIONS = [
  choiceOption('sampleRate', 'Sample rate', [
    ['Same as source', AUTOMATIC],
    ['48000 Hz', '48000'],
    ['44100 Hz (CD)', '44100'],
    ['22050 Hz', '22050'],
    ['16000 Hz (voice)', '16000'],
  ]),
  choiceOption('channels', 'Channels', [
    ['Same as source', AUTOMATIC],
    ['Stereo', '2'],
    ['Mono', '1'],
  ]),
  choiceOption(
    'normalise',
    'Volume',
    [
      ['Leave unchanged', 'none'],
      ['Normalise to full scale', 'peak'],
    ],
    'Normalising raises the loudest point to the maximum without clipping.',
  ),
];

/** Decode compressed audio into raw samples. */
async function decodeAudio(request) {
  const context = new OfflineAudioContext(1, 1, 44100);
  try {
    return await context.decodeAudioData(request.buffer);
  } catch (error) {
    throw new Error(`This browser cannot decode .${request.sourceFormat} audio.`);
  }
}

/** Render the buffer again when the sample rate or channel count changed. */
async function resampleIfRequested(buffer, options) {
  const sampleRate = isAutomatic(options.sampleRate)
    ? buffer.sampleRate
    : Number(options.sampleRate);
  const channelCount = isAutomatic(options.channels)
    ? buffer.numberOfChannels
    : Number(options.channels);
  if (sampleRate === buffer.sampleRate && channelCount === buffer.numberOfChannels) {
    return buffer;
  }
  const frameCount = Math.ceil(buffer.duration * sampleRate);
  const context = new OfflineAudioContext(channelCount, frameCount, sampleRate);
  const source = context.createBufferSource();
  source.buffer = buffer;
  source.connect(context.destination);
  source.start();
  return context.startRendering();
}

/** Write raw samples as a 16-bit PCM WAV file. */
function encodeWav(buffer, options) {
  const channels = readChannels(buffer);
  const gain = options.normalise === 'peak' ? computeNormalisingGain(channels) : 1;
  const writer = new BinaryWriter();
  const dataByteCount = buffer.length * channels.length * (BITS_PER_SAMPLE / 8);
  writeWavHeader(writer, buffer, channels.length, dataByteCount);
  writeInterleavedSamples(writer, channels, buffer.length, gain);
  return new Blob([writer.toUint8Array()], { type: 'audio/wav' });
}

function readChannels(buffer) {
  return Array.from({ length: buffer.numberOfChannels }, (_unused, index) =>
    buffer.getChannelData(index),
  );
}

/** Return the factor that lifts the loudest sample to full scale. */
function computeNormalisingGain(channels) {
  let peak = 0;
  for (const samples of channels) {
    for (const sample of samples) {
      peak = Math.max(peak, Math.abs(sample));
    }
  }
  return peak > 0 ? 1 / peak : 1;
}

function writeWavHeader(writer, buffer, channelCount, dataByteCount) {
  const byteRate = buffer.sampleRate * channelCount * (BITS_PER_SAMPLE / 8);
  writer
    .writeAscii('RIFF')
    .writeUint32(36 + dataByteCount)
    .writeAscii('WAVE')
    .writeAscii('fmt ')
    .writeUint32(16)
    .writeUint16(WAV_PCM_FORMAT_TAG)
    .writeUint16(channelCount)
    .writeUint32(buffer.sampleRate)
    .writeUint32(byteRate)
    .writeUint16(channelCount * (BITS_PER_SAMPLE / 8))
    .writeUint16(BITS_PER_SAMPLE)
    .writeAscii('data')
    .writeUint32(dataByteCount);
}

/** WAV stores channels interleaved, one frame at a time. */
function writeInterleavedSamples(writer, channels, frameCount, gain) {
  for (let frame = 0; frame < frameCount; frame += 1) {
    for (const samples of channels) {
      writer.writeUint16(toSignedSixteenBit(samples[frame] * gain));
    }
  }
}

function toSignedSixteenBit(sample) {
  const clamped = Math.max(-1, Math.min(1, sample));
  return Math.round(clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff);
}
