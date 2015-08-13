# What is amqp-rpc-client?
It is a production ready, simple, promise-based and callback compatible AMQP RPC client.

# Quick start

```
npm install amqp-rpc-client
```
Then:
```
var AmqpRpcClient = require('amqp-rpc-client');
var rpcClient = new AmqpRpcClient('myhost');
var publishResult = rpcClient.publish('myQueue', {message: 'awesome!'});
```

# Reference

## RpcClient

### TODO
