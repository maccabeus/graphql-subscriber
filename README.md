# GraphQl Subscriber

[![Version npm](https://img.shields.io/npm/v/ws.svg?logo=npm)](https://www.npmjs.com/package/ws)
[![CI](https://img.shields.io/github/workflow/status/websockets/ws/CI/master?label=CI&logo=github)](https://github.com/websockets/ws/actions?query=workflow%3ACI+branch%3Amaster)
[![Coverage Status](https://img.shields.io/coveralls/websockets/ws/master.svg?logo=coveralls)](https://coveralls.io/github/websockets/ws)

GraphQl subscriber is is a simple to use, fast, and reliable graphQl subscription implemented based on [`GraphQL over WebSocket Protocol`] (https://github.com/enisdenjo/graphql-ws/blob/master/PROTOCOL.md)

## Table of Contents

- [Protocol support](#protocol-support)
- [Installing](#installing)
- [Creating a subscription](#installing)

## Protocol support

- **HyBi drafts 07-12** (Use the option `protocolVersion: 8`)
- **HyBi drafts 13-17** (Current default, alternatively option
  `protocolVersion: 13`)

## Installing

```
npm install graphql-subscriber
```

## Creating a subscription

```js
const SubscriptionManager = require("graphql-subscriber");
/**
 * @note if you are connecting to an `websocket` endpoint without a port
 * number, you can omit the port `parameter`
 * */
const client = new SubscriptionManager("ws:websocket-url", 4000);
/**
 * Create a subscription query `string`. The library only accept string at the moment
 * */
const sub = `subscription  {
                parcelGetPriceDone {
                    success
                    message
                    code
                    errorCode
                    data
                }
             }`;
client.subscribe({ query: sub, operationName: "parcelGetPriceDone" }, (data) =>
  /** A callback to process the subscription data */
);
```

## License

[MIT](LICENSE)
