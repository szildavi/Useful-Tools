/**
 * Encoders for the image formats a canvas cannot write on its own.
 *
 * `canvas.convertToBlob` covers PNG, JPEG and WebP. BMP, ICO and single-image
 * PDF are assembled here from the raw pixels instead, which keeps the website
 * free of any third-party library.
 */

import { BinaryWriter } from './binary-writer.js';

const BMP_FILE_HEADER_SIZE = 14;
const BMP_INFO_HEADER_SIZE = 40;
const ICO_MAXIMUM_EDGE = 256;

/** Encode raw RGBA pixels as an uncompressed 24-bit BMP. */
export function encodeBmp(imageData) {
  const { width, height, data } = imageData;
  const rowPadding = (4 - ((width * 3) % 4)) % 4;
  const pixelBytes = (width * 3 + rowPadding) * height;
  const writer = new BinaryWriter();
  writeBmpFileHeader(writer, pixelBytes);
  writeBmpInfoHeader(writer, width, height, pixelBytes);
  writeBmpPixelsBottomUp(writer, data, width, height, rowPadding);
  return new Blob([writer.toUint8Array()], { type: 'image/bmp' });
}

/**
 * Wrap already-encoded PNG images in an ICO container.
 *
 * Every entry must be at most 256 pixels on each edge, which is the limit the
 * ICO directory format can describe.
 */
export function encodeIco(pngEntries) {
  const writer = new BinaryWriter();
  writer.writeUint16(0).writeUint16(1).writeUint16(pngEntries.length);
  let imageOffset = 6 + pngEntries.length * 16;
  for (const entry of pngEntries) {
    writeIcoDirectoryEntry(writer, entry, imageOffset);
    imageOffset += entry.bytes.length;
  }
  for (const entry of pngEntries) {
    writer.writeBytes(entry.bytes);
  }
  return new Blob([writer.toUint8Array()], { type: 'image/x-icon' });
}

/** Wrap one already-encoded JPEG in a single-page PDF sized to the image. */
export function encodeSingleImagePdf(jpegBytes, width, height) {
  const objects = buildPdfObjects(jpegBytes, width, height);
  return assemblePdf(objects);
}

/** Report whether an edge length fits inside an ICO directory entry. */
export function fitsInIcoDirectory(edgeLength) {
  return edgeLength <= ICO_MAXIMUM_EDGE;
}

function writeBmpFileHeader(writer, pixelBytes) {
  writer
    .writeAscii('BM')
    .writeUint32(BMP_FILE_HEADER_SIZE + BMP_INFO_HEADER_SIZE + pixelBytes)
    .writeUint32(0)
    .writeUint32(BMP_FILE_HEADER_SIZE + BMP_INFO_HEADER_SIZE);
}

function writeBmpInfoHeader(writer, width, height, pixelBytes) {
  writer
    .writeUint32(BMP_INFO_HEADER_SIZE)
    .writeInt32(width)
    .writeInt32(height)
    .writeUint16(1)
    .writeUint16(24)
    .writeUint32(0)
    .writeUint32(pixelBytes)
    .writeInt32(2835)
    .writeInt32(2835)
    .writeUint32(0)
    .writeUint32(0);
}

/** BMP stores its rows from the bottom up, in blue-green-red order. */
function writeBmpPixelsBottomUp(writer, rgba, width, height, rowPadding) {
  for (let y = height - 1; y >= 0; y -= 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4;
      writer
        .writeUint8(rgba[offset + 2])
        .writeUint8(rgba[offset + 1])
        .writeUint8(rgba[offset]);
    }
    for (let padding = 0; padding < rowPadding; padding += 1) {
      writer.writeUint8(0);
    }
  }
}

function writeIcoDirectoryEntry(writer, entry, imageOffset) {
  writer
    .writeUint8(entry.edge >= ICO_MAXIMUM_EDGE ? 0 : entry.edge)
    .writeUint8(entry.edge >= ICO_MAXIMUM_EDGE ? 0 : entry.edge)
    .writeUint8(0)
    .writeUint8(0)
    .writeUint16(1)
    .writeUint16(32)
    .writeUint32(entry.bytes.length)
    .writeUint32(imageOffset);
}

/** Build the five PDF objects that make up a one-image document. */
function buildPdfObjects(jpegBytes, width, height) {
  return [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] ` +
      `/Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`,
    {
      dictionary:
        `<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} ` +
        `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode ` +
        `/Length ${jpegBytes.length} >>`,
      stream: jpegBytes,
    },
    buildPdfContentStream(width, height),
  ];
}

function buildPdfContentStream(width, height) {
  const drawing = `q ${width} 0 0 ${height} 0 0 cm /Im0 Do Q`;
  return {
    dictionary: `<< /Length ${drawing.length} >>`,
    stream: new TextEncoder().encode(drawing),
  };
}

/** Serialise the objects with the cross-reference table PDF readers expect. */
function assemblePdf(objects) {
  const writer = new BinaryWriter();
  const objectOffsets = [];
  writer.writeAscii('%PDF-1.4\n');
  objects.forEach((object, index) => {
    objectOffsets.push(writer.length);
    writePdfObject(writer, index + 1, object);
  });
  const crossReferenceOffset = writer.length;
  writePdfCrossReferenceTable(writer, objectOffsets);
  writePdfTrailer(writer, objects.length, crossReferenceOffset);
  return new Blob([writer.toUint8Array()], { type: 'application/pdf' });
}

function writePdfObject(writer, objectNumber, object) {
  const isStream = typeof object === 'object';
  writer.writeAscii(`${objectNumber} 0 obj\n`);
  writer.writeAscii(`${isStream ? object.dictionary : object}\n`);
  if (isStream) {
    writer.writeAscii('stream\n').writeBytes(object.stream).writeAscii('\nendstream\n');
  }
  writer.writeAscii('endobj\n');
}

function writePdfCrossReferenceTable(writer, objectOffsets) {
  writer.writeAscii(`xref\n0 ${objectOffsets.length + 1}\n`);
  writer.writeAscii('0000000000 65535 f \n');
  for (const offset of objectOffsets) {
    writer.writeAscii(`${String(offset).padStart(10, '0')} 00000 n \n`);
  }
}

function writePdfTrailer(writer, objectCount, crossReferenceOffset) {
  writer.writeAscii(`trailer\n<< /Size ${objectCount + 1} /Root 1 0 R >>\n`);
  writer.writeAscii(`startxref\n${crossReferenceOffset}\n%%EOF\n`);
}
