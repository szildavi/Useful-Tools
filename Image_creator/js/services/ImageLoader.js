(function (namespace) {
    'use strict';

    const Ids = namespace.Ids;
    const ImageAsset = namespace.ImageAsset;

    const SUPPORTED_TYPE_PATTERN = /^image\//;

    /** Turns the files picked by the user into ready to draw image assets. */
    class ImageLoader {
        async loadFiles(fileList) {
            const imageFiles = Array.from(fileList).filter((file) => SUPPORTED_TYPE_PATTERN.test(file.type));
            const assets = await Promise.all(imageFiles.map((file) => this.loadFile(file)));
            return assets.filter((asset) => asset !== null);
        }

        loadFile(file) {
            return new Promise((resolve) => {
                const objectUrl = URL.createObjectURL(file);
                const imageElement = new Image();

                imageElement.onload = () => {
                    resolve(new ImageAsset(Ids.next('asset'), file.name, imageElement, objectUrl));
                };
                imageElement.onerror = () => {
                    URL.revokeObjectURL(objectUrl);
                    resolve(null);
                };

                imageElement.src = objectUrl;
            });
        }
    }

    namespace.ImageLoader = ImageLoader;
})(window.ImageCreator = window.ImageCreator || {});
