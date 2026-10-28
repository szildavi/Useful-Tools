export function extensionOf(fileName: string): string {
  const lastDot = fileName.lastIndexOf('.');
  return lastDot < 0 ? '' : fileName.slice(lastDot + 1).toLowerCase();
}

export function fileNameWithoutExtension(fileName: string): string {
  const lastDot = fileName.lastIndexOf('.');
  return lastDot <= 0 ? fileName : fileName.slice(0, lastDot);
}

export function isPdfFileName(fileName: string): boolean {
  return extensionOf(fileName) === 'pdf';
}
