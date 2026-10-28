(function (namespace) {
    'use strict';

    const EPSILON = 1e-6;

    /**
     * Places rectangles into a fixed area by filling one horizontal row
     * (shelf) after the other. Rows keep the printed sheet visually aligned,
     * which matters when the result is going to be cut apart.
     *
     * The rectangles are packed in the order they are given, sorting them is
     * the responsibility of the caller.
     */
    class ShelfPacker {
        constructor(areaWidthMm, areaHeightMm, gapMm) {
            this.areaWidthMm = areaWidthMm;
            this.areaHeightMm = areaHeightMm;
            this.gapMm = gapMm;
        }

        pack(rectangles) {
            const placements = [];
            let shelfTopMm = 0;
            let shelfHeightMm = 0;
            let cursorXMm = 0;

            for (const rectangle of rectangles) {
                if (!this.fitsInArea(rectangle)) {
                    return this.failure();
                }
                if (this.needsNewShelf(cursorXMm, rectangle)) {
                    shelfTopMm += shelfHeightMm + this.gapMm;
                    shelfHeightMm = 0;
                    cursorXMm = 0;
                }
                if (shelfTopMm + rectangle.heightMm > this.areaHeightMm + EPSILON) {
                    return this.failure();
                }

                placements.push({
                    sourceId: rectangle.sourceId,
                    xMm: cursorXMm,
                    yMm: shelfTopMm,
                    widthMm: rectangle.widthMm,
                    heightMm: rectangle.heightMm
                });

                cursorXMm += rectangle.widthMm + this.gapMm;
                shelfHeightMm = Math.max(shelfHeightMm, rectangle.heightMm);
            }

            return { success: true, placements };
        }

        fitsInArea(rectangle) {
            return rectangle.widthMm <= this.areaWidthMm + EPSILON
                && rectangle.heightMm <= this.areaHeightMm + EPSILON;
        }

        needsNewShelf(cursorXMm, rectangle) {
            return cursorXMm > 0 && cursorXMm + rectangle.widthMm > this.areaWidthMm + EPSILON;
        }

        failure() {
            return { success: false, placements: [] };
        }
    }

    namespace.ShelfPacker = ShelfPacker;
})(window.ImageCreator = window.ImageCreator || {});
