(function (namespace) {
    'use strict';

    const ByteBuilder = namespace.ByteBuilder;

    const OBJECT_COUNT = 5;

    /**
     * A deliberately small PDF writer: one page that shows one full page
     * image. That is exactly what this application produces, and writing it
     * by hand keeps the project free of external libraries.
     */
    class PdfDocument {
        constructor(widthPoints, heightPoints) {
            this.widthPoints = widthPoints;
            this.heightPoints = heightPoints;
            this.image = null;
        }

        /**
         * @param image {{bytes: Uint8Array, pixelWidth: number, pixelHeight: number, filterName: string}}
         */
        setImage(image) {
            this.image = image;
        }

        toBlob() {
            const builder = new ByteBuilder();
            const objectOffsets = [];

            this.writeHeader(builder);
            this.writeObject(builder, objectOffsets, this.createCatalog());
            this.writeObject(builder, objectOffsets, this.createPageList());
            this.writeObject(builder, objectOffsets, this.createPage());
            this.writeStreamObject(builder, objectOffsets, this.createContentDictionary(), this.createContentBytes());
            this.writeStreamObject(builder, objectOffsets, this.createImageDictionary(), this.image.bytes);
            this.writeCrossReferenceTable(builder, objectOffsets);

            return new Blob([builder.toUint8Array()], { type: 'application/pdf' });
        }

        writeHeader(builder) {
            builder.appendText('%PDF-1.4\n');
            builder.appendBytes(new Uint8Array([0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a]));
        }

        writeObject(builder, objectOffsets, dictionary) {
            objectOffsets.push(builder.length);
            builder.appendText(objectOffsets.length + ' 0 obj\n' + dictionary + '\nendobj\n');
        }

        writeStreamObject(builder, objectOffsets, dictionaryWithoutLength, streamBytes) {
            objectOffsets.push(builder.length);
            const dictionary = dictionaryWithoutLength.replace('>>', '/Length ' + streamBytes.length + ' >>');
            builder.appendText(objectOffsets.length + ' 0 obj\n' + dictionary + '\nstream\n');
            builder.appendBytes(streamBytes);
            builder.appendText('\nendstream\nendobj\n');
        }

        writeCrossReferenceTable(builder, objectOffsets) {
            const tableOffset = builder.length;
            let table = 'xref\n0 ' + (OBJECT_COUNT + 1) + '\n0000000000 65535 f \n';

            objectOffsets.forEach((offset) => {
                table += String(offset).padStart(10, '0') + ' 00000 n \n';
            });

            builder.appendText(table);
            builder.appendText('trailer\n<< /Size ' + (OBJECT_COUNT + 1) + ' /Root 1 0 R >>\n');
            builder.appendText('startxref\n' + tableOffset + '\n%%EOF\n');
        }

        createCatalog() {
            return '<< /Type /Catalog /Pages 2 0 R >>';
        }

        createPageList() {
            return '<< /Type /Pages /Kids [3 0 R] /Count 1 >>';
        }

        createPage() {
            return '<< /Type /Page /Parent 2 0 R'
                + ' /MediaBox [0 0 ' + this.formatNumber(this.widthPoints) + ' ' + this.formatNumber(this.heightPoints) + ']'
                + ' /Resources << /XObject << /PageImage 5 0 R >> >>'
                + ' /Contents 4 0 R >>';
        }

        createContentDictionary() {
            return '<< >>';
        }

        createContentBytes() {
            const drawingCommands = 'q\n'
                + this.formatNumber(this.widthPoints) + ' 0 0 ' + this.formatNumber(this.heightPoints) + ' 0 0 cm\n'
                + '/PageImage Do\n'
                + 'Q\n';
            const builder = new ByteBuilder();
            builder.appendText(drawingCommands);
            return builder.toUint8Array();
        }

        createImageDictionary() {
            return '<< /Type /XObject /Subtype /Image'
                + ' /Width ' + this.image.pixelWidth
                + ' /Height ' + this.image.pixelHeight
                + ' /ColorSpace /DeviceRGB /BitsPerComponent 8'
                + ' /Filter /' + this.image.filterName + ' >>';
        }

        formatNumber(value) {
            return value.toFixed(2);
        }
    }

    namespace.PdfDocument = PdfDocument;
})(window.ImageCreator = window.ImageCreator || {});
