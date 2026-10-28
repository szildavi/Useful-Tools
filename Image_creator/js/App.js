(function (namespace) {
    'use strict';

    const Dom = namespace.Dom;

    /** Creates every part of the editor and connects them to each other. */
    class App {
        constructor() {
            this.projectState = new namespace.ProjectState();
            this.selectionModel = new namespace.SelectionModel();
            this.imageLoader = new namespace.ImageLoader();
            this.layoutCoordinator = new namespace.LayoutCoordinator(this.projectState);

            this.createView();
            this.createPanels();
            this.listenToToolbar();
            this.projectState.notify();
        }

        createView() {
            this.canvasView = new namespace.CanvasView(
                Dom.byId('page-canvas'),
                Dom.byId('canvas-viewport'),
                this.projectState,
                this.selectionModel
            );
            new namespace.CanvasInteractionController(this.canvasView, this.projectState, this.selectionModel);
        }

        createPanels() {
            this.pageSettingsPanel = new namespace.PageSettingsPanel(
                this.projectState.pageSettings,
                () => this.rearrangeAndRedraw()
            );
            new namespace.ImageListPanel(this.projectState, () => this.rearrangeAndRedraw());
            new namespace.ExportPanel(this.projectState);
            new namespace.StatusBar(this.projectState);
            new namespace.ImageDropTarget((files) => this.addImages(files));
        }

        listenToToolbar() {
            Dom.byId('image-file-input').addEventListener('change', (event) => {
                this.addImages(event.target.files);
                event.target.value = '';
            });
            Dom.byId('clear-images-button').addEventListener('click', () => this.clearImages());
            Dom.byId('auto-arrange-button').addEventListener('click', () => this.arrangeFromScratch());
        }

        async addImages(files) {
            const assets = await this.imageLoader.loadFiles(files);
            assets.forEach((asset) => this.projectState.addAsset(asset));
            this.rearrangeAndRedraw();
        }

        clearImages() {
            this.projectState.removeAllAssets();
            this.selectionModel.clear();
        }

        arrangeFromScratch() {
            this.layoutCoordinator.arrangeNow();
            this.selectionModel.clear();
        }

        /** Keeps the page in sync with the settings unless the user edited it by hand. */
        rearrangeAndRedraw() {
            this.layoutCoordinator.arrangeUnlessEditedByHand();
            this.projectState.notify();
        }
    }

    window.addEventListener('DOMContentLoaded', () => {
        namespace.app = new App();
    });

    namespace.App = App;
})(window.ImageCreator = window.ImageCreator || {});
