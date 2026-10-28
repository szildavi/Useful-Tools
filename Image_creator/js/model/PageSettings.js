(function (namespace) {
    'use strict';

    const PaperPresets = namespace.PaperPresets;
    const Units = namespace.Units;

    const PORTRAIT = 'portrait';
    const LANDSCAPE = 'landscape';

    /**
     * Everything that describes the sheet of paper: its size, orientation,
     * print resolution and the free area kept around and between the images.
     */
    class PageSettings {
        constructor() {
            this.presetId = 'a4';
            this.portraitWidthMm = 210;
            this.portraitHeightMm = 297;
            this.orientation = PORTRAIT;
            this.dotsPerInch = 300;
            this.marginMm = 5;
            this.gapMm = 3;
        }

        static get PORTRAIT() {
            return PORTRAIT;
        }

        static get LANDSCAPE() {
            return LANDSCAPE;
        }

        applyPreset(presetId) {
            const preset = PaperPresets.findById(presetId);
            if (!preset) {
                return;
            }
            this.presetId = preset.id;
            this.portraitWidthMm = preset.widthMm;
            this.portraitHeightMm = preset.heightMm;
        }

        /** The given size is the size of the sheet as it is shown, orientation included. */
        setCustomSizeMm(widthMm, heightMm) {
            const safeWidthMm = Math.max(1, widthMm);
            const safeHeightMm = Math.max(1, heightMm);

            this.presetId = PaperPresets.CUSTOM_ID;
            this.portraitWidthMm = this.isLandscape ? safeHeightMm : safeWidthMm;
            this.portraitHeightMm = this.isLandscape ? safeWidthMm : safeHeightMm;
        }

        setOrientation(orientation) {
            this.orientation = orientation === LANDSCAPE ? LANDSCAPE : PORTRAIT;
        }

        setDotsPerInch(dotsPerInch) {
            this.dotsPerInch = Math.min(1200, Math.max(36, dotsPerInch));
        }

        setMarginMm(marginMm) {
            this.marginMm = Math.max(0, marginMm);
        }

        setGapMm(gapMm) {
            this.gapMm = Math.max(0, gapMm);
        }

        get isLandscape() {
            return this.orientation === LANDSCAPE;
        }

        get widthMm() {
            return this.isLandscape ? this.portraitHeightMm : this.portraitWidthMm;
        }

        get heightMm() {
            return this.isLandscape ? this.portraitWidthMm : this.portraitHeightMm;
        }

        get contentWidthMm() {
            return Math.max(0, this.widthMm - this.marginMm * 2);
        }

        get contentHeightMm() {
            return Math.max(0, this.heightMm - this.marginMm * 2);
        }

        get pixelWidth() {
            return Math.round(Units.millimetersToPixels(this.widthMm, this.dotsPerInch));
        }

        get pixelHeight() {
            return Math.round(Units.millimetersToPixels(this.heightMm, this.dotsPerInch));
        }
    }

    namespace.PageSettings = PageSettings;
})(window.ImageCreator = window.ImageCreator || {});
