/**
 * ZIP and TAR readers and writers built on the browser's compression streams.
 *
 * `CompressionStream` and `DecompressionStream` provide raw DEFLATE and GZIP
 * natively, which is everything these two container formats need, so no
 * third-party library is involved.
 */

import { BinaryWriter } from './binary-writer.js';

const ZIP_LOCAL_HEADER_SIGNATURE = 0x04034b50;
const ZIP_CENTRAL_HEADER_SIGNATURE = 0x02014b50;
const ZIP_END_OF_DIRECTORY_SIGNATURE = 0x06054b50;
const ZIP_DEFLATE_METHOD = 8;
const ZIP_STORE_METHOD = 0;
const TAR_BLOCK_SIZE = 512;

/** An archive entry: a name plus its uncompressed bytes. */
export function archiveEntry(name, bytes) {
  return { name, bytes };
}

// ----------------------------------------------------------------------- ZIP

/** Read every file out of a ZIP archive. */
export async function readZip(buffer) {
  const view = new DataView(buffer);
  const directoryStart = findCentralDirectoryStart(view);
  const entries = [];
  let offset = directoryStart;
  while (offset < view.byteLength && view.getUint32(offset, true) === ZIP_CENTRAL_HEADER_SIGNATURE) {
    const header = readCentralDirectoryHeader(view, offset);
    if (!header.name.endsWith('/')) {
      entries.push(archiveEntry(header.name, await readZipEntryData(buffer, view, header)));
    }
    offset = header.nextOffset;
  }
  if (entries.length === 0) {
    throw new Error('The ZIP archive contains no files.');
  }
  return entries;
}

/** Write entries into a ZIP archive, deflating each one unless asked not to. */
export async function writeZip(entries, { compress = true } = {}) {
  const writer = new BinaryWriter();
  const directoryRecords = [];
  for (const entry of entries) {
    const stored = await buildZipEntryPayload(entry, compress);
    directoryRecords.push({ ...stored, offset: writer.length });
    writeZipLocalHeader(writer, stored);
    writer.writeBytes(stored.payload);
  }
  const directoryStart = writer.length;
  for (const record of directoryRecords) {
    writeZipCentralHeader(writer, record);
  }
  writeZipEndOfDirectory(writer, directoryRecords.length, directoryStart, writer.length);
  return new Blob([writer.toUint8Array()], { type: 'application/zip' });
}

function findCentralDirectoryStart(view) {
  for (let offset = view.byteLength - 22; offset >= 0; offset -= 1) {
    if (view.getUint32(offset, true) === ZIP_END_OF_DIRECTORY_SIGNATURE) {
      return view.getUint32(offset + 16, true);
    }
  }
  throw new Error('This file is not a valid ZIP archive.');
}

function readCentralDirectoryHeader(view, offset) {
  const nameLength = view.getUint16(offset + 28, true);
  const extraLength = view.getUint16(offset + 30, true);
  const commentLength = view.getUint16(offset + 32, true);
  return {
    method: view.getUint16(offset + 10, true),
    compressedSize: view.getUint32(offset + 20, true),
    name: decodeName(view, offset + 46, nameLength),
    localHeaderOffset: view.getUint32(offset + 42, true),
    nextOffset: offset + 46 + nameLength + extraLength + commentLength,
  };
}

/** Follow a directory entry to its local header and inflate the payload. */
async function readZipEntryData(buffer, view, header) {
  const localOffset = header.localHeaderOffset;
  if (view.getUint32(localOffset, true) !== ZIP_LOCAL_HEADER_SIGNATURE) {
    throw new Error(`The entry "${header.name}" is damaged.`);
  }
  const nameLength = view.getUint16(localOffset + 26, true);
  const extraLength = view.getUint16(localOffset + 28, true);
  const dataStart = localOffset + 30 + nameLength + extraLength;
  const compressed = new Uint8Array(buffer, dataStart, header.compressedSize);
  if (header.method === ZIP_STORE_METHOD) {
    return new Uint8Array(compressed);
  }
  if (header.method !== ZIP_DEFLATE_METHOD) {
    throw new Error(`The entry "${header.name}" uses an unsupported compression method.`);
  }
  return transformBytes(compressed, new DecompressionStream('deflate-raw'));
}

async function buildZipEntryPayload(entry, compress) {
  const payload = compress
    ? await transformBytes(entry.bytes, new CompressionStream('deflate-raw'))
    : entry.bytes;
  return {
    nameBytes: new TextEncoder().encode(entry.name),
    method: compress ? ZIP_DEFLATE_METHOD : ZIP_STORE_METHOD,
    crc: computeCrc32(entry.bytes),
    payload,
    uncompressedSize: entry.bytes.length,
  };
}

function writeZipLocalHeader(writer, stored) {
  writer
    .writeUint32(ZIP_LOCAL_HEADER_SIGNATURE)
    .writeUint16(20)
    .writeUint16(0)
    .writeUint16(stored.method)
    .writeUint16(0)
    .writeUint16(0)
    .writeUint32(stored.crc)
    .writeUint32(stored.payload.length)
    .writeUint32(stored.uncompressedSize)
    .writeUint16(stored.nameBytes.length)
    .writeUint16(0)
    .writeBytes(stored.nameBytes);
}

