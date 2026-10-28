/**
 * Tabular and structured data conversion, written from scratch.
 *
 * Every format is first read into the same intermediate shape - an array of row
 * objects - so adding a format means writing one reader and one writer rather
 * than touching every pair.
 */

import { choiceOption } from '../core/conversion-option.js';
import { Converter } from '../core/converter.js';
import { STRUCTURED_DATA_FORMATS, buildRoundTripPairs } from '../core/format-families.js';

const XML_ROOT_ELEMENT = 'records';
const XML_ROW_ELEMENT = 'record';

export class DataConverter extends Converter {
  get displayName() {
    return 'Built-in data converter';
  }

  declareConversionPairs() {
    return buildRoundTripPairs(STRUCTURED_DATA_FORMATS);
  }

  declareOptions(sourceFormat, targetFormat) {
    const options = [];
    if (['csv', 'tsv'].includes(sourceFormat)) {
      options.push(INPUT_DELIMITER_OPTION);
    }
    if (['csv', 'tsv'].includes(targetFormat)) {
      options.push(OUTPUT_DELIMITER_OPTION);
    }
    if (targetFormat === 'json') {
      options.push(JSON_LAYOUT_OPTION);
    }
    return options;
  }

  async convert(request) {
    const text = new TextDecoder('utf-8').decode(request.buffer);
    const rows = READERS[request.sourceFormat](text, request.options);
    const output = WRITERS[request.targetFormat](rows, request.options);
    return { blob: new Blob([output], { type: MIME_TYPES[request.targetFormat] }) };
  }
}

const INPUT_DELIMITER_OPTION = choiceOption('inputDelimiter', 'Column separator in the source', [
  ['Detect automatically', 'auto'],
  ['Comma  ,', ','],
  ['Semicolon  ;', ';'],
  ['Tab', '\t'],
  ['Pipe  |', '|'],
]);

const OUTPUT_DELIMITER_OPTION = choiceOption('outputDelimiter', 'Column separator to write', [
  ['Match the format', 'auto'],
  ['Comma  ,', ','],
  ['Semicolon  ;', ';'],
  ['Tab', '\t'],
  ['Pipe  |', '|'],
]);

const JSON_LAYOUT_OPTION = choiceOption('jsonIndent', 'JSON layout', [
  ['Indented, 2 spaces', '2'],
  ['Indented, 4 spaces', '4'],
  ['Compact, single line', '0'],
]);

const MIME_TYPES = {
  csv: 'text/csv',
  tsv: 'text/tab-separated-values',
  json: 'application/json',
  xml: 'application/xml',
  yaml: 'text/yaml',
};

// ------------------------------------------------------------------- readers

/** Read separated text using the chosen or detected column separator. */
function readDelimited(text, options, fallbackDelimiter) {
  const delimiter = resolveInputDelimiter(text, options, fallbackDelimiter);
  const rows = parseDelimitedRows(text, delimiter);
  if (rows.length === 0) {
    return [];
  }
  const [headers, ...bodyRows] = rows;
  return bodyRows.map((cells) =>
    Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ''])),
  );
}

function resolveInputDelimiter(text, options, fallbackDelimiter) {
  const chosen = options.inputDelimiter ?? 'auto';
  if (chosen !== 'auto') {
    return chosen;
  }
  const firstLine = text.split(/\r?\n/, 1)[0] ?? '';
  const candidates = [',', ';', '\t', '|'];
  return candidates.reduce(
    (best, candidate) =>
      countOutsideQuotes(firstLine, candidate) > countOutsideQuotes(firstLine, best)
        ? candidate
        : best,
    fallbackDelimiter,
  );
}

function countOutsideQuotes(line, delimiter) {
  return parseDelimitedRows(line, delimiter)[0]?.length - 1 || 0;
}

/** Parse separated text, honouring quoted fields and embedded newlines. */
function parseDelimitedRows(text, delimiter) {
  const rows = [];
  let cells = [];
  let cell = '';
  let insideQuotes = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (insideQuotes) {
      if (character === '"' && text[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else if (character === '"') {
        insideQuotes = false;
      } else {
        cell += character;
      }
    } else if (character === '"') {
      insideQuotes = true;
    } else if (character === delimiter) {
      cells.push(cell);
      cell = '';
    } else if (character === '\n') {
      cells.push(cell);
      rows.push(cells);
      cells = [];
      cell = '';
    } else if (character !== '\r') {
      cell += character;
    }
  }
  if (cell !== '' || cells.length > 0) {
    cells.push(cell);
    rows.push(cells);
  }
  return rows.filter((row) => row.some((value) => value !== ''));
}

function readJson(text) {
  return asRowList(JSON.parse(text));
}

/**
 * Read record-shaped XML without a DOM.
 *
 * `DOMParser` only exists on the page, never inside a worker, so the records
 * are picked out directly. Each second-level element becomes one row and its
 * children become that row's columns, which is the shape this converter writes.
 */
function readXml(text) {
  const body = stripXmlProlog(text);
  const rootMatch = body.match(/<([\w.:-]+)[^>]*>([\s\S]*)<\/\1\s*>/);
  if (!rootMatch) {
    throw new Error('The XML file has no root element.');
  }
  const rows = [...rootMatch[2].matchAll(/<([\w.:-]+)([^>]*?)(?:\/>|>([\s\S]*?)<\/\1\s*>)/g)].map(
    (match) => xmlRecordToRow(match[2], match[3] ?? ''),
  );
  if (rows.length === 0) {
    throw new Error('No records were found inside the XML root element.');
  }
  return rows;
}

function stripXmlProlog(text) {
  return text.replace(/<\?[\s\S]*?\?>/g, '').replace(/<!--[\s\S]*?-->/g, '');
}

/** Turn one record's attributes and child elements into a flat row. */
function xmlRecordToRow(attributeText, innerText) {
  const row = {};
  for (const attribute of attributeText.matchAll(/([\w.:-]+)\s*=\s*"([^"]*)"/g)) {
    row[attribute[1]] = unescapeXml(attribute[2]);
  }
  for (const child of innerText.matchAll(/<([\w.:-]+)[^>]*?(?:\/>|>([\s\S]*?)<\/\1\s*>)/g)) {
    row[child[1]] = unescapeXml(child[2] ?? '');
  }
  if (Object.keys(row).length === 0) {
    row.value = unescapeXml(innerText.trim());
  }
  return row;
}

