/**
 * Hands a generated file to the browser's download mechanism.
 */
class FileDownloader {
  static REVOKE_DELAY_MS = 1000;

  static download(blob, fileName) {
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = fileName;
    link.style.display = 'none';

    document.body.appendChild(link);
    link.click();
    link.remove();

    setTimeout(() => URL.revokeObjectURL(objectUrl), this.REVOKE_DELAY_MS);
  }
}
