(function (namespace) {
    'use strict';

    /**
     * Minimal publish/subscribe base class used by every model that the user
     * interface has to react to.
     */
    class Observable {
        constructor() {
            this.listeners = [];
        }

        subscribe(listener) {
            this.listeners.push(listener);
            return () => this.unsubscribe(listener);
        }

        unsubscribe(listener) {
            const index = this.listeners.indexOf(listener);
            if (index !== -1) {
                this.listeners.splice(index, 1);
            }
        }

        notify(payload) {
            this.listeners.forEach((listener) => listener(payload));
        }
    }

    namespace.Observable = Observable;
})(window.ImageCreator = window.ImageCreator || {});
