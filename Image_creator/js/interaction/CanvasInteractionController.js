(function (namespace) {
    'use strict';

    const ItemHitTester = namespace.ItemHitTester;
    const MoveGesture = namespace.MoveGesture;
    const ResizeGesture = namespace.ResizeGesture;

    /**
     * Translates pointer and keyboard events of the preview canvas into
     * selection changes and item gestures.
     */
    class CanvasInteractionController {
        constructor(canvasView, projectState, selectionModel) {
            this.canvasView = canvasView;
            this.projectState = projectState;
            this.selectionModel = selectionModel;
            this.hitTester = new ItemHitTester();
            this.activeGesture = null;

            this.listenToPointer();
            this.listenToKeyboard();
        }

        listenToPointer() {
            const canvasElement = this.canvasView.canvasElement;
            canvasElement.addEventListener('pointerdown', (event) => this.handlePointerDown(event));
            canvasElement.addEventListener('pointermove', (event) => this.updateCursor(event));
            window.addEventListener('pointermove', (event) => this.handlePointerMove(event));
            window.addEventListener('pointerup', () => this.handlePointerUp());
        }

        listenToKeyboard() {
            window.addEventListener('keydown', (event) => this.handleKeyDown(event));
        }

        handlePointerDown(event) {
            const pointMm = this.canvasView.toPageMillimeters(event.clientX, event.clientY);
            const handleName = this.findHandleUnderPointer(pointMm);

            if (handleName) {
                this.startResize(pointMm, handleName);
                return;
            }

            const item = this.hitTester.findTopItemAt(this.projectState.items, pointMm);
            if (!item) {
                this.selectionModel.clear();
                return;
            }

            this.selectionModel.select(item.id);
            this.activeGesture = new MoveGesture(item, pointMm, this.projectState.pageSettings);
        }

        startResize(pointMm, handleName) {
            const item = this.projectState.findItem(this.selectionModel.selectedItemId);
            this.activeGesture = new ResizeGesture(item, pointMm, this.projectState.pageSettings, handleName);
        }

        findHandleUnderPointer(pointMm) {
            const selectedItem = this.projectState.findItem(this.selectionModel.selectedItemId);
            if (!selectedItem) {
                return null;
            }
            return this.hitTester.findHandleAt(selectedItem, pointMm, this.canvasView.handleToleranceMm / 2);
        }

        handlePointerMove(event) {
            if (!this.activeGesture) {
                return;
            }
            this.activeGesture.update(this.canvasView.toPageMillimeters(event.clientX, event.clientY));
            this.projectState.markManuallyEdited();
            this.projectState.notify();
        }

        handlePointerUp() {
            this.activeGesture = null;
        }

        updateCursor(event) {
            const pointMm = this.canvasView.toPageMillimeters(event.clientX, event.clientY);
            const canvasElement = this.canvasView.canvasElement;

            if (this.findHandleUnderPointer(pointMm)) {
                canvasElement.style.cursor = 'nwse-resize';
                return;
            }
            const hoveredItem = this.hitTester.findTopItemAt(this.projectState.items, pointMm);
            canvasElement.style.cursor = hoveredItem ? 'move' : 'default';
        }

        handleKeyDown(event) {
            const isDeleteKey = event.key === 'Delete' || event.key === 'Backspace';
            if (!isDeleteKey || !this.selectionModel.selectedItemId || this.isTypingInInput(event)) {
                return;
            }
            this.projectState.removeItem(this.selectionModel.selectedItemId);
            this.selectionModel.clear();
        }

        isTypingInInput(event) {
            const tagName = event.target.tagName;
            return tagName === 'INPUT' || tagName === 'SELECT' || tagName === 'TEXTAREA';
        }
    }

    namespace.CanvasInteractionController = CanvasInteractionController;
})(window.ImageCreator = window.ImageCreator || {});
