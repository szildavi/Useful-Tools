(function (namespace) {
    'use strict';

    const Dom = namespace.Dom;
    const Units = namespace.Units;
    const PaperPresets = namespace.PaperPresets;
    const PageSettings = namespace.PageSettings;

    const MILLIMETER_UNIT = 'mm';

    /** Connects the page related inputs of the sidebar to the page settings. */
    class PageSettingsPanel {
        constructor(pageSettings, onSettingsChanged) {
            this.pageSettings = pageSettings;
            this.onSettingsChanged = onSettingsChanged;
            this.sizeUnit = MILLIMETER_UNIT;

            this.collectElements();
            this.fillPresetOptions();
            this.listenToInputs();
            this.refreshInputs();
        }

        collectElements() {
            this.presetSelect = Dom.byId('paper-preset-select');
            this.widthInput = Dom.byId('page-width-input');
            this.heightInput = Dom.byId('page-height-input');
            this.unitSelect = Dom.byId('page-unit-select');
            this.portraitButton = Dom.byId('orientation-portrait-button');
            this.landscapeButton = Dom.byId('orientation-landscape-button');
            this.dpiInput = Dom.byId('dpi-input');
            this.marginInput = Dom.byId('margin-input');
            this.gapInput = Dom.byId('gap-input');
        }

        fillPresetOptions() {
            PaperPresets.list().forEach((preset) => {
                const option = Dom.create('option', null, preset.name);
                option.value = preset.id;
                this.presetSelect.appendChild(option);
            });

            const customOption = Dom.create('option', null, 'Custom size');
            customOption.value = PaperPresets.CUSTOM_ID;
            this.presetSelect.appendChild(customOption);
        }

        listenToInputs() {
            this.presetSelect.addEventListener('change', () => this.handlePresetChange());
            this.widthInput.addEventListener('change', () => this.handleCustomSizeChange());
            this.heightInput.addEventListener('change', () => this.handleCustomSizeChange());
            this.unitSelect.addEventListener('change', () => this.handleUnitChange());
            this.portraitButton.addEventListener('click', () => this.handleOrientationChange(PageSettings.PORTRAIT));
            this.landscapeButton.addEventListener('click', () => this.handleOrientationChange(PageSettings.LANDSCAPE));
            this.dpiInput.addEventListener('change', () => this.handleResolutionChange());
            this.marginInput.addEventListener('change', () => this.handleSpacingChange());
            this.gapInput.addEventListener('change', () => this.handleSpacingChange());
        }

        handlePresetChange() {
            if (this.presetSelect.value === PaperPresets.CUSTOM_ID) {
                this.handleCustomSizeChange();
                return;
            }
            this.pageSettings.applyPreset(this.presetSelect.value);
            this.publishChange();
        }

        handleCustomSizeChange() {
            this.pageSettings.setCustomSizeMm(
                this.readSizeInputAsMillimeters(this.widthInput),
                this.readSizeInputAsMillimeters(this.heightInput)
            );
            this.publishChange();
        }

        handleUnitChange() {
            this.sizeUnit = this.unitSelect.value;
            this.refreshInputs();
        }

        handleOrientationChange(orientation) {
            this.pageSettings.setOrientation(orientation);
            this.publishChange();
        }

        handleResolutionChange() {
            this.pageSettings.setDotsPerInch(Number(this.dpiInput.value));
            this.publishChange();
        }

        handleSpacingChange() {
            this.pageSettings.setMarginMm(Number(this.marginInput.value));
            this.pageSettings.setGapMm(Number(this.gapInput.value));
            this.publishChange();
        }

        readSizeInputAsMillimeters(input) {
            const value = Number(input.value);
            return this.sizeUnit === MILLIMETER_UNIT ? value : Units.inchesToMillimeters(value);
        }

        formatSizeForInput(millimeters) {
            const value = this.sizeUnit === MILLIMETER_UNIT ? millimeters : Units.millimetersToInches(millimeters);
            return value.toFixed(this.sizeUnit === MILLIMETER_UNIT ? 1 : 3);
        }

        refreshInputs() {
            this.presetSelect.value = this.pageSettings.presetId;
            this.widthInput.value = this.formatSizeForInput(this.pageSettings.widthMm);
            this.heightInput.value = this.formatSizeForInput(this.pageSettings.heightMm);
            this.dpiInput.value = this.pageSettings.dotsPerInch;
            this.marginInput.value = this.pageSettings.marginMm;
            this.gapInput.value = this.pageSettings.gapMm;
            this.portraitButton.classList.toggle('is-active', !this.pageSettings.isLandscape);
            this.landscapeButton.classList.toggle('is-active', this.pageSettings.isLandscape);
        }

        publishChange() {
            this.refreshInputs();
            this.onSettingsChanged();
        }
    }

    namespace.PageSettingsPanel = PageSettingsPanel;
})(window.ImageCreator = window.ImageCreator || {});
