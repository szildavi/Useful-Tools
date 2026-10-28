(function (namespace) {
    'use strict';

    const MILLIMETERS_PER_INCH = 25.4;

    /**
     * Every conversion between the units the application works with.
     * Millimeter is the canonical unit of the whole project.
     */
    const Units = {
        MILLIMETERS_PER_INCH,

        inchesToMillimeters(inches) {
            return inches * MILLIMETERS_PER_INCH;
        },

        millimetersToInches(millimeters) {
            return millimeters / MILLIMETERS_PER_INCH;
        },

        pixelsPerMillimeter(dotsPerInch) {
            return dotsPerInch / MILLIMETERS_PER_INCH;
        },

        millimetersToPixels(millimeters, dotsPerInch) {
            return millimeters * Units.pixelsPerMillimeter(dotsPerInch);
        },

        pixelsToMillimeters(pixels, dotsPerInch) {
            return pixels / Units.pixelsPerMillimeter(dotsPerInch);
        },

        millimetersToPdfPoints(millimeters) {
            return (millimeters / MILLIMETERS_PER_INCH) * 72;
        }
    };

    namespace.Units = Units;
})(window.ImageCreator = window.ImageCreator || {});
