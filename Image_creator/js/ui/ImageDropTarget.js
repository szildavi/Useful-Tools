(function (namespace) {
    'use strict';

    const Dom = namespace.Dom;

    /** Lets the user drop image files anywhere over the preview area. */
    class ImageDropTarget {
        constructor(onFilesDropped) {
            this.onFilesDropped = onFilesDropped;
            this.dropAreaElement = Dom.byId('canvas-viewport');
            this.overlayElement = Dom.byId('drop-overlay');

            this.listenToDragEvents();
        }

        listenToDragEvents() {
            this.dropAreaElement.addEventListener('dragover', (event) => this.handleDragOver(event));
            this.dropAreaElement.addEventListener('dragleave', () => this.showOverlay(false));
            this.dropAreaElement.addEventListener('drop', (event) => this.handleDrop(event));
        }

        handleDragOver(event) {
            event.preventDefault();
            this.showOverlay(true);
        }

        handleDrop(event) {
            event.preventDefault();
            this.showOverlay(false);
            this.onFilesDropped(event.dataTransfer.files);
        }

        showOverlay(visible) {
            Dom.setVisible(this.overlayElement, visible);
        }
    }

    namespace.ImageDropTarget = ImageDropTarget;
})(window.ImageCreator = window.ImageCreator || {});
