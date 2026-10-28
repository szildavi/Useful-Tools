import type JSZip from 'jszip';

/**
 * Reads the XML parts out of an Office or OpenDocument file.
 *
 * Both `docx`/`xlsx`/`pptx` and `odt`/`ods`/`odp` are zip archives of XML, so one
 * reader serves every one of those formats and each format-specific reader only
 * has to know which parts to look at and which elements matter.
 */
export class ZippedXmlDocument {
  private readonly archive: JSZip;

  private constructor(archive: JSZip) {
    this.archive = archive;
  }

  static async open(file: File): Promise<ZippedXmlDocument> {
    // The zip reader is fetched only when an Office file is opened, keeping it
    // out of the app's initial download.
    const { default: JSZipModule } = await import('jszip');
    try {
      return new ZippedXmlDocument(await JSZipModule.loadAsync(await file.arrayBuffer()));
    } catch {
      throw new Error(`"${file.name}" is not a readable Office or OpenDocument file.`);
    }
  }

  hasPart(path: string): boolean {
    return this.archive.file(path) !== null;
  }

  /** Parses one part as XML, or returns null when the part is absent. */
  async parsePart(path: string): Promise<Document | null> {
    const part = this.archive.file(path);
    if (!part) {
      return null;
    }
    const xml = await part.async('string');
    const parsed = new DOMParser().parseFromString(xml, 'application/xml');
    return parsed.querySelector('parsererror') ? null : parsed;
  }

  /** Part paths matching a pattern, in the order the archive lists them. */
  partPathsMatching(pattern: RegExp): string[] {
    return Object.keys(this.archive.files).filter((path) => pattern.test(path));
  }
}

/**
 * Reads elements by local name, ignoring namespace prefixes.
 *
 * Office formats use prefixes such as `w:`, `a:` and `text:` that vary between
 * producers, so matching on the local name is more robust than matching the
 * qualified name.
 */
export function elementsByLocalName(scope: Document | Element, localName: string): Element[] {
  return [...scope.getElementsByTagName('*')].filter(
    (element) => localNameOf(element) === localName,
  );
}

/** Direct children with the given local name. */
export function childrenByLocalName(parent: Element, localName: string): Element[] {
  return [...parent.children].filter((child) => localNameOf(child) === localName);
}

export function localNameOf(element: Element): string {
  return element.localName ?? element.nodeName.replace(/^.*:/, '');
}

/** An attribute looked up by local name, whatever prefix it carries. */
export function attributeByLocalName(element: Element, localName: string): string | null {
  for (const attribute of element.attributes) {
    if (attribute.name === localName || attribute.name.endsWith(`:${localName}`)) {
      return attribute.value;
    }
  }
  return null;
}

/** Numeric suffix of a part path, used to order slides and sheets naturally. */
export function numberInPath(path: string): number {
  const match = path.match(/(\d+)(?=\.[a-z]+$)/i);
  return match ? Number(match[1]) : 0;
}
