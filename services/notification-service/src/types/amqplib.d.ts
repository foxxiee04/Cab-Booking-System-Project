import type { Channel, Connection } from 'amqplib';

declare module 'amqplib' {
  // Ensure `connect()` is typed as Promise-based API.
  // Some @types/amqplib setups infer the callback API (ChannelModel), which breaks TS builds.
  export function connect(url: any, socketOptions?: any): Promise<Connection>;

  // Ensure the Connection interface includes Promise-API methods.
  interface Connection {
    createChannel(): Promise<Channel>;
    close(): Promise<void>;
  }
}
