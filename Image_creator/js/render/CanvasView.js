(function (namespace) {
    'use strict';

    const PageRenderer = namespace.PageRenderer;
    const SelectionOverlayRenderer = namespace.SelectionOverlayRenderer;

    const VIEWPORT_PADDING_PX = 48;

    /**
     * The interactive preview. It keeps the canvas fitted to its container,
     * redraws the page and converts screen coordinates into page millimeters.
     */
    class CanvasView {
        constructor(canvasElement, viewportElement, projectState, selectionModel) {
            this.canvasElement = canvasElement;
            this.viewportElement = viewportElement;
            this.projectState = projectState;
            this.selectionModel = selectionModel;
            this.pageRenderer = new PageRenderer();
            this.overlayRenderer = new SelectionOverlayRenderer();
            this.pixelsPerMm = 1;

            this.projectState.subscribe(() => this.refresh());
            this.selectionModel.subscribe(() => this.refresh());
            window.addEventListener('resize', () => this.refresh());
        }

        refresh() {
            this.updateCanvasSize();
            this.draw();
        }

        updateCanvasSize() {
            const pageSettings = this.projectState.pageSettings;
            this.pixelsPerMm = this.calculateFitScale(pageSettings);

            const cssWidth = pageSettings.widthMm * this.pixelsPerMm;
            const cssHeight = pageSettings.heightMm * this.pixelsPerMm;
            const devicePixelRatio = window.devicePixelRatio || 1;

            this.canvasElement.style.width = cssWidth + 'px';
            this.canvasElement.style.height = cssHeight + 'px';
            this.canvasElement.width = Math.round(cssWidth * devicePixelRatio);
            this.canvasElement.height = Math.round(cssHeight * devicePixelRatio);
            this.devicePixelRatio = devicePixelRatio;
        }

        calculateFitScale(pageSettings) {
            const availableWidth = Math.max(80, this.viewportElement.clientWidth - VIEWPORT_PADDING_PX);
            const availableHeight = Math.max(80, this.viewportElement.clientHeight - VIEWPORT_PADDING_PX);
            return Math.min(availableWidth / pageSettings.widthMm, availableHeight / pageSettings.heightMm);
        }

        draw() {
            const context = this.canvasElement.getContext('2d');
            context.setTransform(this.devicePixelRatio, 0, 0, this.devicePixelRatio, 0, 0);
            context.clearRect(0, 0, this.canvasElement.width, this.canvasElement.height);

            this.pageRenderer.render(context, this.projectState, this.pixelsPerMm);
            this.overlayRenderer.drawMarginGuide(context, this.projectState.pageSettings, this.pixelsPerMm);
            this.drawSelectionIfAny(context);
        }

        drawSelectionIfAny(context) {
            const selectedItem = this.projectState.findItem(this.selectionModel.selectedItemId);
            if (selectedItem) {
                this.overlayRenderer.drawSelection(context, selectedItem, this.pixelsPerMm);
            }
        }

        toPageMillimeters(clientX, clientY) {
            const bounds = this.canvasElement.getBoundingClientRect();
            return {
                xMm: (clientX - bounds.left) / this.pixelsPerMm,
                yMm: (clientY - bounds.top) / this.pixelsPerMm
            };
        }

        get handleToleranceMm() {
            return SelectionOverlayRenderer.HANDLE_SIZE_PX / this.pixelsPerMm;
        }
    }

    namespace.CanvasView = CanvasView;
})(window.ImageCreator = window.ImageCreator || {});
