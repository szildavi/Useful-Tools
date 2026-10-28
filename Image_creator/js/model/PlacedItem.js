(function (namespace) {
    'use strict';

    const Ids = namespace.Ids;

    /**
     * A single image copy positioned on the page. All of its coordinates are
     * millimeters measured from the top left corner of the sheet.
     */
    class PlacedItem {
        constructor(asset, xMm, yMm, widthMm, heightMm) {
            this.id = Ids.next('item');
            this.asset = asset;
            this.xMm = xMm;
            this.yMm = yMm;
            this.widthMm = widthMm;
            this.heightMm = heightMm;
        }

        get rightMm() {
            return this.xMm + this.widthMm;
        }

        get bottomMm() {
            return this.yMm + this.heightMm;
        }

        containsPoint(xMm, yMm) {
            return xMm >= this.xMm && xMm <= this.rightMm && yMm >= this.yMm && yMm <= this.bottomMm;
        }

        moveTo(xMm, yMm) {
            this.xMm = xMm;
            this.yMm = yMm;
        }

        resizeTo(widthMm, heightMm) {
            this.widthMm = Math.max(1, widthMm);
            this.heightMm = Math.max(1, heightMm);
        }

        keepInsidePage(pageWidthMm, pageHeightMm) {
            this.xMm = Math.min(Math.max(0, this.xMm), Math.max(0, pageWidthMm - this.widthMm));
            this.yMm = Math.min(Math.max(0, this.yMm), Math.max(0, pageHeightMm - this.heightMm));
        }
    }

    namespace.PlacedItem = PlacedItem;
})(window.ImageCreator = window.ImageCreator || {});
