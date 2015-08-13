'use strict';

var Promise = require('bluebird');
var amqp = require('amqplib/callback_api');

Promise.promisifyAll(amqp);
Promise.promisifyAll(require('amqplib/lib/callback_model'));


/**
 * Class is responsible for creating connections
 * @param {String} [host='localhost'] Optional host parameter. Defaults to `localhost`.
 * @constructor
 */
function ConnectionFactory(host) {
    this.host = host || 'localhost';
    this.connection = null;
}


ConnectionFactory.prototype = {

    /**
     * Creates connection URL based on provided host.
     * @returns {String}
     */
    makeUrl: function() {
        return 'amqp://' + this.host;
    },


    /**
     * Creates or returns existing connection.
     * @returns {Promise<Object>}
     */
    getConnection: function() {
        var self = this;

        if (self.connection) {
            return self.connection;
        }

        var url = self.makeUrl();

        return (self.connection = amqp.connectAsync(url)
            .then(function(connection) {
                connection.on('error', function() {
                    self.connection = null;
                });

                return connection;
            }));
    }

};


module.exports = ConnectionFactory;
