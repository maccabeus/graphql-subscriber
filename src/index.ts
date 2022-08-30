
import WebSocket from "ws";
import crypto from "crypto";
import log from "./logger";
import { ILogger, LogSeverity, LogTypes } from "./logger.types";

export enum GQLMessageConstant {
    CONNECTION_INIT = 'connection_init',
    CONNECTION_ACK = 'connection_ack',
    CONNECTION_ERROR = 'connection_error',
    CONNECTION_KEEP_ALIVE = 'connection_keep_alive',
    CONNECTION_TERMINATE = 'connection_terminate',
    PING = 'ping',
    PONG = 'pong',
    NEXT = 'next',
    ERROR = 'error',
    ERROR_MESSAGE = 'error_message',
    COMPLETE = 'complete',
    SUBSCRIBE = 'subscribe',
}

export enum ConnectionReadyState {
    CONNECTING = 0,
    OPEN = 1,
    CLOSING = 2,
    CLOSED = 3
}

export interface OperationMessage {
    type: GQLMessageConstant
    payload?: Record<string, unknown>;
}
interface SubscribeOperation {
    type: GQLMessageConstant;
    id?: string;
    payload?: SubscribePayload;
}

interface SubscriberCallback { (data: any): any }

export interface SubscribePayload {
    query: string;
    operationName?: string | null;
    variables?: Record<string, unknown> | null;
    extensions?: Record<string, unknown> | null;
}
export interface SubscribeClientData {
    query: string;
    operationName: string;
    variables?: Record<string, unknown> | null;
    extensions?: Record<string, unknown> | null;
}
interface SubscribeServerData {
    id: string;
    type: GQLMessageConstant;
    payload: any;
}
interface SubscriptionQueue {
    options: SubscribeClientData;
    callBack: SubscriberCallback
}

export class SubscriptionManager {

    private connection: WebSocket;
    private subscriber: Map<string, Array<SubscriberCallback>> = new Map();
    private subscriberCount: number = 0;
    private connectionAck: boolean = false;
    private url: string;
    private port: number | null;
    private keepAlive: boolean;
    private keepAliveIndex: any;
    private retryInterval: number = 2000;
    private retryIndex!: any;
    private keepAliveInterval: number;
    private serverSubscriptions: Set<string> = new Set();
    private queuedSubscriptions: Map<string, SubscriptionQueue> = new Map();
    private log: ILogger;
    private readonly wsGraphQlKey: string = "graphql-transport-ws";

    public constructor(wsUrl: string, wsPort: number | null = null, keepAlive: boolean = true, keepAliveInterval: number = 10000, logger?: ILogger) {
        this.url = wsUrl;
        this.port = wsPort;
        this.keepAlive = keepAlive;
        this.keepAliveInterval = keepAliveInterval;
        this.log = logger ?? log;
        this.connection = this.createConnection(wsUrl, wsPort, keepAlive, keepAliveInterval);
    }

    public subscribe(options: SubscribeClientData, callBack: SubscriberCallback) {

        if (!this.connection) {
            /** attempt to reestablish the connection */
            this.connection = this.createConnection(this.url, this.port, this.keepAlive, this.keepAliveInterval);
        }

        if (this.connection.readyState !== ConnectionReadyState.OPEN || !this.connectionAck) {
            return this.retrySubscription(options, callBack);
        }

        const { variables, query, extensions } = options;
        /** strip all spaces from query expression  before using for ID generation */
        // const subscriptionId = this.hashString(`${operationName}${query.replace(/\s/ig, "")}`);
        const subscriptionId = this.generateSubscriptionId(options);
        /**
         * Check if we are already connected to this subscription on the server
         * If we are, we will not bother to connect to this 
         */
        const currentList = this.subscriber.get(subscriptionId);
        this.subscriber.set(subscriptionId, currentList ? currentList.concat(callBack) : [callBack]);
        this.subscriberCount++;
        /**
         * only connect to server if we not already connected to this subscription
         */
        if (!this.serverSubscriptions.has(subscriptionId)) {
            const subscriptionData: SubscribeOperation = {
                id: subscriptionId,
                type: GQLMessageConstant.SUBSCRIBE,
                payload: {
                    query, variables, extensions
                }
            }
            this.connection.send(this.stringify(subscriptionData));
            /** add the  subscription to the server subscription list  */
            this.serverSubscriptions.add(subscriptionId);
            // console.log("subs: ", Array.from(this.serverSubscriptions.values()));
        }
    }

    public close() {
        this.terminateConnection()
    }

