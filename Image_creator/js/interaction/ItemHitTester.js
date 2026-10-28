(function (namespace) {
    'use strict';

    /** Answers what lies under a point of the page: a resize handle or an item. */
    class ItemHitTester {
        findTopItemAt(items, pointMm) {
            for (let index = items.length - 1; index >= 0; index -= 1) {
                if (items[index].containsPoint(pointMm.xMm, pointMm.yMm)) {
                    return items[index];
                }
            }
            return null;
        }

        findHandleAt(item, pointMm, toleranceMm) {
            const handles = this.listHandles(item);
            const hit = handles.find((handle) => this.isNear(handle, pointMm, toleranceMm));
            return hit ? hit.name : null;
        }

        listHandles(item) {
            return [
                { name: 'top-left', xMm: item.xMm, yMm: item.yMm },
                { name: 'top-right', xMm: item.rightMm, yMm: item.yMm },
                { name: 'bottom-left', xMm: item.xMm, yMm: item.bottomMm },
                { name: 'bottom-right', xMm: item.rightMm, yMm: item.bottomMm }
            ];
        }

        isNear(handle, pointMm, toleranceMm) {
            return Math.abs(handle.xMm - pointMm.xMm) <= toleranceMm
                && Math.abs(handle.yMm - pointMm.yMm) <= toleranceMm;
        }
    }

    namespace.ItemHitTester = ItemHitTester;
})(window.ImageCreator = window.ImageCreator || {});
