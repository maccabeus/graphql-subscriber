import { SubscriptionManager } from './index';

// const graphQlServer = new SubscriptionManager("ws:localhost", 4001);
const graphQlServer = new SubscriptionManager("wss://beetle-taxis-server.herokuapp.com");

const sub = `subscription  {
            parcelGetPriceDone {
                success
                message
                code
                errorCode
                data
            }
        }`;

const sub2 = `subscription  {
            parcelGetPriceDone {
                success
                data
            }}`;

const sub4 = `subscription  {
            rideAddNewDone {
                success
                data
            }}`;

graphQlServer.subscribe({ query: sub, operationName: "parcelGetPriceDone" }, (data) => console.log("res:", data));
graphQlServer.subscribe({ query: sub2, operationName: "parcelGetPriceDone" }, (data) => console.log("res 2:", data));
graphQlServer.subscribe({ query: sub2, operationName: "parcelGetPriceDone" }, (data) => console.log("res 3:", data));
graphQlServer.subscribe({ query: sub4, operationName: "rideAddNewDone" }, (data) => console.log("add new done:", data));