function writeZipCentralHeader(writer, record) {
  writer
    .writeUint32(ZIP_CENTRAL_HEADER_SIGNATURE)
    .writeUint16(20)
    .writeUint16(20)
    .writeUint16(0)
    .writeUint16(record.method)
    .writeUint16(0)
    .writeUint16(0)
    .writeUint32(record.crc)
    .writeUint32(record.payload.length)
    .writeUint32(record.uncompressedSize)
    .writeUint16(record.nameBytes.length)
    .writeUint16(0)
    .writeUint16(0)
    .writeUint16(0)
    .writeUint16(0)
    .writeUint32(0)
    .writeUint32(record.offset)
    .writeBytes(record.nameBytes);
}

function writeZipEndOfDirectory(writer, entryCount, directoryStart, directoryEnd) {
  writer
    .writeUint32(ZIP_END_OF_DIRECTORY_SIGNATURE)
    .writeUint16(0)
    .writeUint16(0)
    .writeUint16(entryCount)
    .writeUint16(entryCount)
    .writeUint32(directoryEnd - directoryStart)
    .writeUint32(directoryStart)
    .writeUint16(0);
}

// ----------------------------------------------------------------------- TAR

/** Read every file out of an uncompressed TAR archive. */
export function readTar(buffer) {
  const bytes = new Uint8Array(buffer);
  const entries = [];
  let offset = 0;
  while (offset + TAR_BLOCK_SIZE <= bytes.length) {
    const header = readTarHeader(bytes, offset);
    if (!header) {
      break;
    }
    offset += TAR_BLOCK_SIZE;
    if (header.isFile) {
      entries.push(archiveEntry(header.name, bytes.slice(offset, offset + header.size)));
    }
    offset += Math.ceil(header.size / TAR_BLOCK_SIZE) * TAR_BLOCK_SIZE;
  }
  if (entries.length === 0) {
    throw new Error('The TAR archive contains no files.');
  }
  return entries;
}

/** Write entries into an uncompressed TAR archive. */
export function writeTar(entries) {
  const writer = new BinaryWriter();
  for (const entry of entries) {
    writer.writeBytes(buildTarHeader(entry));
    writer.writeBytes(entry.bytes);
    writePadding(writer, entry.bytes.length);
  }
  writer.writeBytes(new Uint8Array(TAR_BLOCK_SIZE * 2));
  return new Blob([writer.toUint8Array()], { type: 'application/x-tar' });
}

function readTarHeader(bytes, offset) {
  const name = decodeTarField(bytes, offset, 100);
  if (name === '') {
    return null;
  }
  const typeFlag = String.fromCharCode(bytes[offset + 156] || 48);
  return {
    name,
    size: Number.parseInt(decodeTarField(bytes, offset + 124, 12) || '0', 8),
    isFile: typeFlag === '0' || typeFlag === '\0' || typeFlag === '',
  };
}

function decodeTarField(bytes, offset, length) {
  const slice = bytes.slice(offset, offset + length);
  const end = slice.indexOf(0);
  return new TextDecoder().decode(end === -1 ? slice : slice.slice(0, end)).trim();
}

/** Build the 512-byte header block, including its checksum. */
function buildTarHeader(entry) {
  const header = new Uint8Array(TAR_BLOCK_SIZE);
  writeTarField(header, 0, entry.name.slice(0, 99));
  writeTarField(header, 100, '0000644');
  writeTarField(header, 108, '0000000');
  writeTarField(header, 116, '0000000');
  writeTarField(header, 124, entry.bytes.length.toString(8).padStart(11, '0'));
  writeTarField(header, 136, Math.floor(Date.now() / 1000).toString(8).padStart(11, '0'));
  writeTarField(header, 148, '        ');
  header[156] = '0'.charCodeAt(0);
  writeTarField(header, 257, 'ustar');
  writeTarField(header, 263, '00');
  writeTarField(header, 148, `${checksumOf(header).toString(8).padStart(6, '0')}\0 `);
  return header;
}

function writeTarField(header, offset, text) {
  const bytes = new TextEncoder().encode(text);
  header.set(bytes, offset);
}

function checksumOf(header) {
  return header.reduce((total, byte) => total + byte, 0);
}

function writePadding(writer, byteCount) {
  const remainder = byteCount % TAR_BLOCK_SIZE;
  if (remainder !== 0) {
    writer.writeBytes(new Uint8Array(TAR_BLOCK_SIZE - remainder));
  }
}

// ------------------------------------------------------------------- helpers

/** Run bytes through a compression or decompression stream. */
export async function transformBytes(bytes, stream) {
  const response = new Response(new Blob([bytes]).stream().pipeThrough(stream));
  return new Uint8Array(await response.arrayBuffer());
}

function decodeName(view, offset, length) {
  return new TextDecoder().decode(new Uint8Array(view.buffer, offset, length));
}

const CRC_TABLE = buildCrcTable();

function buildCrcTable() {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[index] = value >>> 0;
  }
  return table;
}

function computeCrc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
