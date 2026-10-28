(function (namespace) {
    'use strict';

    const HANDLE_SIZE_PX = 10;

    /**
     * Draws the helper graphics that only exist on screen: the printable area
     * guide and the frame with the resize handles of the selected item.
     */
    class SelectionOverlayRenderer {
        static get HANDLE_SIZE_PX() {
            return HANDLE_SIZE_PX;
        }

        drawMarginGuide(context, pageSettings, pixelsPerMm) {
            const marginPx = pageSettings.marginMm * pixelsPerMm;
            if (marginPx <= 0) {
                return;
            }

            context.save();
            context.strokeStyle = 'rgba(90, 130, 255, 0.55)';
            context.setLineDash([6, 5]);
            context.lineWidth = 1;
            context.strokeRect(
                marginPx,
                marginPx,
                pageSettings.contentWidthMm * pixelsPerMm,
                pageSettings.contentHeightMm * pixelsPerMm
            );
            context.restore();
        }

        drawSelection(context, item, pixelsPerMm) {
            const frame = this.createFrame(item, pixelsPerMm);

            context.save();
            context.strokeStyle = '#2f6bff';
            context.lineWidth = 2;
            context.strokeRect(frame.x, frame.y, frame.width, frame.height);
            this.corners(frame).forEach((corner) => this.drawHandle(context, corner));
            context.restore();
        }

        drawHandle(context, corner) {
            const half = HANDLE_SIZE_PX / 2;
            context.fillStyle = '#ffffff';
            context.strokeStyle = '#2f6bff';
            context.lineWidth = 2;
            context.fillRect(corner.x - half, corner.y - half, HANDLE_SIZE_PX, HANDLE_SIZE_PX);
            context.strokeRect(corner.x - half, corner.y - half, HANDLE_SIZE_PX, HANDLE_SIZE_PX);
        }

        createFrame(item, pixelsPerMm) {
            return {
                x: item.xMm * pixelsPerMm,
                y: item.yMm * pixelsPerMm,
                width: item.widthMm * pixelsPerMm,
                height: item.heightMm * pixelsPerMm
            };
        }

        corners(frame) {
            return [
                { x: frame.x, y: frame.y },
                { x: frame.x + frame.width, y: frame.y },
                { x: frame.x, y: frame.y + frame.height },
                { x: frame.x + frame.width, y: frame.y + frame.height }
            ];
        }
    }

    namespace.SelectionOverlayRenderer = SelectionOverlayRenderer;
})(window.ImageCreator = window.ImageCreator || {});
