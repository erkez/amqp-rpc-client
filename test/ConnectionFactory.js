'use strict';

require('./common');
var ConnectionFactory = require('../lib/ConnectionFactory');


describe('ConnectionFactory', function() {

    it('should correctly create a connection URL if no host is provided', function() {
        var connectionFactory = new ConnectionFactory();
        connectionFactory.makeUrl().should.equal('amqp://localhost');
    });


    it('should correctly create a connection URL if host is provided', function() {
        var host = 'localhost:5672';
        var connectionFactory = new ConnectionFactory(host);
        connectionFactory.makeUrl().should.equal('amqp://' + host);
    });

    describe('Connection Test', function() {

        var connection;

        before('Setup connection factory', function() {
            this.connectionFactory = new ConnectionFactory(this.host);
        });

        it('should connect to host if it exists', function() {
            connection = this.connectionFactory.getConnection();
            return connection.should.be.fulfilled;
        });

        it('should return same connection if it already exists', function() {
            this.connectionFactory.getConnection().should.equal(connection);
        });

    });

});
