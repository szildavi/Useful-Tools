/**
 * Opaque identifiers for the editor model. Branding them keeps a page id from
 * being passed where a source id is expected.
 */
export type SourceId = string & { readonly __brand: 'SourceId' };
export type PageId = string & { readonly __brand: 'PageId' };
export type AnnotationId = string & { readonly __brand: 'AnnotationId' };

let counter = 0;

function nextUniqueSuffix(): string {
  counter += 1;
  return `${Date.now().toString(36)}-${counter.toString(36)}`;
}

export function createSourceId(): SourceId {
  return `source-${nextUniqueSuffix()}` as SourceId;
}

export function createPageId(): PageId {
  return `page-${nextUniqueSuffix()}` as PageId;
}

export function createAnnotationId(): AnnotationId {
  return `annotation-${nextUniqueSuffix()}` as AnnotationId;
}