    private processMessage(data: any): void {

        if (!data) { return };
        // console.this.log(data.toString());
        try {
            const serverMessage: any = JSON.parse(data.toString());
            /**
             * begin processing the server response based on any of the following 
             */
            switch (serverMessage.type) {
                case GQLMessageConstant.CONNECTION_ACK:
                    /** set connection ack to true */
                    this.connectionAck = true;
                    // this.keepConnectionAlive();
                    break;
                case GQLMessageConstant.NEXT:
                    this.processNextSubscription(serverMessage);
                    break;
                case GQLMessageConstant.COMPLETE:
                    this.processCompletedSubscription(serverMessage);
                    break;
                case GQLMessageConstant.ERROR:
                    this.processSubscriptionError(serverMessage);
                    break;
                default:
                    break;
            }
        } catch (e: any) {
            const message = "Could not parse sever message";
            this.log(LogSeverity.ERROR, LogTypes.SYSTEM, message, e);
        }
    }

    private processNextSubscription(data: SubscribeServerData | null): void {
        if (!data) return;
        console.log("here");
        this.notifySubscribers(data);
    }
    private processCompletedSubscription(data: SubscribeServerData | null): void {
        if (!data) return;
        const { id, type, } = data;
        if (type === GQLMessageConstant.COMPLETE) {
            /** remove id from sever subscriptions */
            this.serverSubscriptions.delete(id);
        }
    }
    private processSubscriptionError(data: SubscribeServerData | null): void {
        if (!data) return;
        this.notifySubscribers(data);
        const message = "Error occurs during subscription";
        this.log(LogSeverity.EMERGENCY, LogTypes.SYSTEM, message, data);
    }

    private notifySubscribers(data: SubscribeServerData) {
        const { id, payload, type } = data;
        /** For each of client subscribe to this event , we will notify */
        const eventSubscribers = this.subscriber.get(id);
        if (eventSubscribers && eventSubscribers.length > 0) {
            eventSubscribers.forEach((callback: any) => {
                callback(payload);
            })
        }
    }

    private createConnection(wsUrl: string, wsPort: number | null, keepAlive: boolean, keepAliveInterval: number): WebSocket {

        const wsFullUrlAndPort = wsPort ? `${wsUrl}:${wsPort}` : wsUrl;
        const connection = new WebSocket(wsFullUrlAndPort, this.wsGraphQlKey);
        /**
         * Start processing the socket listeners 
         */
        connection.on("open", (data: any) => {
            connection.send(
                this.stringify({ type: GQLMessageConstant.CONNECTION_INIT, payload: {} })
            )
            this.processConnectionOpen(data);
        });
        /**
         * Process connection message
         */
        connection.on("message", (data: any) => {
            this.processMessage(data);
        });
        connection.on("error", (data: any) => {
            this.processConnectionError(data);
        });
        return connection;
    }

    private keepConnectionAlive(interval: number = this.keepAliveInterval) {
        this.keepAliveIndex = setInterval(() => {
            console.log("keeping alive");
            const data: SubscribeOperation = {
                type: GQLMessageConstant.CONNECTION_KEEP_ALIVE,
            }
            this.connection.send(this.stringify(data));
        }, interval);
    }

    private retrySubscription(options: SubscribeClientData, callBack: SubscriberCallback, interval: number = this.retryInterval) {
        /** add subscription to the queue */
        this.queuedSubscriptions.set(this.generateSubscriptionId(options), { options, callBack });
        /** if retry not currently running, attempt to run subscription retries */
        if (!this.retryIndex) {
            this.retryIndex = setInterval(() => {
                if (this.connection.readyState === ConnectionReadyState.OPEN && this.connectionAck) {
                    this.queuedSubscriptions.forEach((subscription, key: string) => {
                        const { options, callBack } = subscription;
                        this.subscribe(options, callBack);
                        this.queuedSubscriptions.delete(key);
                    })
                    clearInterval(this.retryIndex);
                }
            }, interval);
        }
    }

    private terminateConnection() {
        if (this.keepAliveIndex) {
            clearInterval(this.keepAliveIndex);
        }
        /**
         * Make terminate request call and close websocket connection
         */
        const data: SubscribeOperation = {
            type: GQLMessageConstant.CONNECTION_TERMINATE
        }
        this.connection.send(this.stringify(data));
        this.connection.close();
    }
    private processConnectionOpen(data: any) {
        const message = "Websocket connection established";
        this.log(LogSeverity.INFO, LogTypes.SYSTEM, message, data);
    }
    private processConnectionError(data: any) {
        const message = "Error occurs during socket connection";
        this.log(LogSeverity.EMERGENCY, LogTypes.SYSTEM, message, data);
    }

    private stringify(messageValue: any): string {
        if (!messageValue) { return "" };
        return JSON.stringify(messageValue);
    }

    private generateSubscriptionId(options: SubscribeClientData): string {
        const { operationName, query } = options;
        /** strip all spaces from query expression  before using for ID generation */
        return this.hashString(`${operationName}${query.replace(/\s/ig, "")}`);
    }
    private hashString(value: string, mode: string = "md5", digest: any = "hex") {
        return crypto.createHash(mode).update(value).digest(digest);
    }
}