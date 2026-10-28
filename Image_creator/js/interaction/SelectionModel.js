(function (namespace) {
    'use strict';

    const Observable = namespace.Observable;

    /** Remembers which item is currently selected on the page. */
    class SelectionModel extends Observable {
        constructor() {
            super();
            this.selectedItemId = null;
        }

        select(itemId) {
            if (this.selectedItemId === itemId) {
                return;
            }
            this.selectedItemId = itemId;
            this.notify();
        }

        clear() {
            this.select(null);
        }

        isSelected(itemId) {
            return this.selectedItemId === itemId;
        }
    }

    namespace.SelectionModel = SelectionModel;
})(window.ImageCreator = window.ImageCreator || {});
