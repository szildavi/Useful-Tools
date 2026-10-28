import {
  documentContentOf,
  type ContentBlock,
  type DocumentContent,
} from '../DocumentContent';
import { DocumentReader } from '../DocumentReader';
import { fileNameWithoutExtension } from '../FileFormat';
import {
  attributeByLocalName,
  elementsByLocalName,
  numberInPath,
  ZippedXmlDocument,
} from './ZippedXmlDocument';

interface Slide {
  readonly title: string;
  readonly lines: readonly string[];
}

/**
 * Reads presentations and lays each slide out as a page of text.
 *
 * What comes across is the wording: each slide's title and its text, one PDF
 * page per slide. Slide graphics, themes, positioning and animations are not
 * reproduced - rendering a slide visually needs a presentation engine, which a
 * browser-only editor cannot provide.
 */
export class PresentationReader extends DocumentReader {
  readonly supportedExtensions = ['pptx', 'odp'] as const;
  readonly formatLabel = 'Presentation';

  async read(file: File): Promise<DocumentContent> {
    const archive = await ZippedXmlDocument.open(file);
    const slides = archive.hasPart('content.xml')
      ? await readOpenDocumentSlides(archive)
      : await readPowerPointSlides(archive);

    if (slides.length === 0) {
      throw new Error(`No readable slides were found in "${file.name}".`);
    }
    return documentContentOf(fileNameWithoutExtension(file.name), toBlocks(slides));
  }
}

function toBlocks(slides: readonly Slide[]): ContentBlock[] {
  return slides.flatMap((slide, index) => {
    const blocks: ContentBlock[] = [];
    if (index > 0) {
      blocks.push({ kind: 'page-break' });
    }
    blocks.push({ kind: 'heading', level: 1, text: slide.title || `Slide ${index + 1}` });
    if (slide.lines.length > 0) {
      blocks.push({ kind: 'list', items: slide.lines, isNumbered: false });
    }
    return blocks;
  });
}

// ------------------------------------------------------------------ PowerPoint

/**
 * A PowerPoint slide holds shapes, each with paragraphs of text runs. The first
 * shape that has text is treated as the title, which is how slide layouts are
 * ordinarily built.
 */
async function readPowerPointSlides(archive: ZippedXmlDocument): Promise<Slide[]> {
  const slidePaths = archive
    .partPathsMatching(/^ppt\/slides\/slide\d+\.xml$/)
    .sort((left, right) => numberInPath(left) - numberInPath(right));

  const slides: Slide[] = [];
  for (const path of slidePaths) {
    const slideXml = await archive.parsePart(path);
    if (!slideXml) {
      continue;
    }
    const paragraphs = elementsByLocalName(slideXml, 'p')
      .map(powerPointParagraphText)
      .filter((text) => text.length > 0);
    slides.push(splitTitleFromBody(paragraphs));
  }
  return slides;
}

/** `a:p` is a paragraph; `a:t` holds the actual characters of each run. */
function powerPointParagraphText(paragraph: Element): string {
  return elementsByLocalName(paragraph, 't')
    .map((run) => run.textContent ?? '')
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
}

// ---------------------------------------------------------------- OpenDocument

async function readOpenDocumentSlides(archive: ZippedXmlDocument): Promise<Slide[]> {
  const content = await archive.parsePart('content.xml');
  if (!content) {
    return [];
  }
  return elementsByLocalName(content, 'page').map((page, index) => {
    const paragraphs = [
      ...elementsByLocalName(page, 'p'),
      ...elementsByLocalName(page, 'h'),
    ]
      .map((element) => (element.textContent ?? '').replace(/\s+/g, ' ').trim())
      .filter((text) => text.length > 0);

    const slide = splitTitleFromBody(paragraphs);
    return slide.title
      ? slide
      : { title: attributeByLocalName(page, 'name') ?? `Slide ${index + 1}`, lines: slide.lines };
  });
}

// ---------------------------------------------------------------------- shared

function splitTitleFromBody(paragraphs: readonly string[]): Slide {
  const [title = '', ...lines] = paragraphs;
  return { title, lines };
}
