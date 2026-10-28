(function (namespace) {
    'use strict';

    /**
     * The built in paper sizes. Every size is stored in its portrait form,
     * the orientation is applied later by the page settings.
     */
    const PRESETS = [
        { id: 'a6', name: 'A6', widthMm: 105, heightMm: 148 },
        { id: 'a5', name: 'A5', widthMm: 148, heightMm: 210 },
        { id: 'a4', name: 'A4', widthMm: 210, heightMm: 297 },
        { id: 'a3', name: 'A3', widthMm: 297, heightMm: 420 },
        { id: 'a2', name: 'A2', widthMm: 420, heightMm: 594 },
        { id: 'a1', name: 'A1', widthMm: 594, heightMm: 841 },
        { id: 'letter', name: 'Letter', widthMm: 215.9, heightMm: 279.4 },
        { id: 'legal', name: 'Legal', widthMm: 215.9, heightMm: 355.6 },
        { id: 'tabloid', name: 'Tabloid', widthMm: 279.4, heightMm: 431.8 }
    ];

    const PaperPresets = {
        CUSTOM_ID: 'custom',

        list() {
            return PRESETS.slice();
        },

        findById(presetId) {
            return PRESETS.find((preset) => preset.id === presetId) || null;
        }
    };

    namespace.PaperPresets = PaperPresets;
})(window.ImageCreator = window.ImageCreator || {});
