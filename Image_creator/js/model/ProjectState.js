(function (namespace) {
    'use strict';

    const Observable = namespace.Observable;
    const PageSettings = namespace.PageSettings;

    /**
     * The single source of truth of the editor: the page, the loaded images
     * and the items currently placed on the sheet.
     */
    class ProjectState extends Observable {
        constructor() {
            super();
            this.pageSettings = new PageSettings();
            this.assets = [];
            this.items = [];
            this.hasManualChanges = false;
        }

        addAsset(asset) {
            this.assets.push(asset);
            this.notify();
        }

        removeAsset(assetId) {
            const asset = this.findAsset(assetId);
            if (!asset) {
                return;
            }
            this.assets = this.assets.filter((candidate) => candidate.id !== assetId);
            this.items = this.items.filter((item) => item.asset.id !== assetId);
            asset.releaseResources();
            this.notify();
        }

        removeAllAssets() {
            this.assets.forEach((asset) => asset.releaseResources());
            this.assets = [];
            this.items = [];
            this.hasManualChanges = false;
            this.notify();
        }

        findAsset(assetId) {
            return this.assets.find((asset) => asset.id === assetId) || null;
        }

        findItem(itemId) {
            return this.items.find((item) => item.id === itemId) || null;
        }

        removeItem(itemId) {
            this.items = this.items.filter((item) => item.id !== itemId);
            this.hasManualChanges = true;
            this.notify();
        }

        setItems(items) {
            this.items = items;
            this.notify();
        }

        get totalCopies() {
            return this.assets.reduce((total, asset) => total + asset.copies, 0);
        }

        get isEmpty() {
            return this.assets.length === 0;
        }

        markManuallyEdited() {
            this.hasManualChanges = true;
        }

        clearManualChangesFlag() {
            this.hasManualChanges = false;
        }
    }

    namespace.ProjectState = ProjectState;
})(window.ImageCreator = window.ImageCreator || {});
