(function (namespace) {
    'use strict';

    /**
     * One image the user loaded, together with how many printed copies of it
     * the sheet should contain.
     */
    class ImageAsset {
        constructor(id, fileName, imageElement, objectUrl) {
            this.id = id;
            this.fileName = fileName;
            this.imageElement = imageElement;
            this.objectUrl = objectUrl;
            this.copies = 1;
        }

        get naturalWidth() {
            return this.imageElement.naturalWidth;
        }

        get naturalHeight() {
            return this.imageElement.naturalHeight;
        }

        get aspectRatio() {
            return this.naturalWidth / this.naturalHeight;
        }

        setCopies(copies) {
            this.copies = Math.min(500, Math.max(0, Math.round(copies)));
        }

        releaseResources() {
            URL.revokeObjectURL(this.objectUrl);
        }
    }

    namespace.ImageAsset = ImageAsset;
})(window.ImageCreator = window.ImageCreator || {});
