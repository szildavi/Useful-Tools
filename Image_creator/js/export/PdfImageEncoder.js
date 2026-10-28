(function (namespace) {
    'use strict';

    const CanvasUtils = namespace.CanvasUtils;

    /**
     * Prepares a rendered page canvas for embedding into a PDF, either as a
     * compact JPEG stream or as a lossless deflate compressed RGB stream.
     */
    class PdfImageEncoder {
        async encode(canvas, useLossless, jpegQuality) {
            if (useLossless && this.isLosslessSupported()) {
                return this.encodeLossless(canvas);
            }
            return this.encodeJpeg(canvas, jpegQuality);
        }

        isLosslessSupported() {
            return typeof CompressionStream === 'function';
        }

        async encodeJpeg(canvas, jpegQuality) {
            return {
                bytes: await CanvasUtils.toBytes(canvas, 'image/jpeg', jpegQuality),
                pixelWidth: canvas.width,
                pixelHeight: canvas.height,
                filterName: 'DCTDecode'
            };
        }

        async encodeLossless(canvas) {
            const imageData = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
            const rgbBytes = this.dropAlphaChannel(imageData.data);

            return {
                bytes: await this.deflate(rgbBytes),
                pixelWidth: canvas.width,
                pixelHeight: canvas.height,
                filterName: 'FlateDecode'
            };
        }

        dropAlphaChannel(rgbaBytes) {
            const pixelCount = rgbaBytes.length / 4;
            const rgbBytes = new Uint8Array(pixelCount * 3);

            for (let pixelIndex = 0; pixelIndex < pixelCount; pixelIndex += 1) {
                rgbBytes[pixelIndex * 3] = rgbaBytes[pixelIndex * 4];
                rgbBytes[pixelIndex * 3 + 1] = rgbaBytes[pixelIndex * 4 + 1];
                rgbBytes[pixelIndex * 3 + 2] = rgbaBytes[pixelIndex * 4 + 2];
            }

            return rgbBytes;
        }

        async deflate(bytes) {
            const compressedStream = new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate'));
            const compressedBuffer = await new Response(compressedStream).arrayBuffer();
            return new Uint8Array(compressedBuffer);
        }
    }

    namespace.PdfImageEncoder = PdfImageEncoder;
})(window.ImageCreator = window.ImageCreator || {});
