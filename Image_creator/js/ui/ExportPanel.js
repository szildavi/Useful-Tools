(function (namespace) {
    'use strict';

    const Dom = namespace.Dom;
    const ExportService = namespace.ExportService;

    /** Drives the export controls and reports the result back to the user. */
    class ExportPanel {
        constructor(projectState) {
            this.projectState = projectState;
            this.exportService = new ExportService();

            this.collectElements();
            this.listenToInputs();
            this.refreshVisibleOptions();
        }

        collectElements() {
            this.formatSelect = Dom.byId('export-format-select');
            this.qualityRow = Dom.byId('jpeg-quality-row');
            this.qualityInput = Dom.byId('jpeg-quality-input');
            this.qualityValueLabel = Dom.byId('jpeg-quality-value');
            this.pdfLosslessRow = Dom.byId('pdf-lossless-row');
            this.pdfLosslessCheckbox = Dom.byId('pdf-lossless-checkbox');
            this.fileNameInput = Dom.byId('export-file-name-input');
            this.exportButton = Dom.byId('export-button');
            this.statusElement = Dom.byId('export-status');
        }

        listenToInputs() {
            this.formatSelect.addEventListener('change', () => this.refreshVisibleOptions());
            this.pdfLosslessCheckbox.addEventListener('change', () => this.refreshVisibleOptions());
            this.qualityInput.addEventListener('input', () => this.refreshQualityLabel());
            this.exportButton.addEventListener('click', () => this.exportCurrentPage());
        }

        refreshVisibleOptions() {
            const format = this.formatSelect.value;
            Dom.setVisible(this.pdfLosslessRow, format === 'pdf');
            Dom.setVisible(this.qualityRow, format === 'jpg' || (format === 'pdf' && !this.isLosslessPdfRequested()));
            this.refreshQualityLabel();
        }

        refreshQualityLabel() {
            this.qualityValueLabel.textContent = this.qualityInput.value + '%';
        }

        isLosslessPdfRequested() {
            return this.pdfLosslessCheckbox.checked;
        }

        collectOptions() {
            return {
                jpegQuality: Number(this.qualityInput.value) / 100,
                pdfLossless: this.isLosslessPdfRequested()
            };
        }

        async exportCurrentPage() {
            if (this.projectState.items.length === 0) {
                this.showStatus('There is nothing on the page to export yet.', true);
                return;
            }

            this.setBusy(true);
            try {
                await this.exportService.export(
                    this.projectState,
                    this.formatSelect.value,
                    this.collectOptions(),
                    this.readFileName()
                );
                this.showStatus('Export finished.', false);
            } catch (error) {
                this.showStatus('Export failed: ' + error.message, true);
            } finally {
                this.setBusy(false);
            }
        }

        readFileName() {
            const typedName = this.fileNameInput.value.trim();
            return typedName === '' ? 'image-sheet' : typedName;
        }

        setBusy(isBusy) {
            this.exportButton.disabled = isBusy;
            this.exportButton.textContent = isBusy ? 'Exporting...' : 'Export';
        }

        showStatus(message, isError) {
            this.statusElement.textContent = message;
            this.statusElement.classList.toggle('is-error', isError);
        }
    }

    namespace.ExportPanel = ExportPanel;
})(window.ImageCreator = window.ImageCreator || {});
