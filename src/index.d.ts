
declare module "graphql-subscriber" {

    export class SubscriptionManager {

        public constructor(wsUrl: string, wsPort?: number | null, keepAlive?: boolean, keepAliveInterval?: number, logger?: any);

        public subscribe(options: SubscribeClientData, callBack: SubscriberCallback): boolean;

        public close(): void;
    }
    export default SubscriptionManager;
}