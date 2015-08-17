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

This is a reference for version 2.x. If you are looking for version 1.x, go [here](https://github.com/erkez/amqp-rpc-client/blob/v1.x/README.md).

## RpcClient

The client must be initialized prior to usage. You may have any number of client instances
running, but you probably need only one instance.

The initialization with a command like `var rpcClient = new AmqpRpcClient();`.
You may provide a host to connect to as the only parameter of the client.

The client instance exposes the following methods:

* `setExchange`
* `setPublishMessageTransformer`
* `setResponseMessageHandler`
* `publish`

Both publish message transformer and response handler have default functions set.

The publish method stringifies message and converts to Buffer, if not already Buffer.
```
RpcClient.defaultPublishMessageTransformer = function(message) {
    if (message instanceof Buffer) {
        return message;
    } else {
        var stringifiedMessage = JSON.stringify(message);
        return new Buffer(stringifiedMessage);
    }
};
```


The response handler converts Buffer to JSON and reads information in state property.
```
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
```

### `publish(queue:String, message:*, [[options:Object], [callback:Function]])`

Publishes `message` on given `queue`. You may provide an options object with the following properties:

* `exchange`:`String` Overrides client exchange. Defaults to ''.
* `progressCallback`:`Function` Optional callback to be called
  when the received message is not final. It is only useful if the server sends
  such kind of messages and if response message parser cares about them. 

Optional callback may be provided.
Method returns a promise that is fulfilled or rejected according to the function specified
with `setResponseMessageHandler` or with default function.


### `setExchange(String)`

Sets the exchange for all client calls. May be set individually as an option in `publish`.


### `setPublishMessageTransformer(Function)`

The provided transformer receives the message given on the `publish` method
and should return a `Buffer` that will be sent to `queue` on the same method.


### `setResponseMessageHandler(Function)`

The provided response handler receives 3 parameters:
fulfill, rejection and running callbacks.

The handler must return a function which receives a single parameter:
A message of type `Buffer`.

For obvious reasons, either fulfill or reject callback must be called.
