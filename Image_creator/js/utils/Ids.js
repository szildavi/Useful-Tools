(function (namespace) {
    'use strict';

    let counter = 0;

    /** Creates unique identifiers for assets and placed items. */
    const Ids = {
        next(prefix) {
            counter += 1;
            return prefix + '-' + counter;
        }
    };

    namespace.Ids = Ids;
})(window.ImageCreator = window.ImageCreator || {});
