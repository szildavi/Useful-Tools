(function (namespace) {
    'use strict';

    const Dom = namespace.Dom;

    /** Shows the facts that matter before printing: real size, resolution, item count. */
    class StatusBar {
        constructor(projectState) {
            this.projectState = projectState;
            this.textElement = Dom.byId('status-text');
            this.manualHintElement = Dom.byId('manual-changes-hint');

            this.projectState.subscribe(() => this.render());
            this.render();
        }

        render() {
            this.textElement.textContent = this.describeState();
            Dom.setVisible(this.manualHintElement, this.projectState.hasManualChanges);
        }

        describeState() {
            const pageSettings = this.projectState.pageSettings;
            return [
                'Page: ' + this.formatSize(pageSettings) + ' mm',
                'Output: ' + pageSettings.pixelWidth + ' x ' + pageSettings.pixelHeight + ' px at ' + pageSettings.dotsPerInch + ' DPI',
                'Items on page: ' + this.projectState.items.length
            ].join('   |   ');
        }

        formatSize(pageSettings) {
            return pageSettings.widthMm.toFixed(1) + ' x ' + pageSettings.heightMm.toFixed(1);
        }
    }

    namespace.StatusBar = StatusBar;
})(window.ImageCreator = window.ImageCreator || {});
