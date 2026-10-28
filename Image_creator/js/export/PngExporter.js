(function (namespace) {
    'use strict';

    const Exporter = namespace.Exporter;
    const CanvasUtils = namespace.CanvasUtils;

    /** Writes the page as a lossless PNG image. */
    class PngExporter extends Exporter {
        get fileExtension() {
            return 'png';
        }

        createBlob(projectState) {
            return CanvasUtils.toBlob(this.renderPage(projectState), 'image/png');
        }
    }

    namespace.PngExporter = PngExporter;
})(window.ImageCreator = window.ImageCreator || {});
