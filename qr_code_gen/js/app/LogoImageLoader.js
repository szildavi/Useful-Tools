/**
 * Reads a picked logo file and prepares it for drawing into a QR code.
 */
class LogoImageLoader {
  static ACCEPTED_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml'];

  static async load(file) {
    if (!this.ACCEPTED_MIME_TYPES.includes(file.type)) {
      throw new Error('Please choose a PNG, JPG, WebP, GIF or SVG image.');
    }
    const dataUrl = await this.readAsDataUrl(file);
    const image = await this.loadImage(dataUrl);
    return { dataUrl, image, fileName: file.name };
  }

  static readAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('The logo file could not be read.'));
      reader.readAsDataURL(file);
    });
  }

  static loadImage(dataUrl) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('The logo file is not a valid image.'));
      image.src = dataUrl;
    });
  }
}
