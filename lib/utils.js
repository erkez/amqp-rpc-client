'use strict';

var Promise = require('bluebird');


/**
 * Creates a deferred object.
 * @returns {{resolve: Function, reject: Function, promise: Promise}}
 */
module.exports.defer = function() {
    var resolve, reject;
    var promise = new Promise(function() {
        resolve = arguments[0];
        reject = arguments[1];
    });

    return {
        resolve: resolve,
        reject: reject,
        promise: promise
    };
};
