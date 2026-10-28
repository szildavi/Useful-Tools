(function (namespace) {
    'use strict';

    /** Thin wrappers around the DOM API so the panels stay readable. */
    const Dom = {
        byId(elementId) {
            const element = document.getElementById(elementId);
            if (!element) {
                throw new Error('Missing element in the page: #' + elementId);
            }
            return element;
        },

        create(tagName, className, textContent) {
            const element = document.createElement(tagName);
            if (className) {
                element.className = className;
            }
            if (textContent !== undefined) {
                element.textContent = textContent;
            }
            return element;
        },

        clear(element) {
            while (element.firstChild) {
                element.removeChild(element.firstChild);
            }
        },

        setVisible(element, visible) {
            element.classList.toggle('is-hidden', !visible);
        }
    };

    namespace.Dom = Dom;
})(window.ImageCreator = window.ImageCreator || {});
