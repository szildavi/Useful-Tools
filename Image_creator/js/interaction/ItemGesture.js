(function (namespace) {
    'use strict';

    /**
     * Common shape of every direct manipulation on the page: it is created on
     * pointer down and updated while the pointer moves.
     */
    class ItemGesture {
        constructor(item, startPointMm, pageSettings) {
            this.item = item;
            this.startPointMm = startPointMm;
            this.pageSettings = pageSettings;
        }

        update() {
            throw new Error('update() must be implemented by the concrete gesture.');
        }
    }

    namespace.ItemGesture = ItemGesture;
})(window.ImageCreator = window.ImageCreator || {});
