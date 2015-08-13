'use strict';

require('./common');
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


    it('should instantiate client with provided host', function() {
        var host = 'myhost:5123';
        var client = new RpcClient(host);
        client._connectionFactory.makeUrl().should.equal('amqp://' + host);
    });


    it('should transform request if object', function() {
        var client = new RpcClient();
        var message = {test: 123};
        var stringMessage = JSON.stringify(message);
        var buffer = client._publishMessageTransformer(message);
        buffer.should.be.instanceOf(Buffer);
        buffer.toString().should.equal(stringMessage);
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
