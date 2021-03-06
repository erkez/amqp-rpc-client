'use strict';

var chai = require('chai');
var chaiAsPromised = require('chai-as-promised');
var sinon = require('sinon');
var sinonChai = require('sinon-chai');


var should = chai.should();
chai.use(chaiAsPromised);
chai.use(sinonChai);


beforeEach('Setup Sinon sandbox', function() {
    this.sinon = sinon.sandbox.create();
});


afterEach('Setup Sinon sandbox', function() {
    this.sinon = sinon.sandbox.restore();
});


beforeEach('AMQP Test Host', function() {
    this.host = process.env.AMQP_TEST_HOST;
});


module.exports = {
    chai: chai,
    sinon: sinon,
    should: should
};
