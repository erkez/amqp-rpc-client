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
    this.setExchange('');
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
        return message;
    } else {
        var stringifiedMessage = JSON.stringify(message);
        return new Buffer(stringifiedMessage);
    }
};


/**
 * Default response handler that accepts JSON messages as input
 * @param {Function} fulfill Callback fulfills the published message
 * @param {Function} reject Callback rejects the published message
 * @param {Function} [progress] Optional callback reports progress of published message
 * @returns {Function} Function that expects a broker message
 */
RpcClient.defaultResponseMessageHandler = function(fulfill, reject, progress) {
    return function jsonMessageHandlerParser(message) {
        if (!message) {
            return reject('Consumer was canceled');
        }

        var content = JSON.parse(message.content.toString());

        if (progress && content.state === 'running') {
            progress(content);
        }
        else if (content.state === 'finished') {
            fulfill(content);
        }
        else if (content.state === 'rejected') {
            reject(content);
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
     * @returns {Object} A disposer of a channel
     * @private
     */
    _createChannel: function() {
        return this._getConnection()
            .bind(this)
            .call('createChannelAsync')
            .disposer(function(channel) {
                channel.close();
            });
    },

    /**
     * Creates an exclusive, auto-delete queue on provided channel
     * @param {Object} channel Channel to create temporary queue
     * @return {Promise<Object>} Promise of a queue
     * @private
     */
    _createTemporaryQueue: function(channel) {
        return channel
            .assertQueueAsync(null, {exclusive: true, autoDelete: true})
            .get('queue');
    },

    /**
     * Sets the exchange for all client calls. May be set individually
     * as an option in `publish`.
     * @param {String} exchange
     * @returns {RpcClient}
     */
    setExchange: function(exchange) {
        assert(typeof exchange === 'string', 'exchange must be a string');
        this._exchange = exchange;
        return this;
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
     * @param {Object} [options]
     * @param {Object} [options.exchange=''] Overrides client exchange. Defaults to ''.
     * @param {Function} [options.progressCallback] Optional callback to be called
     * when the received message is not final. It is only useful if the server sends
     * such kind of messages and if response message parser cares about them.
     * @param {Function} [callback] Optional callback function
     * @returns {Promise<Object>} Returns a promise of the server response
     */
    publish: function(queue, message, options, callback) {
        var self = this;

        if (typeof options === 'function') {
            callback = options;
            options = {};
        }

        assert(typeof queue === 'string', 'queue must be a string');
        assert(options == null || typeof options === 'object', 'options must be an object');
        assert(callback == null || typeof callback === 'function', 'callback must be a function');

        return Promise.using(this._createChannel(), function(channel) {
            return self._createTemporaryQueue(channel).then(function(temporaryQueue) {
                var defer = utils.defer();
                var options = {
                    replyTo: temporaryQueue,
                    correlationId: uuid()
                };

                var handler = self._responseMessageHandler(defer.resolve, defer.reject, options.progressCallback);
                assert(typeof handler === 'function', 'response handler must return a function');

                var buffer = self._publishMessageTransformer(message);
                assert(buffer instanceof Buffer, 'publish message transformer must return a Buffer');
                channel.publish(options.exchange || self._exchange, queue, buffer, options);

                var consume = channel.consumeAsync(temporaryQueue, handler, {noAck: true});
                return Promise.join(defer.promise, consume).get(0);
            });
        }).nodeify(callback);
    }

};


module.exports = RpcClient;
