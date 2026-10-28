(function (namespace) {
    'use strict';

    const PageImageFactory = namespace.PageImageFactory;

    /**
     * Base class of the export formats. A concrete exporter only has to say
     * what its file extension is and how it turns the rendered page into a
     * downloadable blob.
     */
    class Exporter {
        constructor() {
            this.pageImageFactory = new PageImageFactory();
        }

        get fileExtension() {
            throw new Error('fileExtension must be implemented by the concrete exporter.');
        }

        createBlob() {
            throw new Error('createBlob() must be implemented by the concrete exporter.');
        }

        renderPage(projectState) {
            return this.pageImageFactory.createCanvas(projectState);
        }
    }

    namespace.Exporter = Exporter;
})(window.ImageCreator = window.ImageCreator || {});
