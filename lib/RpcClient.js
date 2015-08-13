'use strict';

var assert = require('assert');
var Promise = require('bluebird');
var uuid = require('node-uuid');
var ConnectionFactory = require('./ConnectionFactory');
var utils = require('./utils');


/**
 * Responsible for creating a RPC client with provided host.
 * @param {String} [host='localhost'] Optional host parameter. Defaults to `localhost`.
 * @constructor
 */
function RpcClient(host) {
    this._connectionFactory = new ConnectionFactory(host);
    this.setPublishMessageTransformer(RpcClient.defaultPublishMessageTransformer);
    this.setResponseMessageHandler(RpcClient.defaultResponseMessageHandler);
}


/**
 * Default publish message transformer calls JSON.stringify on `message`
 * if not a Buffer, then returns a Buffer.
 * @param {Buffer|*} message A Buffer or JSON "stringifiable" object
 * @returns {*}
 */
RpcClient.defaultPublishMessageTransformer = function(message) {
    if (message instanceof Buffer) {
        return Buffer;
    } else {
        var stringifiedMessage = JSON.stringify(message);
        return new Buffer(stringifiedMessage);
    }
};


/**
 * Default response handler that accepts JSON messages as input
 * @param {Object} channel Broker channel
 * @param {Function} fulfill Callback for the state 'finished'
 * @param {Function} reject Callback for for the state 'rejected'
 * @param {Function} [running] Optional callback for the state 'running'
 * @returns {Function} Function that expects a broker message
 */
RpcClient.defaultResponseMessageHandler = function(channel, fulfill, reject, running) {
    assert(typeof channel === 'object');
    assert(typeof fulfill === 'function');
    assert(typeof reject === 'function');
    assert(running == null || typeof running === 'function');

    return function jsonMessageHandlerParser(message) {
        var content = JSON.parse(message.content.toString());

        if (running && content.state === 'running') {
            running(content);
        }
        else if (content.state === 'finished') {
            fulfill(content);
            channel.close();
        }
        else if (content.state === 'rejected') {
            reject(content);
            channel.close();
        }
    };
};


RpcClient.prototype = {

    /**
     * Returns a connection
     * @returns {Promise<Object>} A promise of a connection
     * @private
     */
    _getConnection: function() {
        return this._connectionFactory.getConnection();
    },

    /**
     * Creates a channel on current connection
     * @returns {Promise<Object>} A promise of a channel
     * @private
     */
    _createChannel: function() {
        return this._getConnection()
            .bind(this)
            .then(function(connection) {
                return connection.createChannelAsync();
            });
    },

    /**
     * Creates an exclusive, auto-delete queue on provided channel
     * @param {Object} channel Channel to create temporary queue
     * @return {Promise<Object>} Promise of a queue
     * @private
     */
    _createTemporaryQueue: function(channel) {
        return channel.assertQueueAsync(null, {exclusive: true, autoDelete: true})
            .then(function(queueInfo) {
                return queueInfo.queue;
            });
    },

    /**
     * The provided transformer receives the message given on the `publish` method
     * and should return a Buffer that will be sent to `queue` on the same method.
     * @param {Function} transformer
     * @returns {RpcClient}
     */
    setPublishMessageTransformer: function(transformer) {
        assert(typeof transformer === 'function', 'publish transformer must be a function');
        this._publishMessageTransformer = transformer;
        return this;
    },

    /**
     * The provided response handler receives 4 parameters:
     * channel, fulfill, rejection and running callbacks.
     *
     * The handler must return a function which receives a single parameter:
     * A message of type Buffer.
     *
     * It is the responsibility of the handler to parse the message,
     * close the channel and call respective callbacks.
     *
     * For obvious reasons, either fulfill or reject callback MUST be called.
     *
     * @param {Function} handler
     * @returns {RpcClient}
     */
    setResponseMessageHandler: function(handler) {
        assert(typeof handler === 'function', 'response handler must be a function');
        this._responseMessageHandler = handler;
        return this;
    },

    /**
     * Publishes `message` to `queue`
     * @param {String} queue Name of the queue to publish to
     * @param {Buffer|*} message A Buffer or JSON "stringifiable" object
     * @param {Function|null} [callback] Optional callback function
     * @param {Function} [runningCallback] Optional callback to get information about the process
     * @returns {Promise<Object>} Returns a promise of
     */
    publish: function(queue, message, callback, runningCallback) {
        var defer = utils.defer();
        var channel = this._createChannel();
        var temporaryQueue = channel.then(function(channel) {
            return this._createTemporaryQueue(channel);
        });

        var buffer = this._publishMessageTransformer(message);
        assert(buffer instanceof Buffer, 'publish message transformer must return a Buffer');

        var self = this;
        return Promise.join(channel, temporaryQueue, function(channel, temporaryQueue) {
            var handler = self._responseMessageHandler(channel, defer.resolve, defer.reject, runningCallback);
            assert(typeof handler === 'function', 'response handler must return a function');

            var options = {
                replyTo: temporaryQueue,
                correlationId: uuid()
            };

            channel.consume(temporaryQueue, handler, {noAck: true});
            channel.sendToQueue(queue, buffer, options);

            return defer.promise;
        }).nodeify(callback);
    }

};


module.exports = RpcClient;
