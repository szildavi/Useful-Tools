(function (namespace) {
    'use strict';

    const UniformScaleSolver = namespace.UniformScaleSolver;
    const PlacedItem = namespace.PlacedItem;

    /**
     * Builds the page layout automatically: every requested copy of every
     * image is placed on the sheet at the largest common scale that fits.
     *
     * The base size of an image is its own pixel size, so images that are
     * bigger in pixels stay proportionally bigger on the printed sheet.
     */
    class AutoFitArranger {
        arrange(projectState) {
            const pageSettings = projectState.pageSettings;
            const baseRectangles = this.createBaseRectangles(projectState.assets);

            if (baseRectangles.length === 0) {
                return [];
            }

            const solver = new UniformScaleSolver(
                pageSettings.contentWidthMm,
                pageSettings.contentHeightMm,
                pageSettings.gapMm
            );
            const solution = solver.solve(baseRectangles);
            const centeredPlacements = this.centerInContentArea(solution.placements, pageSettings);

            return centeredPlacements.map((placement) => this.createItem(placement, projectState));
        }

        /** One rectangle per requested copy, ordered so packing wastes the least space. */
        createBaseRectangles(assets) {
            const rectangles = [];

            assets.forEach((asset) => {
                for (let copyIndex = 0; copyIndex < asset.copies; copyIndex += 1) {
                    rectangles.push({
                        sourceId: asset.id,
                        widthMm: asset.naturalWidth,
                        heightMm: asset.naturalHeight
                    });
                }
            });

            return rectangles.sort((first, second) => second.heightMm - first.heightMm);
        }

        centerInContentArea(placements, pageSettings) {
            if (placements.length === 0) {
                return [];
            }

            const usedWidthMm = Math.max(...placements.map((placement) => placement.xMm + placement.widthMm));
            const usedHeightMm = Math.max(...placements.map((placement) => placement.yMm + placement.heightMm));
            const offsetXMm = pageSettings.marginMm + (pageSettings.contentWidthMm - usedWidthMm) / 2;
            const offsetYMm = pageSettings.marginMm + (pageSettings.contentHeightMm - usedHeightMm) / 2;

            return placements.map((placement) => Object.assign({}, placement, {
                xMm: placement.xMm + offsetXMm,
                yMm: placement.yMm + offsetYMm
            }));
        }

        createItem(placement, projectState) {
            const asset = projectState.findAsset(placement.sourceId);
            return new PlacedItem(asset, placement.xMm, placement.yMm, placement.widthMm, placement.heightMm);
        }
    }

    namespace.AutoFitArranger = AutoFitArranger;
})(window.ImageCreator = window.ImageCreator || {});
