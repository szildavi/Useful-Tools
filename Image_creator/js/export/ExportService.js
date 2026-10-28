(function (namespace) {
    'use strict';

    const PngExporter = namespace.PngExporter;
    const JpgExporter = namespace.JpgExporter;
    const PdfExporter = namespace.PdfExporter;
    const FileDownloader = namespace.FileDownloader;

    /** Picks the exporter of the chosen format and delivers the finished file. */
    class ExportService {
        constructor() {
            this.exportersByFormat = {
                png: new PngExporter(),
                jpg: new JpgExporter(),
                pdf: new PdfExporter()
            };
            this.fileDownloader = new FileDownloader();
        }

        get supportedFormats() {
            return Object.keys(this.exportersByFormat);
        }

        async export(projectState, format, options, baseFileName) {
            const exporter = this.exportersByFormat[format];
            if (!exporter) {
                throw new Error('Unknown export format: ' + format);
            }

            const blob = await exporter.createBlob(projectState, options);
            this.fileDownloader.download(blob, baseFileName + '.' + exporter.fileExtension);
        }
    }

    namespace.ExportService = ExportService;
})(window.ImageCreator = window.ImageCreator || {});
