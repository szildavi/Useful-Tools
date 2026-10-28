(function (namespace) {
    'use strict';

    /** Hands a generated blob over to the browser as a downloadable file. */
    class FileDownloader {
        download(blob, fileName) {
            const objectUrl = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = objectUrl;
            link.download = fileName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(objectUrl);
        }
    }

    namespace.FileDownloader = FileDownloader;
})(window.ImageCreator = window.ImageCreator || {});
