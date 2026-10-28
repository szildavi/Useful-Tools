/** Plain text, Markdown and HTML conversion. */

import { choiceOption, toggleOption } from '../core/conversion-option.js';
import { Converter } from '../core/converter.js';
import { TEXT_FORMATS, buildRoundTripPairs } from '../core/format-families.js';

export class TextConverter extends Converter {
  get displayName() {
    return 'Built-in text converter';
  }

  declareConversionPairs() {
    return buildRoundTripPairs(TEXT_FORMATS);
  }

  declareOptions(sourceFormat, targetFormat) {
    return targetFormat === 'html' ? HTML_OPTIONS : [];
  }

  async convert(request) {
    const text = new TextDecoder('utf-8').decode(request.buffer);
    const output = convertText(text, request, request.options);
    return { blob: new Blob([output], { type: MIME_TYPES[request.targetFormat] }) };
  }
}

const MIME_TYPES = { txt: 'text/plain', md: 'text/markdown', html: 'text/html' };

const HTML_OPTIONS = [
  choiceOption('pageStyle', 'Page style', [
    ['Readable page with styling', 'readable'],
    ['Bare markup only', 'bare'],
  ]),
  toggleOption('darkTheme', 'Use a dark page background', {
    helpText: 'Only affects the styled page, not the bare markup.',
  }),
];

/** Pick the conversion that matches the requested pair. */
function convertText(text, request, options) {
  const { sourceFormat, targetFormat, fileName } = request;
  if (targetFormat === 'html') {
    const body = sourceFormat === 'md' ? renderMarkdown(text) : renderPlainText(text);
    return wrapInHtmlPage(body, fileName, options);
  }
  if (sourceFormat === 'html') {
    return stripHtmlTags(text);
  }
  return text;
}

/** Render the Markdown features that map cleanly onto simple HTML. */
function renderMarkdown(markdown) {
  const blocks = markdown.split(/\n{2,}/);
  return blocks.map(renderMarkdownBlock).filter(Boolean).join('\n');
}

function renderMarkdownBlock(block) {
  const trimmed = block.trim();
  if (trimmed === '') {
    return '';
  }
  const heading = trimmed.match(/^(#{1,6})\s+(.*)$/);
  if (heading) {
    const level = heading[1].length;
    return `<h${level}>${renderInlineMarkdown(heading[2])}</h${level}>`;
  }
  if (/^```/.test(trimmed)) {
    return `<pre><code>${escapeHtml(trimmed.replace(/^```\w*\n?|```$/g, ''))}</code></pre>`;
  }
  if (/^[-*+]\s+/m.test(trimmed)) {
    return renderMarkdownList(trimmed);
  }
  return `<p>${renderInlineMarkdown(trimmed).replaceAll('\n', '<br>')}</p>`;
}

function renderMarkdownList(block) {
  const items = block
    .split('\n')
    .filter((line) => /^\s*[-*+]\s+/.test(line))
    .map((line) => `  <li>${renderInlineMarkdown(line.replace(/^\s*[-*+]\s+/, ''))}</li>`);
  return `<ul>\n${items.join('\n')}\n</ul>`;
}

/** Apply the inline Markdown marks: links, bold, italic and code. */
function renderInlineMarkdown(text) {
  return escapeHtml(text)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>');
}

function renderPlainText(text) {
  return text
    .split(/\n{2,}/)
    .filter((paragraph) => paragraph.trim() !== '')
    .map((paragraph) => `<p>${escapeHtml(paragraph.trim()).replaceAll('\n', '<br>')}</p>`)
    .join('\n');
}

/** Turn markup back into readable plain text. */
function stripHtmlTags(html) {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h[1-6]|li|tr)>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function wrapInHtmlPage(body, fileName, options) {
  if (options.pageStyle === 'bare') {
    return `${body}\n`;
  }
  const colours = options.darkTheme
    ? 'background:#1e2128;color:#e6e8ee;'
    : 'background:#ffffff;color:#1a1a1a;';
  return [
    '<!doctype html>',
    '<html lang="en">',
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${escapeHtml(fileName)}</title>`,
    '<style>',
    `body{${colours}font:16px/1.65 system-ui,sans-serif;max-width:44rem;margin:3rem auto;padding:0 1.5rem}`,
    'pre{overflow-x:auto;padding:1rem;border-radius:.5rem;background:rgba(127,127,127,.15)}',
    'code{font-family:ui-monospace,monospace;font-size:.92em}',
    'a{color:#4c8dff}',
    '</style>',
    '</head>',
    '<body>',
    body,
    '</body>',
    '</html>',
    '',
  ].join('\n');
}

function escapeHtml(text) {
  return String(text)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}
