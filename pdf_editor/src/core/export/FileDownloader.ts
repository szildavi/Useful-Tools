/**
 * Hands a generated file to the user through the browser's own download flow.
 *
 * The bytes stay in the page as a blob; nothing is uploaded anywhere.
 */
export class FileDownloader {
  download(bytes: Uint8Array, fileName: string, mimeType: string): void {
    // A fresh ArrayBuffer copy keeps the Blob independent of the caller's view.
    const blob = new Blob([bytes.slice().buffer as ArrayBuffer], { type: mimeType });
    const objectUrl = URL.createObjectURL(blob);
    try {
      this.clickHiddenLink(objectUrl, fileName);
    } finally {
      // Revoking immediately would cancel the download in some browsers.
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
    }
  }

  private clickHiddenLink(objectUrl: string, fileName: string): void {
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = fileName;
    link.style.display = 'none';
    document.body.append(link);
    link.click();
    link.remove();
  }
}

export const PDF_MIME_TYPE = 'application/pdf';
export const ZIP_MIME_TYPE = 'application/zip';
export const PLAIN_TEXT_MIME_TYPE = 'text/plain;charset=utf-8';
export const DOCX_MIME_TYPE =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
