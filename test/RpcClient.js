'use strict';

var common = require('./common');
var ConnectionFactory = require('../lib/ConnectionFactory');
var RpcClient = require('../lib');


describe('RpcClient', function() {

    it('should instantiate client without any parameters', function() {
        var client = new RpcClient();
        client._connectionFactory.makeUrl().should.equal('amqp://localhost');
    });


    it('should instantiate client with provided host', function() {
        var host = 'myhost:5123';
        var client = new RpcClient(host);
        client._connectionFactory.makeUrl().should.equal('amqp://' + host);
    });


    describe('Message transformer', function() {

        it('should transform request if object', function() {
            var client = new RpcClient();
            var message = {test: 123};
            var stringMessage = JSON.stringify(message);
            var buffer = client._publishMessageTransformer(message);
            buffer.should.be.instanceOf(Buffer);
            buffer.toString().should.equal(stringMessage);
        });

        it('should simply return Buffer if Buffer', function() {
            var client = new RpcClient();
            var message = {abc: 321};
            var bufferMessage = new Buffer(JSON.stringify(message));
            var buffer = client._publishMessageTransformer(bufferMessage);
            buffer.should.equal(bufferMessage);
        });

        it('should set another transformer and process message correctly', function() {
            var transformer = function(message) {
                message.anotherProperty = 0;
                var stringified = JSON.stringify(message);
                return new Buffer(stringified);
            };

            var client = new RpcClient();
            client.setPublishMessageTransformer(transformer);

            var message = {test: 123};
            var expectedMessage = {test: 123, anotherProperty: 0};
            var expectedStringMessage = JSON.stringify(expectedMessage);

            var buffer = client._publishMessageTransformer(message);
            buffer.should.be.instanceOf(Buffer);
            buffer.toString().should.equal(expectedStringMessage);
        });

    });


    describe('Publish', function() {

        before('Set RPC server and queue', function() {
            var queueName = this.queue = 'test_queue';
            var connectionFactory = new ConnectionFactory(this.host);
            var channel = connectionFactory
                .getConnection()
                .call('createChannelAsync');

            var messageHandler = function(message) {
                var content = JSON.parse(message.content.toString());
                var queue = message.properties.replyTo;
                var correlationId = message.properties.correlationId;

                if (content.value) {
                    content.value = content.value * 2;
                    content.state = 'finished';
                } else {
                    content.state = 'rejected';
                }

                var responseMessage = new Buffer(JSON.stringify(content));
                var responseOptions = { correlationId: correlationId };

                channel.call('sendToQueue', queue, responseMessage, responseOptions);
                channel.call('ack', message);
            };

            return channel
                .tap(function(channel) {
                    return channel.assertQueueAsync(queueName, {exclusive: true, autoDelete: true});
                })
                .tap(function(channel) {
                    return channel.consume(queueName, messageHandler, {});
                });
        });

        beforeEach('Set RPC Client', function() {
            this.client = new RpcClient(this.host);
        });

        it('should correctly publish message and receive response', function() {
            var message = {value: 2};
            return this.client.publish(this.queue, message)
                .then(function(response) {
                    response.value.should.equal(4);
                });
        });

        it('should correctly publish message that will be rejected', function() {
            var message = {noValueHere: true};
            return this.client.publish(this.queue, message)
                .catch(function(error) {
                    error.should.have.property('state', 'rejected');
                });
        });

        it('should correctly publish message and receive response using callback', function(done) {
            var message = {value: 2};
            this.client.publish(this.queue, message, function(error, response) {
                common.should.not.exist(error);
                response.value.should.equal(4);
                done();
            });
        });

    });

});
