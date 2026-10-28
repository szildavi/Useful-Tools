(function (namespace) {
    'use strict';

    const ShelfPacker = namespace.ShelfPacker;

    const BISECTION_STEPS = 42;

    /**
     * Finds the largest single scale factor that still lets every rectangle
     * fit into the printable area. One shared factor is used for all of them,
     * so the images keep their size relation to each other.
     */
    class UniformScaleSolver {
        constructor(areaWidthMm, areaHeightMm, gapMm) {
            this.areaWidthMm = areaWidthMm;
            this.areaHeightMm = areaHeightMm;
            this.gapMm = gapMm;
            this.packer = new ShelfPacker(areaWidthMm, areaHeightMm, gapMm);
        }

        /**
         * @param baseRectangles rectangles in their own base unit, already
         *        ordered the way they should be packed.
         * @returns {{scale: number, placements: Array}}
         */
        solve(baseRectangles) {
            if (baseRectangles.length === 0) {
                return { scale: 0, placements: [] };
            }

            let lowerScale = 0;
            let upperScale = this.estimateUpperScale(baseRectangles);
            let bestResult = { scale: 0, placements: [] };

            for (let step = 0; step < BISECTION_STEPS; step += 1) {
                const candidateScale = (lowerScale + upperScale) / 2;
                const result = this.packer.pack(this.scaleRectangles(baseRectangles, candidateScale));

                if (result.success) {
                    bestResult = { scale: candidateScale, placements: result.placements };
                    lowerScale = candidateScale;
                } else {
                    upperScale = candidateScale;
                }
            }

            return bestResult;
        }

        /** A scale that surely cannot be exceeded, used as the search ceiling. */
        estimateUpperScale(baseRectangles) {
            const widestBase = Math.max(...baseRectangles.map((rectangle) => rectangle.widthMm));
            const tallestBase = Math.max(...baseRectangles.map((rectangle) => rectangle.heightMm));
            const totalBaseArea = baseRectangles.reduce(
                (total, rectangle) => total + rectangle.widthMm * rectangle.heightMm,
                0
            );

            const singleItemLimit = Math.min(this.areaWidthMm / widestBase, this.areaHeightMm / tallestBase);
            const totalAreaLimit = Math.sqrt((this.areaWidthMm * this.areaHeightMm) / totalBaseArea);

            return Math.min(singleItemLimit, totalAreaLimit);
        }

        scaleRectangles(baseRectangles, scale) {
            return baseRectangles.map((rectangle) => ({
                sourceId: rectangle.sourceId,
                widthMm: rectangle.widthMm * scale,
                heightMm: rectangle.heightMm * scale
            }));
        }
    }

    namespace.UniformScaleSolver = UniformScaleSolver;
})(window.ImageCreator = window.ImageCreator || {});
