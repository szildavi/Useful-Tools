(function (namespace) {
    'use strict';

    /** Promise based helpers around the callback style canvas API. */
    const CanvasUtils = {
        toBlob(canvas, mimeType, quality) {
            return new Promise((resolve, reject) => {
                canvas.toBlob((blob) => {
                    if (blob) {
                        resolve(blob);
                    } else {
                        reject(new Error('The browser could not encode the canvas as ' + mimeType + '.'));
                    }
                }, mimeType, quality);
            });
        },

        async toBytes(canvas, mimeType, quality) {
            const blob = await CanvasUtils.toBlob(canvas, mimeType, quality);
            const buffer = await blob.arrayBuffer();
            return new Uint8Array(buffer);
        }
    };

    namespace.CanvasUtils = CanvasUtils;
})(window.ImageCreator = window.ImageCreator || {});
