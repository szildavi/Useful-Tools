(function (namespace) {
    'use strict';

    const Exporter = namespace.Exporter;
    const CanvasUtils = namespace.CanvasUtils;

    /** Writes the page as a JPEG image using the requested quality. */
    class JpgExporter extends Exporter {
        get fileExtension() {
            return 'jpg';
        }

        createBlob(projectState, options) {
            return CanvasUtils.toBlob(this.renderPage(projectState), 'image/jpeg', options.jpegQuality);
        }
    }

    namespace.JpgExporter = JpgExporter;
})(window.ImageCreator = window.ImageCreator || {});
