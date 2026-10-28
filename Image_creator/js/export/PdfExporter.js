(function (namespace) {
    'use strict';

    const Exporter = namespace.Exporter;
    const PdfDocument = namespace.PdfDocument;
    const PdfImageEncoder = namespace.PdfImageEncoder;
    const Units = namespace.Units;

    /**
     * Writes the page as a single page PDF whose media box matches the real
     * paper size, so printing it needs no scaling.
     */
    class PdfExporter extends Exporter {
        constructor() {
            super();
            this.imageEncoder = new PdfImageEncoder();
        }

        get fileExtension() {
            return 'pdf';
        }

        async createBlob(projectState, options) {
            const pageSettings = projectState.pageSettings;
            const document = new PdfDocument(
                Units.millimetersToPdfPoints(pageSettings.widthMm),
                Units.millimetersToPdfPoints(pageSettings.heightMm)
            );

            const canvas = this.renderPage(projectState);
            document.setImage(await this.imageEncoder.encode(canvas, options.pdfLossless, options.jpegQuality));

            return document.toBlob();
        }
    }

    namespace.PdfExporter = PdfExporter;
})(window.ImageCreator = window.ImageCreator || {});
