(function (namespace) {
    'use strict';

    const Dom = namespace.Dom;

    /**
     * Lists the loaded images with their thumbnail and the number of copies
     * that should appear on the sheet.
     */
    class ImageListPanel {
        constructor(projectState, onLayoutInputChanged) {
            this.projectState = projectState;
            this.onLayoutInputChanged = onLayoutInputChanged;
            this.listElement = Dom.byId('image-list');
            this.emptyMessageElement = Dom.byId('image-list-empty-message');

            this.projectState.subscribe(() => this.render());
            this.render();
        }

        render() {
            Dom.clear(this.listElement);
            Dom.setVisible(this.emptyMessageElement, this.projectState.isEmpty);
            this.projectState.assets.forEach((asset) => {
                this.listElement.appendChild(this.createRow(asset));
            });
        }

        createRow(asset) {
            const row = Dom.create('li', 'image-row');
            row.appendChild(this.createThumbnail(asset));
            row.appendChild(this.createDetails(asset));
            row.appendChild(this.createCopiesInput(asset));
            row.appendChild(this.createRemoveButton(asset));
            return row;
        }

        createThumbnail(asset) {
            const thumbnail = Dom.create('img', 'image-row__thumbnail');
            thumbnail.src = asset.objectUrl;
            thumbnail.alt = asset.fileName;
            return thumbnail;
        }

        createDetails(asset) {
            const details = Dom.create('div', 'image-row__details');
            details.appendChild(Dom.create('span', 'image-row__name', asset.fileName));
            details.appendChild(Dom.create('span', 'image-row__size', asset.naturalWidth + ' x ' + asset.naturalHeight + ' px'));
            return details;
        }

        createCopiesInput(asset) {
            const input = Dom.create('input', 'image-row__copies');
            input.type = 'number';
            input.min = '0';
            input.max = '500';
            input.value = asset.copies;
            input.title = 'How many copies of this image the sheet should contain';
            input.addEventListener('change', () => {
                asset.setCopies(Number(input.value));
                input.value = asset.copies;
                this.onLayoutInputChanged();
            });
            return input;
        }

        createRemoveButton(asset) {
            const button = Dom.create('button', 'image-row__remove', '×');
            button.type = 'button';
            button.title = 'Remove this image';
            button.addEventListener('click', () => {
                this.projectState.removeAsset(asset.id);
                this.onLayoutInputChanged();
            });
            return button;
        }
    }

    namespace.ImageListPanel = ImageListPanel;
})(window.ImageCreator = window.ImageCreator || {});
