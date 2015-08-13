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

The client must be initialized prior to usage. You may have any number of client instances
running, but you probably need only one instance.

The initialization with a command like `var rpcClient = new AmqpRpcClient();`.
You may provide a host to connect to as the only parameter of the client.

The client instance exposes three key methods:

* `setPublishMessageTransformer`
* `setResponseMessageHandler`
* `publish`

Both publish message transformer and response handler have default functions set.

The publish method stringifies message and converts to Buffer, if not already Buffer.
```
RpcClient.defaultPublishMessageTransformer = function(message) {
    if (message instanceof Buffer) {
        return Buffer;
    } else {
        var stringifiedMessage = JSON.stringify(message);
        return new Buffer(stringifiedMessage);
    }
};
```


The response handler converts Buffer to JSON and reads information in state property.
```
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
```

### `publish(queue:String, message:*, [callback:Function], [runningCallback:Function])`

Publishes `message` on given `queue`. Optional callbacks may be provided.
Method returns a promise that is fulfilled or rejected according to the function specified
with `setResponseMessageHandler` or with default function.


### `setPublishMessageTransformer(Function)`

The provided transformer receives the message given on the `publish` method
and should return a `Buffer` that will be sent to `queue` on the same method.


### `setResponseMessageHandler(Function)`

The provided response handler receives 4 parameters:
channel, fulfill, rejection and running callbacks.

The handler must return a function which receives a single parameter:
A message of type `Buffer`.


**It is the responsibility of the handler to parse the message,
close the channel and call respective callbacks.**

For obvious reasons, either fulfill or reject callback MUST be called.
