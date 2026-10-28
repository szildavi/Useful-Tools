(function (namespace) {
    'use strict';

    const AutoFitArranger = namespace.AutoFitArranger;

    /**
     * Decides when the automatic arrangement is allowed to overwrite the
     * page. Once the user moved or resized something by hand the layout is
     * only rebuilt on an explicit request.
     */
    class LayoutCoordinator {
        constructor(projectState) {
            this.projectState = projectState;
            this.arranger = new AutoFitArranger();
        }

        arrangeNow() {
            const items = this.arranger.arrange(this.projectState);
            this.projectState.clearManualChangesFlag();
            this.projectState.setItems(items);
        }

        arrangeUnlessEditedByHand() {
            if (this.projectState.hasManualChanges) {
                return;
            }
            this.arrangeNow();
        }
    }

    namespace.LayoutCoordinator = LayoutCoordinator;
})(window.ImageCreator = window.ImageCreator || {});
