(function (namespace) {
    'use strict';

    /**
     * Draws the sheet and its items onto any 2D context. The same renderer is
     * used by the on screen preview and by the exported files, so what you
     * see is what gets printed.
     */
    class PageRenderer {
        render(context, projectState, pixelsPerMm) {
            this.drawPaper(context, projectState.pageSettings, pixelsPerMm);
            projectState.items.forEach((item) => this.drawItem(context, item, pixelsPerMm));
        }

        drawPaper(context, pageSettings, pixelsPerMm) {
            context.fillStyle = '#ffffff';
            context.fillRect(0, 0, pageSettings.widthMm * pixelsPerMm, pageSettings.heightMm * pixelsPerMm);
        }

        drawItem(context, item, pixelsPerMm) {
            context.imageSmoothingEnabled = true;
            context.imageSmoothingQuality = 'high';
            context.drawImage(
                item.asset.imageElement,
                item.xMm * pixelsPerMm,
                item.yMm * pixelsPerMm,
                item.widthMm * pixelsPerMm,
                item.heightMm * pixelsPerMm
            );
        }
    }

    namespace.PageRenderer = PageRenderer;
})(window.ImageCreator = window.ImageCreator || {});