/**
 * Read the flat YAML this converter writes: a list of records whose values are
 * plain scalars. Nested documents are beyond what a spreadsheet row can hold.
 */
function readYaml(text) {
  const rows = [];
  let current = null;
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/\s+$/, '');
    if (line === '' || line.startsWith('#')) {
      continue;
    }
    const listItem = line.match(/^-\s*(.*)$/);
    if (listItem) {
      current = {};
      rows.push(current);
      addYamlEntry(current, listItem[1]);
    } else if (current) {
      addYamlEntry(current, line.trim());
    }
  }
  if (rows.length === 0) {
    throw new Error('No records were found. This reader expects a YAML list of records.');
  }
  return rows;
}

function addYamlEntry(row, entryText) {
  const separator = entryText.indexOf(':');
  if (separator === -1) {
    return;
  }
  const key = entryText.slice(0, separator).trim();
  const value = entryText.slice(separator + 1).trim();
  row[key] = stripYamlQuotes(value);
}

function stripYamlQuotes(value) {
  const quoted = value.match(/^(['"])(.*)\1$/);
  return quoted ? quoted[2] : value;
}

// ------------------------------------------------------------------- writers

function writeDelimited(rows, options, fallbackDelimiter) {
  const chosen = options.outputDelimiter ?? 'auto';
  const delimiter = chosen === 'auto' ? fallbackDelimiter : chosen;
  const headers = collectColumnNames(rows);
  const lines = [headers.map((header) => quoteCell(header, delimiter)).join(delimiter)];
  for (const row of rows) {
    lines.push(headers.map((header) => quoteCell(row[header], delimiter)).join(delimiter));
  }
  return `${lines.join('\n')}\n`;
}

function quoteCell(value, delimiter) {
  const text = value === undefined || value === null ? '' : String(value);
  const needsQuoting = text.includes(delimiter) || /["\n\r]/.test(text);
  return needsQuoting ? `"${text.replaceAll('"', '""')}"` : text;
}

function writeJson(rows, options) {
  const indent = Number(options.jsonIndent ?? '2');
  return JSON.stringify(rows, null, indent || undefined);
}

function writeXml(rows) {
  const lines = ['<?xml version="1.0" encoding="UTF-8"?>', `<${XML_ROOT_ELEMENT}>`];
  for (const row of rows) {
    lines.push(`  <${XML_ROW_ELEMENT}>`);
    for (const [name, value] of Object.entries(row)) {
      lines.push(`    <${safeXmlTag(name)}>${escapeXml(value)}</${safeXmlTag(name)}>`);
    }
    lines.push(`  </${XML_ROW_ELEMENT}>`);
  }
  lines.push(`</${XML_ROOT_ELEMENT}>`);
  return `${lines.join('\n')}\n`;
}

function writeYaml(rows) {
  const lines = [];
  for (const row of rows) {
    const entries = Object.entries(row);
    entries.forEach(([name, value], index) => {
      lines.push(`${index === 0 ? '- ' : '  '}${name}: ${quoteYamlValue(value)}`);
    });
  }
  return `${lines.join('\n')}\n`;
}

function quoteYamlValue(value) {
  const text = value === undefined || value === null ? '' : String(value);
  return /^[\w .@/+-]*$/.test(text) && text.trim() === text && text !== ''
    ? text
    : `"${text.replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`;
}

// ------------------------------------------------------------------- helpers

const READERS = {
  csv: (text, options) => readDelimited(text, options, ','),
  tsv: (text, options) => readDelimited(text, options, '\t'),
  json: readJson,
  xml: readXml,
  yaml: readYaml,
};

const WRITERS = {
  csv: (rows, options) => writeDelimited(rows, options, ','),
  tsv: (rows, options) => writeDelimited(rows, options, '\t'),
  json: writeJson,
  xml: writeXml,
  yaml: writeYaml,
};

/** Normalise parsed data into an array of row objects. */
function asRowList(parsed) {
  if (Array.isArray(parsed)) {
    return parsed.map((item) => (isPlainObject(item) ? item : { value: item }));
  }
  return isPlainObject(parsed) ? [parsed] : [{ value: parsed }];
}

function isPlainObject(candidate) {
  return typeof candidate === 'object' && candidate !== null && !Array.isArray(candidate);
}

/** Return every key seen across the rows, keeping first-seen order. */
function collectColumnNames(rows) {
  const names = [];
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (!names.includes(key)) {
        names.push(key);
      }
    }
  }
  return names.length > 0 ? names : ['value'];
}

function safeXmlTag(name) {
  const cleaned = String(name).replace(/[^A-Za-z0-9_.-]/g, '_').replace(/^_+|_+$/g, '');
  return cleaned && !/^\d/.test(cleaned) ? cleaned : `field_${cleaned}`;
}

function escapeXml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function unescapeXml(value) {
  return String(value)
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&apos;', "'")
    .replaceAll('&amp;', '&');
}
