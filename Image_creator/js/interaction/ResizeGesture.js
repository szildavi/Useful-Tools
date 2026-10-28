(function (namespace) {
    'use strict';

    const ItemGesture = namespace.ItemGesture;

    const MINIMUM_SIZE_MM = 2;

    /**
     * Resizes an item from one of its corners. The corner on the opposite
     * side stays where it is and the aspect ratio of the image is kept.
     */
    class ResizeGesture extends ItemGesture {
        constructor(item, startPointMm, pageSettings, handleName) {
            super(item, startPointMm, pageSettings);
            this.handleName = handleName;
            this.aspectRatio = item.widthMm / item.heightMm;
            this.anchorMm = this.findAnchorCorner(item, handleName);
        }

        findAnchorCorner(item, handleName) {
            const anchors = {
                'top-left': { xMm: item.rightMm, yMm: item.bottomMm },
                'top-right': { xMm: item.xMm, yMm: item.bottomMm },
                'bottom-left': { xMm: item.rightMm, yMm: item.yMm },
                'bottom-right': { xMm: item.xMm, yMm: item.yMm }
            };
            return anchors[handleName];
        }

        update(pointMm) {
            const size = this.calculateSize(pointMm);
            this.item.resizeTo(size.widthMm, size.heightMm);
            this.item.moveTo(this.calculateLeft(size), this.calculateTop(size));
            this.item.keepInsidePage(this.pageSettings.widthMm, this.pageSettings.heightMm);
        }

        calculateSize(pointMm) {
            const draggedWidthMm = Math.abs(pointMm.xMm - this.anchorMm.xMm);
            const draggedHeightMm = Math.abs(pointMm.yMm - this.anchorMm.yMm);
            const widthMm = Math.max(MINIMUM_SIZE_MM, draggedWidthMm, draggedHeightMm * this.aspectRatio);
            return { widthMm, heightMm: widthMm / this.aspectRatio };
        }

        calculateLeft(size) {
            return this.handleName.endsWith('left') ? this.anchorMm.xMm - size.widthMm : this.anchorMm.xMm;
        }

        calculateTop(size) {
            return this.handleName.startsWith('top') ? this.anchorMm.yMm - size.heightMm : this.anchorMm.yMm;
        }
    }

    namespace.ResizeGesture = ResizeGesture;
})(window.ImageCreator = window.ImageCreator || {});
