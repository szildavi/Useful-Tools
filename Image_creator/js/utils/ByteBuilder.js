(function (namespace) {
    'use strict';

    /**
     * Collects text and binary chunks into one byte array while keeping track
     * of the current length, which is what a PDF cross reference table needs.
     */
    class ByteBuilder {
        constructor() {
            this.chunks = [];
            this.length = 0;
        }

        appendText(text) {
            const bytes = new Uint8Array(text.length);
            for (let index = 0; index < text.length; index += 1) {
                bytes[index] = text.charCodeAt(index) & 0xff;
            }
            this.appendBytes(bytes);
        }

        appendBytes(bytes) {
            this.chunks.push(bytes);
            this.length += bytes.length;
        }

        toUint8Array() {
            const result = new Uint8Array(this.length);
            let offset = 0;
            this.chunks.forEach((chunk) => {
                result.set(chunk, offset);
                offset += chunk.length;
            });
            return result;
        }
    }

    namespace.ByteBuilder = ByteBuilder;
})(window.ImageCreator = window.ImageCreator || {});
