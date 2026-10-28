(function (namespace) {
    'use strict';

    const ItemGesture = namespace.ItemGesture;

    /** Drags an item around the sheet, never letting it leave the paper. */
    class MoveGesture extends ItemGesture {
        constructor(item, startPointMm, pageSettings) {
            super(item, startPointMm, pageSettings);
            this.grabOffsetXMm = startPointMm.xMm - item.xMm;
            this.grabOffsetYMm = startPointMm.yMm - item.yMm;
        }

        update(pointMm) {
            this.item.moveTo(pointMm.xMm - this.grabOffsetXMm, pointMm.yMm - this.grabOffsetYMm);
            this.item.keepInsidePage(this.pageSettings.widthMm, this.pageSettings.heightMm);
        }
    }

    namespace.MoveGesture = MoveGesture;
})(window.ImageCreator = window.ImageCreator || {});
