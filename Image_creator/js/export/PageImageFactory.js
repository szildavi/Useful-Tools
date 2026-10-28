(function (namespace) {
    'use strict';

    const PageRenderer = namespace.PageRenderer;
    const Units = namespace.Units;

    /** Renders the page into an offscreen canvas at the requested print resolution. */
    class PageImageFactory {
        constructor() {
            this.pageRenderer = new PageRenderer();
        }

        createCanvas(projectState) {
            const pageSettings = projectState.pageSettings;
            const canvas = document.createElement('canvas');
            canvas.width = pageSettings.pixelWidth;
            canvas.height = pageSettings.pixelHeight;

            const context = canvas.getContext('2d');
            this.pageRenderer.render(context, projectState, Units.pixelsPerMillimeter(pageSettings.dotsPerInch));

            return canvas;
        }
    }

    namespace.PageImageFactory = PageImageFactory;
})(window.ImageCreator = window.ImageCreator || {});
