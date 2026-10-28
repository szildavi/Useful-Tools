import type { EditorDocument } from '../editor/EditorDocument';
import {
  TextBoxAnnotation,
  TextReplacementAnnotation,
  type Annotation,
} from '../editor/annotations/Annotation';
import type { EditorPage } from '../editor/EditorPage';
import { PdfTextExtractor } from '../pdf/PdfTextExtractor';

export interface PageTextContent {
  readonly pageNumber: number;
  readonly paragraphs: readonly string[];
}

/**
 * Reads the text of an edited document, page by page, for exporting to a text or
 * Word file.
 *
 * The user's edits are honoured: text they replaced is reported with its new
 * wording, and text they added is included. Without this, exporting to Word
 * would silently produce the *original* text and lose every edit.
 */
export class PdfTextReader {
  private readonly extractor = new PdfTextExtractor();

  async readDocument(document: EditorDocument): Promise<PageTextContent[]> {
    const pages: PageTextContent[] = [];
    for (const [index, page] of document.pages.entries()) {
      pages.push({
        pageNumber: index + 1,
        paragraphs: await this.readPage(document, page),
      });
    }
    return pages;
  }

  private async readPage(
    document: EditorDocument,
    page: EditorPage,
  ): Promise<readonly string[]> {
    const source = document.sourceOf(page);
    const originalText = await this.extractor.extractPlainText(
      source.renderer,
      page.pageNumberInSource(),
    );
    return [
      ...toParagraphs(applyReplacements(originalText, page.annotations)),
      ...addedTextOf(page.annotations),
    ];
  }
}

/**
 * Replacements are applied to the extracted text so the exported document says
 * what the user made it say. Matching is done on the original wording, which is
 * what the replacement recorded when it was created.
 */
function applyReplacements(text: string, annotations: readonly Annotation[]): string {
  return annotations
    .filter(isReplacement)
    .filter((replacement) => !replacement.isUnchanged())
    .reduce(
      (updated, replacement) =>
        updated.split(replacement.originalText).join(replacement.text),
      text,
    );
}

function addedTextOf(annotations: readonly Annotation[]): string[] {
  return annotations
    .filter((annotation): annotation is TextBoxAnnotation => annotation instanceof TextBoxAnnotation)
    .map((annotation) => annotation.text.trim())
    .filter((text) => text.length > 0);
}

function isReplacement(annotation: Annotation): annotation is TextReplacementAnnotation {
  return annotation instanceof TextReplacementAnnotation;
}

function toParagraphs(text: string): string[] {
  return text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}
